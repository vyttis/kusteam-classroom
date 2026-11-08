import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { removeImportDocument, retentionMode } from "@/lib/retention"
import { checkAiAllowance, enterAiContext } from "@/lib/ai/usage"
import { NextResponse } from "next/server"
import { IMPORT_TEXT_LIMIT } from "@/lib/upload-limits"
import { z } from "zod"
import { buildSystemPrompt } from "@/lib/ai/prompt"
import { aiSuggestResponseSchema } from "@/lib/ai/schemas"
import { getAnthropicClient, MODELS, cachedSystem } from "@/lib/ai/client"
import { createWithSchemaRetry } from "@/lib/ai/retry"
import { checkAiRateLimitAsync } from "@/lib/ai/rate-limit"
import { verifySuggestion } from "@/lib/ai/verify-suggestion"

const processSchema = z.object({
  storage_path: z.string().min(1),
  game_title: z.string().min(1),
  game_description: z.string().nullable().default(null),
  count: z.number().min(1).max(10).default(5),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizuota" }, { status: 401 })
  }

  if (!(await checkAiRateLimitAsync("import-process", user.id, 5))) {
    return NextResponse.json(
      { error: "Per daug užklausų. Palaukite minutę." },
      { status: 429 }
    )
  }
  // Monthly DI limits (personal and platform budget); every model call
  // from here on is recorded for this action.
  const allowance = await checkAiAllowance(user.id, "import/process")
  if (!allowance.ok) {
    return NextResponse.json({ error: allowance.message, code: allowance.code }, { status: 429 })
  }
  enterAiContext(allowance.ctx)

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Netinkamas užklausos formatas" },
      { status: 400 }
    )
  }

  const parsed = processSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Neteisingi duomenys" },
      { status: 400 }
    )
  }

  // Authorize: storage_path must live in this user's imports folder.
  const expectedPrefix = `imports/${user.id}/`
  if (!parsed.data.storage_path.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Prieiga uždrausta" }, { status: 403 })
  }

  try {
    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(parsed.data.storage_path)

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "Nepavyko gauti failo" },
        { status: 404 }
      )
    }

    // Extract text based on file type
    const text = await extractText(fileData, parsed.data.storage_path)

    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { error: "Nepavyko išgauti teksto iš dokumento arba tekstas per trumpas" },
        { status: 400 }
      )
    }

    // Truncate to reasonable length for AI processing
    const truncated = text.length > IMPORT_TEXT_LIMIT
    const truncatedText = text.slice(0, IMPORT_TEXT_LIMIT)

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "DI paslauga nepasiekiama" },
        { status: 503 }
      )
    }

    const anthropic = getAnthropicClient()

    // Generate tasks from document content
    const systemPrompt = buildSystemPrompt()
    const userMessage = `Veiklos pavadinimas: ${parsed.data.game_title}
${parsed.data.game_description ? `Veiklos aprašymas: ${parsed.data.game_description}` : ""}

Vedėjas įkėlė dokumentą su mokomąja medžiaga. Pagal šį turinį sugeneruok ${parsed.data.count} komandinės edukacinės veiklos užduotis.

DOKUMENTO TURINYS:
---
${truncatedText}
---

Sugeneruok ${parsed.data.count} užduotis pagal šį dokumentą. Užduotys turi tikrinti mokinių supratimą apie dokumento turinį.`

    const validatedData = await createWithSchemaRetry(
      {
        model: MODELS.generate,
        max_tokens: 4096,
        system: cachedSystem(systemPrompt),
        messages: [{ role: "user", content: userMessage }],
      },
      aiSuggestResponseSchema,
      { logPrefix: "import-process", maxRetries: 1 },
    )

    // Verify each suggestion
    const enriched = await Promise.all(
      validatedData.suggestions.map(async (suggestion) => {
        const verification = await verifySuggestion(anthropic, suggestion)
        return { ...suggestion, verification }
      })
    )

    // CLS-017: the document is not needed after a successful import.
    await removeImportDocument(parsed.data.storage_path, retentionMode(), createAdminClient)

    return NextResponse.json({ suggestions: enriched, truncated })
  } catch (error) {
    console.error("Import process error:", error)
    return NextResponse.json(
      { error: "Dokumento apdorojimas nepavyko. Bandykite dar kartą." },
      { status: 500 }
    )
  }
}

async function extractText(blob: Blob, path: string): Promise<string> {
  const ext = path.split(".").pop()?.toLowerCase()

  if (ext === "txt") {
    return await blob.text()
  }

  if (ext === "pdf") {
    try {
      const { PDFParse } = await import("pdf-parse")
      const data = new Uint8Array(await blob.arrayBuffer())
      const parser = new PDFParse({ data })
      const result = await parser.getText()
      await parser.destroy()
      return result.text
    } catch {
      return ""
    }
  }

  if (ext === "docx") {
    try {
      const mammoth = await import("mammoth")
      const buffer = Buffer.from(await blob.arrayBuffer())
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    } catch {
      return ""
    }
  }

  return ""
}

