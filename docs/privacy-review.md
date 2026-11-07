# Privatumo pranešimo projektas (CLS-013)

Puslapis `app/privatumas/page.tsx` (`/privatumas`). Kol `lib/privacy.ts` būsena `draft`, puslapyje rodoma „Projektas“ ir atviri klausimai. Produkcijoje skelbiama tik Vyčiui Radvilai patvirtinus turinį.

Faktai patikrinti 2026-11-07. Žemiau nurodyta, iš kur paimtas kiekvienas teiginys.

## Patikrinti faktai

| Teiginys puslapyje | Šaltinis |
| --- | --- |
| Valdytojas VšĮ „Klaipėdos universitetas“, kodas 211951150 | KU „Asmens duomenų saugumo pažeidimų reagavimo tvarkos aprašas“ (rektoriaus 2021-12-15 įsakymas Nr. 1-044), 2.1 p., ku.lt |
| Kontaktas steam@ku.lt | Platformos laiškų atsakymo adresas (`lib/email/send.ts`), puslapiai `/laukia`, prisijungimo forma |
| Vedėjų duomenys | `profiles` stulpeliai (schema po visų migracijų), profilio forma, `lib/access/profile-fields.ts` |
| Sutikimo tekstas | `CONSENT_TEXT` (`lib/access/profile-fields.ts`), rodomas prašymo ir profilio formose; data `profiles.consent_at` |
| Paskyros prašymo duomenys | `access_requests` stulpeliai |
| Dalyvių duomenys | `teams`, `submissions`, `hint_reveals`, `achievements`, `reflections`; paskyrų nėra |
| DI naudojimo įrašas be turinio | `ai_usage`: naudotojas, funkcija, modelis, žetonai, kaina, laikas |
| Administratorių veiksmų žurnalas | `admin_audit_log`, `logAdminAction` kvietimai `app/api/admin/**` |
| IP tik bandymų ribojimui, į DB neįrašomas | `lib/client-address.ts` (HMAC), Upstash nekonfigūruotas: Vercel `ctf-builder` nėra `KV_REST_API_*` kintamųjų, todėl riba serverio atmintyje |
| Anthropic gauna tik vedėjo turinį | Anthropic kviečia tik `app/api/di/generate`, `app/api/di/verify`, `app/api/import/process`, `app/api/lesson-plans/[planId]/convert` |
| Supabase Frankfurte | Supabase projekto nustatymai: „Central EU (Frankfurt)“ |
| Vercel funkcijos Frankfurte | `vercel.json` `regions: ["fra1"]`; produkcijos atsakymai vykdomi `fra1` |
| Resend, ES regionas | Supabase Auth SMTP: `smtp.resend.com` (nustatymai); ES regionas pagal `docs/access-and-email.md` (Resend paskyroje netikrinta) |
| Google prisijungimas | Prisijungimo forma (`app/auth/login/login-form.tsx`) |
| Ištrynimas kaskadomis | Veiklos trynimas (`app/api/games/[gameId]`), komandos šalinimas; `on delete cascade` migracijose `00001`, `00004`, `00011`, `00012`, `00024` |
| Naktinis užbaigimas be trynimo | `app/api/cron/finish-stale-activities` keičia tik būseną |
| Kasdienės atsarginės kopijos | Supabase → Database → Backups: kasdienės fizinės kopijos |
| Paveikslėliai pagal nuorodą | Saugykla `challenge-images` vieša (`00003_challenge_media.sql`) |
| Patvirtinti bibliotekos įrašai pasiekiami be prisijungimo | Politika `read_approved_library` rolei `public`; `anon` turi SELECT teisę į `library_items`. Įrašuose nėra `answer_hash`, bet yra užuominos |
| Analitikos ir reklamos slapukų nėra | Priklausomybėse nėra analitikos ar reklamos paketų |

## Klausimai KU duomenų apsaugos pareigūnui

1. Duomenų apsaugos pareigūno kontaktas, kurį nurodyti puslapyje. Oficialaus KU privatumo politikos puslapio automatiniais įrankiais perskaityti nepavyko (ku.lt neleidžia automatinio skaitymo).
2. Teisinis pagrindas. Formose dabar prašoma sutikimo. Ar tinka sutikimas, ar KU naudoja kitą pagrindą (pvz., viešąjį interesą ar teisėtą interesą)? Jei sutikimas, kaip jis atšaukiamas.
3. Saugojimo terminai:
   - vedėjų paskyroms;
   - paskyrų prašymams, taip pat atmestiems;
   - veiklų rezultatams (komandos, atsakymai, refleksijos);
   - DI naudojimo įrašams;
   - administratorių veiksmų žurnalui;
   - vedėjų įkeltiems dokumentams;
   - atsarginėms kopijoms.
4. Duomenų tvarkymo sutartys su Supabase, Vercel, Anthropic, Resend ir duomenų perdavimas už EEE ribų.
5. Kas priima duomenų subjektų prašymus: STEAM centras (steam@ku.lt) ar duomenų apsaugos pareigūnas.
6. Ar reikia atskiros informacijos tėvams, kai dalyviai yra nepilnamečiai (dalyviai be paskyrų, bet laisvame tekste gali įrašyti vardus).

## Pastebėjimai, kurie nėra šio puslapio dalis

- Vedėjų importuoti dokumentai (`documents` saugykla, `imports/<vedėjas>/...`) po apdorojimo neištrinami. Trynimo mechanizmo nėra.
- Paskyrų prašymai, DI naudojimo įrašai ir administratorių žurnalas automatiškai neištrinami.
- Patvirtinti bibliotekos įrašai su užuominomis pasiekiami per viešą API be prisijungimo.

Šie pastebėjimai įrašyti į bendrą backlogą. Pagal DAP pareigūno atsakymą gali prireikti saugojimo terminų įgyvendinimo.

## Kaip paskelbti

1. Vytis patvirtina turinį ir atsiunčia DAP pareigūno atsakymus.
2. Claude Code pakeičia kiekvieną `<Question>` patvirtintu tekstu, `lib/privacy.ts` būseną pakeičia į `approved`, atnaujina datą.
3. `tests/privacy-notice.test.ts` neleidžia `approved` būsenos su likusiais klausimais.
4. CI, Vercel peržiūra, sujungimas, produkcijos patikra.
