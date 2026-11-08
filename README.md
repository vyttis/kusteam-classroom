# KU STEAM CLASSROOM

Interaktyvių pamokų platforma: vedėjas sukuria komandinę veiklą su užduotimis (galima su DI pagalba), paleidžia ją ir mato atsakymus realiu laiku, o dalyviai prisijungia su kodu ar QR kodu. Yra pamokų planai pagal bendrąsias programas, veiklų biblioteka, klasės ekranas ir ataskaitos.

KU STEAM AI LAB ekosistemos dalis. Bendra architektūra, domenai ir atsakomybės: [`vyttis/kusteam-ai-lab` → `docs/ECOSYSTEM.md`](https://github.com/vyttis/kusteam-ai-lab/blob/main/docs/ECOSYSTEM.md). Darbai: [`docs/BACKLOG.md`](https://github.com/vyttis/kusteam-ai-lab/blob/main/docs/BACKLOG.md) (CLS). Agentų instrukcijos: `AGENTS.md`.

| | |
| --- | --- |
| Oficialus adresas | `https://pamokos.kusteam.app` |
| Vedėjui | `/vedejui` (prisijungimas, veiklų valdymas) |
| Dalyviui | `/prisijungti` (kodo įvedimas), `/play/<kodas>` (veikla) |
| Seni adresai | `app.kusteam.app` ir `play.kusteam.app` nukreipiami į oficialų adresą, keliai ir parametrai išsaugomi |
| Vercel projektas | `ctf-builder` (techninis pavadinimas) |
| Atsako | Claude Code (koordinuoja Vytis Radvila) |

## Naudojimas

- **Vesti veiklą:** `pamokos.kusteam.app/vedejui` → prisijungimas su Google arba el. pašto kodu → „Mano veiklos“ → nauja veikla → užduotys → paleidimas → klasės ekranas su QR kodu.
- **Prisijungti prie veiklos:** `pamokos.kusteam.app/prisijungti` → kodas arba QR → komandos pavadinimas → užduotys. Paskyros nereikia.

## Architektūra

- Next.js 16 App Router (TypeScript strict, React 19, Turbopack)
- Supabase (Postgres, Auth, Realtime, Storage)
- Tailwind + shadcn/ui
- Anthropic Claude DI generavimui (pamokų planai, užduotys); DI biudžetas Supabase (`ai_usage`), trumpo lango riba serverio atmintyje
- `proxy.ts` + `lib/hosts.ts`: vienas oficialus adresas vedėjui ir dalyviui, seni `app.`/`play.` adresai

### Adresų perjungimas

`CANONICAL_CLASSROOM_HOST=pamokos.kusteam.app` įjungia senų adresų nukreipimą (307, laikinas: naršyklės jo neįsimena, todėl atšaukimas tikrai veikia; po stabilaus laikotarpio galima pakeisti į 308). Kol kintamasis nenustatytas, `app.` ir `play.` veikia kaip anksčiau, todėl perjungimas ir atšaukimas yra vienas aplinkos kintamasis ir naujas diegimas. Vietoje paliekami tik:

- `/api/*` (atidaryti puslapiai su senomis sesijomis),
- `app.…/auth/callback` (PKCE slapukas galioja tik tame adrese, kur prasidėjo prisijungimas),
- `play.…/play/<kodas>/play` ir `/leaderboard` (dalyvio sesija saugoma to adreso `localStorage`).

Prisijungimo slapukai nesidalijami tarp subdomenų sąmoningai: kitos ekosistemos aplikacijos negauna CLASSROOM sesijų. Po perjungimo vedėjai vieną kartą prisijungia iš naujo.

## Lokalus paleidimas

```bash
npm install
cp .env.local.example .env.local   # užpildyti reikšmes
supabase start                      # lokali Postgres + auth
supabase db reset                   # pritaikyti migracijas
npm run dev
```

`http://pamokos.localhost:3000` (oficialus režimas), `http://app.localhost:3000` ir `http://play.localhost:3000` (seni adresai).

## Skriptai

- `npm run dev`: dev serveris
- `npm run build` / `npm start`: produkcija
- `npm run lint`: ESLint
- `npx tsc --noEmit`: tipų patikra
- `npm test`: vienetų testai (Vitest)
- `npm run test:db`: migracijos, schemos atspaudas, saugumo patikros ir grąžinimas tuščioje Postgres (be Docker). Produkcija ir CI naudoja Postgres 17; vietoje kitos versijos nurodyti `PGBIN=/usr/lib/postgresql/17/bin`
- `npm run test:e2e`: produkcijos smoke testai (Playwright, tik skaitymas). CI juos paleidžia po kiekvieno produkcijos diegimo ir kasdien.

## Diegimas

`main` šaka automatiškai diegiama į Vercel produkciją. Kiekvienas PR gauna peržiūros diegimą, apsaugotą Vercel prisijungimu. Produkcijos kintamieji (Vercel → Settings → Environment Variables):

| Kintamasis | Paskirtis |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase klientas |
| `SUPABASE_SERVICE_ROLE_KEY` | Tik serveryje (dalyvių API). Sensitive, tik Production |
| `ANTHROPIC_API_KEY` | DI generavimas. Sensitive, tik Production |
| `RESEND_API_KEY` | Prieigos prašymų ir kvietimų laiškai. Sensitive |
| `CRON_SECRET` | Naktinis veiklų užbaigimas (`/api/cron/finish-stale-activities`). Sensitive |
| `NEXT_PUBLIC_SITE_URL` | Oficialus adresas metaduomenims (`https://pamokos.kusteam.app`) |
| `NEXT_PUBLIC_PLAY_URL` | Dalyvių nuorodų ir QR kodų adresas (`https://pamokos.kusteam.app`) |
| `CANONICAL_CLASSROOM_HOST` | Įjungia senų adresų nukreipimą |

Supabase Auth → URL Configuration: Site URL `https://pamokos.kusteam.app`, Redirect URLs turi apimti `https://pamokos.kusteam.app/**` ir senus adresus, kol jie naudojami.

## Svarbiausi principai

1. Atsakymai tikrinami serveryje (`/api/submissions`), niekada kliente.
2. Dalyviai be paskyrų: sesija per `session_token` naršyklės `localStorage`. Dalyvio puslapiai Supabase naršyklėje nenaudoja, viską skaito per `/api/play/*` su veiklos kodu.
3. Dalyvių rašymo operacijos eina per service_role API maršrutus; anon INSERT uždraustas DB sluoksnyje.
4. DI tik siūlo: vedėjas visada patvirtina teisingą atsakymą.
5. `answer_hash` niekada negrąžinamas į naršyklę (`SAFE_CHALLENGE_COLUMNS`).
6. Sąsajoje vaidmenys vadinami „vedėjas“ ir „dalyvis“; pagrindiniai veiksmai „Vesti veiklą“ ir „Prisijungti prie veiklos“.

## Aplankų struktūra

- `app/(teacher)/`: vedėjo aplinka (reikia sesijos)
- `app/vedejui/`, `app/prisijungti/`: viešieji įėjimai
- `app/play/[gameCode]/`: dalyvio eiga (be paskyros)
- `lib/hosts.ts`: adresų vaidmenys ir senų adresų nukreipimai
- `lib/ai/`: Claude užklausos ir schemos
- `lib/supabase/`: `server.ts`, `client.ts`, `admin.ts`
- `lib/auth/roles.ts`: RBAC `teacher` / `admin` / `super_admin`
- `supabase/migrations/`: DB schema (`00001`…`00025`, žr. `docs/migration-history.md`)

## Patikros produkcijoje

- `docs/REGISTRATION-TEST.md`: paskyros prašymas, patvirtinimas, kvietimas, administratoriaus rolė, bibliotekos moderavimas (CLS-004).
- `docs/PILOT.md`: pilotas klasėje su 5–10 tikrų įrenginių (CLS-002).

## Saugumas

- RLS visose lentelėse, anon INSERT izoliuotas (00018).
- bcrypt atsakymų maišos.
- `SECURITY DEFINER` funkcijų `search_path` užfiksuotas (00025).
- Žinoma likusi rizika: vieša anon užklausa gali išvardinti aktyvių veiklų kodus (žr. `kusteam-ai-lab/docs/STATUS.md`).

## Kalba

- Sąsaja: tik lietuvių kalba su teisingomis raidėmis.
- Kodas, komentarai, git žinutės: anglų kalba.
