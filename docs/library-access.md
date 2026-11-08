# Patvirtintos bibliotekos prieinamumas (CLS-015)

**Sprendimas S12 = B** (Vytis Radvila, 2026-11-08): patvirtinta biblioteka skirta tik aktyviems prisijungusiems vedėjams. CLS-015 yra V1-BLOCKER. Migracija `supabase/migrations/20261108120000_library_active_facilitators_only.sql` paruošta atskirame PR (#115). Kryptis ir techninė peržiūra patvirtintos, taikymas produkcijoje dar neautorizuotas (`docs/migration-history.md`, „CLS-015“).

**Avarinis grąžinimas vėl atveria anoniminį skaitymą**, kuris buvo iki migracijos. Jį naudoti tik jei migracija sugadina biblioteką aktyviems vedėjams. Jei kliūva tik aktyvios paskyros patikra, yra dalinis grąžinimas, kuris `anon` palieka uždarytą (`docs/migration-history.md`).

Politikos ir teisės patikrintos migracijose ir vietinėje Postgres 17 kopijoje po visų migracijų (2026-11-08). Šios kopijos schemos atspaudas, įskaitant teises ir RLS politikas, sutampa su produkcija, išskyrus `handle_new_user` (CLS-012). Vytis 2026-11-08 produkcijoje patvirtino, kad `read_approved_library` taikoma rolei `public`.

## Būsena iki migracijos

**Teisės ir RLS (`library_items`):**

- `anon` turi SELECT teisę į visą lentelę. Ji suteikta pagal numatytąsias Supabase teises ir vėliau neatšaukta. Migracija `20261107120000` atšaukė `anon` skaitymą kitoms lentelėms, bet ne šiai.
- Politika `read_approved_library` (rolei `public`, t. y. ir `anon`, ir `authenticated`) leidžia skaityti eilutę, jei `status = 'approved'`, arba ji savo, arba skaito administratorius.
- Ribojančios politikos „Only active accounts …“ yra tik INSERT, UPDATE ir DELETE. SELECT tokios nėra.

**Ką mato neprisijungęs:**

- Patikrinta vietinėje kopijoje rolės `anon` vardu: grąžinami tik `approved` įrašai, su visais stulpeliais.
- Stulpeliai: pavadinimas, aprašymas, dalykas, klasė, žymos, nustatymai, `clone_count`, datos, `source_game_id`, `published_by` ir `reviewed_by` (UUID), `review_notes`.
- `challenge_data`: užduočių tekstai, tipai, taškai, užuominos, pasirinkimo variantai, paveikslėlių ir žemėlapių nuorodos.
- Atsakymų ir `answer_hash` nėra (`app/api/library/route.ts` juos praleidžia kurdamas įrašą). Pasirinkimo užduotyje teisingas variantas yra tarp variantų, bet nepažymėtas.
- Autoriaus vardo ir el. pašto `anon` nemato: `profiles` RLS jam negrąžina eilučių.

**Kaip pasiekiama:**

- Supabase Data API (PostgREST) atveria schemą `public`. Ją naudoja vedėjo naršyklės klientas, todėl schemos išjungti negalima.
- `anon` raktas yra viešas pagal Supabase modelį (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, jis yra prisijungimo puslapio JavaScript kode). Su juo bet kas gali paprašyti `GET /rest/v1/library_items?select=*`. Apsauga remiasi tik teisėmis ir RLS.
- Platformos sąsajoje biblioteka prieinama tik prisijungus (`proxy.ts` saugo `/library`). Platformos kodas biblioteką visada skaito prisijungusio naudotojo sesija; `anon` skaitymo kodui nereikia.

**Prisijungę, bet neaktyvūs:** užblokuota ar dar nepatvirtinta (`pending`) paskyra su galiojančia sesija per Data API taip pat mato patvirtintus įrašus, nes SELECT politika paskyros būsenos netikrina.

## Alternatyvos

### A. Vieša biblioteka

Patvirtinti šablonai lieka prieinami be prisijungimo.

- Atitinka kryptį dalintis medžiaga plačiau, bet nesutampa su patvirtintu CLASSROOM v1.0 režimu („patvirtintiems vedėjams ir pilotiniams mokytojams“).
- Užuominos ir užduočių tekstai vieši. Dalyviai gali juos rasti prieš veiklą, jei vedėjas naudoja bibliotekos šabloną.
- Vedėjo darbas tampa viešas. Bibliotekos pateikimo lange to dabar neparašyta.
- Jei renkamasi A, vis tiek reikėtų migracijos: neprisijungusiam palikti tik reikalingus stulpelius (be `published_by`, `reviewed_by`, `review_notes`, `source_game_id`), pvz., per stulpelių teises arba atskirą rodinį. Pateikimo lange reikėtų pranešti, kad šablonas bus viešas.

### B. Tik aktyviems prisijungusiems vedėjams

- Atitinka v1.0 režimą ir esamą taisyklę, kad rašyti gali tik aktyvios paskyros.
- Platformos veikimo nekeičia: visi skaitymai jau vyksta prisijungus.
- Vienos migracijos su grąžinimu apimtis:
  - atšaukti `anon` SELECT teisę į `library_items`;
  - `read_approved_library` taikyti tik rolei `authenticated`;
  - pridėti ribojančią SELECT politiką „Only active accounts read“ su `is_active_account()`.
- Vėliau prireikus viešos vitrinos ją galima daryti sąmoningai, per atskirą rodinį su atrinktais stulpeliais.

## Sprendimas

Pasirinkta B. CLASSROOM v1.0 skirtas patvirtintiems vedėjams. Biblioteka nėra suplanuota kaip vieša, o užuominų viešumas pedagogiškai kenkia. Naujas privatumo pranešimas (PR #112) sako, kad patvirtintus šablonus mato tik prisijungę vedėjai. Todėl migraciją siūloma taikyti prieš skelbiant pranešimą, t. y. iki CLASSROOM PILOT READY. Jei tuo metu bus patvirtinta ir CLS-011, abi migracijas galima taikyti viename lange.

## Testavimo kriterijai (B)

Automatiniai, įgyvendinti migracijos PR (1–5 `supabase/tests/security.sql` per `npm run test:db`, 6 `scripts/test-data-api.sh` CI):

1. `anon`: SELECT, INSERT, UPDATE ir DELETE į `library_items` grąžina teisių klaidą (42501).
2. Aktyvus vedėjas mato patvirtintus įrašus, autorius ir savo `pending_review` bei `rejected`, bet ne kitų nepatvirtintus.
3. Užblokuota ir `pending` paskyra, taip pat sesija be profilio, nemato nieko, įskaitant patvirtintus. Užblokuotas autorius nemato ir savo įrašų.
4. Administratorius ir super administratorius mato visus įrašus.
5. Schemos atspaudas atnaujintas tame pačiame PR, grąžinimas atkuria ankstesnę politiką ir `anon` teisę, pakartotinis taikymas pavyksta.
6. Per Data API (PostgREST): `anon` skaitymas, įrašymas ir trynimas grąžina 401; suklastotas JWT 401; aktyvus vedėjas, autorius, `pending`, `blocked`, administratorius ir super administratorius gauna tuos pačius rezultatus kaip 2–4.

Rankiniai po produkcijos taikymo:

7. `GET /rest/v1/library_items?select=id` su produkcijos `anon` raktu grąžina 401, ne sąrašą.
8. Vedėjo biblioteka, šablono peržiūra, „Naudoti šabloną“, „Mano pateikimai“, moderavimas ir administravimo skaičius veikia (CLS-004 scenarijaus E dalis).
9. `E2E smoke (production)` žalias.

## Kas dar laukia Vyčio

1. Peržiūrėti migracijos PR (jis lieka nesujungtas).
2. Atskiru leidimu taikyti migraciją produkcijoje pagal `docs/migration-history.md` ir tą pačią dieną sujungti PR.
