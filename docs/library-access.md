# Patvirtintos bibliotekos prieinamumas (CLS-015)

Analizė be DB pakeitimų. Politikos ir teisės patikrintos migracijose ir vietinėje Postgres 17 kopijoje po visų migracijų (2026-11-08). Šios kopijos schemos atspaudas, įskaitant teises ir RLS politikas, sutampa su produkcija, išskyrus `handle_new_user` (CLS-012). Produkcijoje užklausų nevykdyta.

## Dabartinė būsena

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

## Rekomendacija

B. CLASSROOM v1.0 skirtas patvirtintiems vedėjams. Biblioteka nėra suplanuota kaip vieša, o užuominų viešumas pedagogiškai kenkia. Migraciją siūlau taikyti tame pačiame produkcijos lange kaip CLS-011 (Sprint 008), kad būtų vienas atsarginės kopijos ir grąžinimo ciklas. Iki tada privatumo pranešimas teisingai sako, kad patvirtinti įrašai techniškai pasiekiami be prisijungimo. Pasirinkus B ir pritaikius migraciją, šį sakinį reikia pakeisti.

## Testavimo kriterijai (B)

Automatiniai (`npm run test:db`, `supabase/tests/security.sql`):

1. `anon`: SELECT iš `library_items` grąžina teisių klaidą (42501).
2. Aktyvus vedėjas mato patvirtintus įrašus ir savo `pending_review` bei `rejected`, bet ne kitų nepatvirtintus.
3. Užblokuotas ir `pending` vedėjas nemato nieko, įskaitant patvirtintus.
4. Administratorius ir super administratorius mato visus įrašus.
5. Schemos atspaudas atnaujintas tame pačiame PR, grąžinimas atkuria dabartinę politiką ir `anon` teisę, pakartotinis taikymas pavyksta.

Rankiniai po produkcijos taikymo:

6. `GET /rest/v1/library_items?select=id` su `anon` raktu grąžina klaidą, ne sąrašą.
7. Vedėjo biblioteka, šablono peržiūra, „Naudoti šabloną“, „Mano pateikimai“, moderavimas ir administravimo skaičius veikia (CLS-004 scenarijaus E dalis).
8. `E2E smoke (production)` žalias.

## Reikalingas Vyčio sprendimas

1. Pasirinkti A arba B.
2. Jei B: leisti paruošti migraciją su grąžinimu ir testais (repozitorijoje, be produkcijos), o taikyti produkcijoje tik atskiru patvirtinimu pagal `docs/migration-history.md` tvarką.
3. Jei A: patvirtinti, kurie stulpeliai vieši, ir kad pateikimo lange vedėjas bus informuotas apie viešumą.
