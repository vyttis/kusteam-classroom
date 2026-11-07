# KU STEAM CLASSROOM (`vyttis/kusteam-classroom`, CLS)

Interaktyvių pamokų platforma: vedėjai kuria ir veda komandines veiklas, dalyviai prisijungia su kodu ar QR kodu. Oficialus adresas `https://pamokos.kusteam.app`: vedėjui `/vedejui`, dalyviui `/prisijungti` ir `/play/<kodas>`. Seni `app.*` ir `play.*` adresai toliau veikia (`lib/hosts.ts`). Vercel projektas `ctf-builder`, Supabase `menmndjyfeuwfweubwnl`, DI Anthropic. Atsako Claude Code, tvirtina Vytis Radvila.

## Sesijos pradžioje

Ekosistemos dokumentai yra `vyttis/kusteam-ai-lab` repozitorijoje (čia nekopijuojami):

1. [`docs/ECOSYSTEM.md`](https://github.com/vyttis/kusteam-ai-lab/blob/main/docs/ECOSYSTEM.md): atsakomybės ir agentų darbo taisyklės (ką galima daryti ir kur būtinas Vyčio patvirtinimas).
2. [`docs/SPRINTS.md`](https://github.com/vyttis/kusteam-ai-lab/blob/main/docs/SPRINTS.md): aktyvus sprintas. Jei aktyvaus nėra, naujų darbų nepradėti, nebent Vytis paprašė pokalbyje.
3. [`docs/BACKLOG.md`](https://github.com/vyttis/kusteam-ai-lab/blob/main/docs/BACKLOG.md) (CLS skyrius) ir [`docs/STATUS.md`](https://github.com/vyttis/kusteam-ai-lab/blob/main/docs/STATUS.md).
4. [`docs/DESIGN-SYSTEM.md`](https://github.com/vyttis/kusteam-ai-lab/blob/main/docs/DESIGN-SYSTEM.md): kokybės principai, tekstas, sąsaja, prieinamumas.
5. Šios repozitorijos `README.md` ir `docs/migration-history.md` (prieš bet kokį DB darbą).

## Architektūra, kurios negalima pažeisti

- **Dalyvio puslapiai (`app/play/**`) Supabase naršyklėje nenaudoja.** Viską skaito per serverio maršrutus su veiklos kodu ir komandos žetonu: `/api/play/state`, `/api/play/status` (būsena, laikas, užduočių žymė, naujausias skelbimas, kas 5 s), `/api/play/leaderboard` (kas 4 s), `/api/play/hint`, `/api/play/start`, `/api/play/rejoin`, `/api/teams`, `/api/submissions`. Šie maršrutai naudoja `@/lib/supabase/admin` (service role). `anon` raktas nuo migracijos `20261107120000` negali skaityti `games`, `teams`, `challenges`, `submissions`, `announcements`, `achievements`. `tests/leaderboard.test.ts` saugo, kad `app/play` neimportuotų naršyklės kliento.
- **Realus laikas tik vedėjui.** Vedėjo ir administratoriaus puslapiai (`components/teacher/*`, `hooks/use-live-game.ts`) naudoja `@/lib/supabase/client` ir Supabase Realtime savo veikloms pagal savininko RLS politikas.
- **Atsakymai tikrinami tik serveryje** (`/api/submissions`, `lib/game/answer-hasher.ts`, bcrypt su SHA-256 iš anksto). SQL `check_answer()` nenaudojama. `answer_hash`, `accepted_answer_hashes` ir užuominos niekada nesiunčiami į naršyklę.
- Dalyviai be paskyrų: komandos `session_token` naršyklės `localStorage`, perduodamas antrašte `x-session-token`.
- DI tik siūlo: teisingą atsakymą visada patvirtina vedėjas. DI biudžetas ir limitai skaičiuojami Supabase (`ai_usage`), trumpo lango riba serverio atmintyje.
- Server components: `@/lib/supabase/server`. API maršrutuose įvestis tikrinama su zod. Tipai: `@/types/database.ts`, `@/types/game.ts`.

## Duomenų bazė

- Migracijos `supabase/migrations/`, kiekvienai grąžinimas `supabase/rollback/`. Įrašytų migracijų netaisyti, pridėti naują.
- `npm run test:db`: visos migracijos tuščioje Postgres 17 (kaip produkcijoje), schemos atspaudas (`supabase/tests/schema-fingerprint.expected`), saugumo patikros (`supabase/tests/security.sql`), grąžinimas ir pakartotinis taikymas. Tas pats CI `Database` darbe.
- Produkcijoje migracijos taikomos rankiniu būdu per Supabase SQL Editor, tik su Vyčio patvirtinimu, atsargine kopija ar išsaugota būsena, nevykstant veikloms. Įrašas `docs/migration-history.md`. Supabase GitHub integracija produkcijai migracijų netaiko.

## Kalba ir dizainas

- Visa sąsaja lietuviškai su teisingomis raidėmis, be ilgųjų brūkšnių. Vaidmenys „vedėjas“ ir „dalyvis“, veiksmai „Vesti veiklą“, „Prisijungti prie veiklos“. Kodas, komentarai, kintamieji ir git žinutės angliškai.
- Kokybės principai ir bendras dizainas: `DESIGN-SYSTEM.md` (nuoroda aukščiau). CLASSROOM kol kas naudoja savo artimą paletę (`app/globals.css` tokenai: primary, secondary, accent, highlight ir jų `-ink` variantai tekstui); suvienodinimas yra CLS-010.
- Failų vardai kebab-case, komponentai PascalCase.

## Prieš PR ir po jo

- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:db` (kai liečiama DB), `npm run build`.
- Po sujungimo: Vercel produkcijos diegimas, `E2E smoke (production)` workflow žalias, Vercel runtime klaidų nėra.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
