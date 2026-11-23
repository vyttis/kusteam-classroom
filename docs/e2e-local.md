# Visos pamokos E2E testas su vietiniu Supabase

Testas `e2e/local/full-lesson.spec.ts` pereina visą pamoką nuo vedėjo prisijungimo iki rezultatų eksporto. Jis veikia tik su vienkartiniu vietiniu Supabase (Auth, PostgREST, Realtime, Storage) ir tik su sintetiniais duomenimis. Produkcijos adreso, produkcijos raktų ir DI rakto jam nereikia ir jis jų nenaudoja.

CI jį paleidžia workflow `E2E full lesson (local stack)` (`.github/workflows/e2e-local.yml`) kiekviename pull request ir rankiniu būdu (`workflow_dispatch`). Produkcijos patikra `E2E smoke (production)` lieka atskira ir tik skaito.

## Ką tikrina

Kiekvienas žingsnis tikrina tai, ką mato žmogus ekrane, o kur reikia, ir API atsakymą.

1. Vedėjas prisijungia el. paštu ir slaptažodžiu per `/vedejui`.
2. Sukuria veiklą su 30 min. laiko limitu. Juodraščio dalyviai dar negali atidaryti.
3. Prideda tris užduotis: tekstinę redaktoriuje (su užuomina ir kitu priimamu atsakymu), skaičiaus ir pasirinkimo per tą patį API, kurį naudoja redaktorius.
4. Pradeda veiklą.
5. Trys komandos (viena su iPhone profiliu) atsidaro `/play/<kodas>`, susikuria komandas ir paspaudžia „Pradėti“. Užimtas komandos vardas atmetamas. Vedėjo valdymo centre atsiranda visos trys komandos.
6. Neteisingas atsakymas atmetamas. Teisingi atsakymai vertinami: tekstas be didžiųjų raidžių, kitas priimamas atsakymas, skaičius su dešimtainiu kableliu, pasirinkimas.
7. Du vienu metu išsiųsti teisingi tos pačios užduoties atsakymai įskaitomi vieną kartą.
8. Atidaryta užuomina parodoma, o užduotis po jos duoda mažiau taškų.
9. Rezultatų lentelė rodo komandas teisinga tvarka.
10. Vedėjas pristabdo veiklą (dalyvis mato pauzę, atsakymas nepriimamas), tęsia, pratęsia laiką (dalyvio laikmatis pailgėja), išsiunčia pranešimą (dalyvis jį mato) ir prideda užduotį (dalyviai ją gauna, baigusi komanda grąžinama prie užduočių).
11. Dalyvis perkrauna puslapį ir lieka savo komandoje su tais pačiais taškais ir laiku.
12. Vedėjas baigia veiklą. Atsakymas ir naujos komandos kūrimas nebepriimami.
13. Dalyvis pateikia refleksiją, antra tos pačios komandos refleksija atmetama.
14. Analitikos puslapis rodo teisingas sumas (komandos, atsakymai, teisingi atsakymai, kiekvienos komandos eilutė) ir refleksiją.
15. Rezultatų CSV atsisiunčiamas su BOM, antrašte ir komandų vardais.
16. Nė viename dalyvio naršyklės gautame API atsakyme nėra `answer_hash`, kitų priimamų atsakymų, neatidarytos užuominos teksto ar kitos komandos `session_token`.

## Kaip paleisti savo kompiuteryje

Reikia Docker, Node 24, [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) ir `psql`.

```bash
npm ci
npx playwright install chromium

# 1. Vietinis Supabase. Migracijas iš supabase/migrations pritaiko pats CLI.
export GOOGLE_OAUTH_CLIENT_ID=e2e-local-placeholder GOOGLE_OAUTH_CLIENT_SECRET=e2e-local-placeholder
supabase start -x studio,imgproxy,edge-runtime,logflare,vector,postgres-meta,mailpit,supavisor

# 2. Vietinis adresas ir raktai (tik šios vietinės kopijos).
set -a; eval "$(supabase status -o env | grep -E '^[A-Z0-9_]+=')"; set +a
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

# 3. TEAM-006 schema, kaip produkcijoje (ji dar nėra migracijos failas).
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -X -f supabase/proposals/team-006-sso/up.sql

# 4. Vedėjo paskyra testui.
node e2e/local/seed.mjs

# 5. Programa ir testas (kitame terminale su tais pačiais kintamaisiais).
npm run build && npm start
npm run test:e2e:local

# 6. Pabaigus.
supabase stop --no-backup
```

Pastabos:

- `ANTHROPIC_API_KEY` nenustatyti. Testas DI mygtukų nespaudžia.
- `e2e/local/seed.mjs` ir `playwright.local.config.ts` atsisako dirbti su ne vietiniu adresu (`127.0.0.1` arba `localhost`).
- `supabase/tests/bootstrap.sql` čia netaikomas: jis skirtas tik plikai Postgres (`npm run test:db`), o tikrame Supabase `auth` ir `storage` schemos jau yra.
- Testo paskyra aprašyta `e2e/local/teacher-account.json`. Ji egzistuoja tik vietinėje kopijoje.
- Kiekvienas paleidimas sukuria naują veiklą, todėl testą galima kartoti toje pačioje kopijoje.
- Nepavykus žingsniui, testas išspausdina, ką tuo metu rodė vedėjo ir dalyvių ekranai. CI papildomai išsaugo Playwright ataskaitą ir programos žurnalą.

## Ko testas sąmoningai netikrina

- DI: užduočių generavimo, tikrinimo ir pamokų planų. Tam reikėtų mokamo rakto.
- El. laiškų pristatymo: kvietimų, kodų, slaptažodžio atkūrimo. Pašto serveris nepaleidžiamas.
- Prisijungimo su Google ir KU STEAM TEAM prisijungimo.
- Tikrų įrenginių: iPhone profilis yra Chromium su telefono ekranu, o ne Safari. QR kodo nuskaitymas kamera netikrinamas.
- Apkrovos: trys komandos nėra klasė iš trisdešimties telefonų.
- Vercel aplinkos: CDN talpyklos, kelių serverio egzempliorių ir Vercel KV ribojimų.
