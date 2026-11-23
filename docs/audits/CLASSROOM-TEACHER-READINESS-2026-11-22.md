# KU STEAM CLASSROOM: pasirengimo ilgalaikiam mokytojų naudojimui auditas

Data: 2026-11-22. Auditavo: Claude Code. Tvirtina: Vytis Radvila.
Trumpa santrauka savininkui: [`CLASSROOM-TEACHER-READINESS-2026-11-22-SANTRAUKA.md`](CLASSROOM-TEACHER-READINESS-2026-11-22-SANTRAUKA.md).

Šiame PR nėra produkto kodo, migracijų ar konfigūracijos pakeitimų. Produkcijoje nieko nerašyta, nekurta ir nekeista.

## 1. Executive summary

**Išvada: CONDITIONAL GO.**

- Šiandien platformos dar negalima be apribojimų atverti ilgalaikiam mokytojų naudojimui.
- Ją galima atverti nedidelei kontroliuojamai mokytojų grupei, kai bus įvykdytos A sąlygos (15 skyrius). Platesnis prijungimas galimas tik įvykdžius B sąlygas.
- P0 radinių nerasta. Nerasta kelio, kuriuo dalyvis gautų atsakymus ar kitų komandų žetonus, kuriuo mokytojas pakeistų savo vaidmenį, ar kuriuo slaptas raktas patektų į naršyklę.

Kodėl ne GO:

1. **Mokytojų turinio izoliacija turi vieną įrodytą spragą (R-01, P1).** Aktyvus mokytojas gali pateikti bibliotekos įrašą, kuris rodo į kito mokytojo veiklą. Administratoriui jį patvirtinus, kopijavimas perkelia svetimos veiklos atsakymų maišas ir paaiškinimus. Įrodyta kode ir izoliuotoje DB.
2. **Atkūrimas iš atsarginės kopijos niekada nebandytas (R-02, P1).** PITR išjungtas, kopijų saugojimo trukmė nepatikrinta, visi trynimai yra negrįžtami.
3. **Dalyvių įrenginiai gali krauti Google Maps ir bet kurio išorinio serverio paveikslėlius (R-03, P1).** Privatumo pranešimas teigia, kad Google naudojamas tik vedėjo prisijungimui.
4. **Viskas priklauso nuo vieno žmogaus asmeninių paskyrų (R-04, P1).** Nėra antro asmens su prieiga, nėra įspėjimų, nėra incidentų tvarkos.
5. **Trys esminiai keliai faktiškai neišbandyti:** registracija su tikra mokytojo paskyra produkcijoje (CLS-004), pamoka su tikrais telefonais (CLS-002), integruotas automatinis pamokos scenarijus.

Kas patikrinta ir veikia:

- Vietiniai testai žali: `tsc`, `lint` (0 klaidų), 395 vienetiniai testai, `test:db` su PostgreSQL 17.12, `build`.
- Produkcija: Vercel diegimas `READY` iš `255f7ac`, per 7 dienas nėra runtime klaidų, visi keturi GitHub Actions darbai žali.
- DB saugumo testai (830 eilučių `security.sql`) patvirtina RLS, stulpelių teises, `pending` ir `blocked` rašymo draudimą, dalyvio duomenų uždarymą.

Svarbiausias audito apribojimas: **Supabase MCP prieiga prie projekto `menmndjyfeuwfweubwnl` šiai sesijai neleista** (`You do not have permission to perform this action`). Todėl produkcijos DB būsena, Security ir Performance Advisor, Auth nustatymai, Storage ir kopijos tiesiogiai netikrinti. Šie punktai pažymėti BLOCKED su tiksliomis užklausomis (16 skyrius).

## 2. Produkcijos ir GitHub bazinės būsenos atspaudas

| Kas | Reikšmė | Šaltinis |
| --- | --- | --- |
| `origin/main` | `255f7acbbce314c4b9d3498d3d831a52cc4d5fc5` (sutampa su nurodytu) | `git fetch`, 2026-11-22 |
| Vercel produkcija | `dpl_9rnySUjJytapxvQqFp4GNaXGzBt9`, `READY`, iš `255f7ac`, sukurtas 2026-11-11 06:46 UTC | Vercel MCP |
| Vercel runtime klaidos, 7 d. | nėra | Vercel MCP `get_runtime_errors` |
| Ekosistemos dokumentai | `kusteam-ai-lab` `fe7217b` (2026-11-18) | klonas |
| Aktyvus sprintas | TEAM Sprint 2; šis auditas atliekamas Vyčio prašymu pokalbyje | `SPRINTS.md` |
| Supabase produkcija | tiesiogiai nepatikrinta (prieiga neleista) | Supabase MCP klaida |
| Paskutinis užrašytas produkcijos schemos atspaudas | 2026-11-09 apie 21:18 UTC, po TEAM-006 | `docs/migration-history.md:322` |

Vercel produkcijos aplinkos kintamieji (tik metaduomenys, reikšmės neskaitytos):

| Kintamasis | Būsena | Pastaba |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | tik Production, tipas `encrypted`, Vercel žyma `readable-secret` | OPS-002 atlikta iš dalies |
| `ANTHROPIC_API_KEY` | tik Production, tipas `encrypted`, `readable-secret` | OPS-002 atlikta iš dalies |
| `CRON_SECRET` | `sensitive`, sukurtas 2026-11-07, nuo tada nekeistas | OPS-001 neatlikta |
| `RESEND_API_KEY` | `sensitive`, yra | laiškų siuntimas sukonfigūruotas |
| `TEAM_SSO_ENABLED` | `1` | TEAM prisijungimas įjungtas |
| `CANONICAL_CLASSROOM_HOST` | `pamokos.kusteam.app` | |
| `RETENTION_MODE` | **nėra** | kodas veikia `report` režimu (patvirtinta) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | **nėra** | greičio ribos tik serverio atmintyje (R-20) |
| `REJOIN_SECRET`, `TEAM_SSO_FLOW_SECRET` | **nėra** | abu išvedami iš service role rakto (`lib/game/rejoin-token.ts:7`, `lib/team-sso/crypto.ts:33`) |

GitHub Actions, paskutinis sėkmingas vykdymas:

| Darbas | Vykdymas | Laikas (UTC) | Commit |
| --- | --- | --- | --- |
| CI | [#358](https://github.com/vyttis/kusteam-classroom/actions/runs/42974743053) | 2026-11-11 06:46 | `255f7ac` |
| Database | [#85](https://github.com/vyttis/kusteam-classroom/actions/runs/42695922752) | 2026-11-09 20:45 | `4d41564` (vėliau `supabase/**` ir DB scenarijai nekeisti, patikrinta `git diff`) |
| E2E smoke (production) | [#357](https://github.com/vyttis/kusteam-classroom/actions/runs/45028136296) | 2026-11-22 13:33 | `255f7ac` |
| Scheduled tests | [#38](https://github.com/vyttis/kusteam-classroom/actions/runs/45017050855) | 2026-11-22 11:23 | `255f7ac` |

## 3. Audito apimtis

Atlikta:

- Perskaityti `AGENTS.md`, `README.md`, visi `docs/` failai, `supabase/tests/security.sql`, ekosistemos `ECOSYSTEM.md`, `SPRINTS.md`, `BACKLOG.md`, `STATUS.md`, `MILESTONES.md`.
- Vietoje paleisti `npm ci`, `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`, `npm run test:e2e`.
- Keturios lygiagrečios nepriklausomos kodo peržiūros (saugumas; mokytojo kelias ir DI; pamokos vedimas ir dalyvis; privatumas, saugojimas, eksploatavimas ir prieinamumas). Jų svarbiausi radiniai pakartotinai patikrinti kode, o trys patikrinti izoliuotoje DB.
- Trys papildomi DB bandymai izoliuotoje PostgreSQL 17.12 su sintetiniais duomenimis (`docs/audits/evidence/*.sql`).
- Vietinis prieinamumo ir mobilaus vaizdo bandymas: surinkta programa su fiktyviais raktais, be ryšio su produkcija, axe-core 5 viešuose puslapiuose trimis pločiais.
- Vercel būsena, klaidos ir aplinkos kintamųjų metaduomenys; GitHub Actions istorija.

Neatlikta ir kodėl:

| Kas | Priežastis | Žyma |
| --- | --- | --- |
| Produkcijos DB, Advisor, Auth, Storage, kopijų patikra | Supabase MCP prieiga neleista | BLOCKED |
| Vietinis `test:e2e` | šios aplinkos tinklas nepasiekia `*.kusteam.app` (proxy 403); 22 iš 22 krito dėl tinklo | BLOCKED vietoje, CI žalias |
| `scripts/test-data-api.sh` vietoje | reikia Docker arba PostgREST dvejetainio failo; jo atsisiųsti neleido aplinkos saugumo taisyklė | BLOCKED vietoje, CI žalias |
| Integruotas pamokos scenarijus veikiančioje programoje | reikia izoliuoto Supabase (Auth, PostgREST, Realtime); šioje aplinkoje nėra Docker | NOT TESTED |
| Apkrovos bandymas | ta pati priežastis; produkcijoje draudžiama | NOT TESTED |
| Registracija produkcijoje su T1 ir T2 | reikia atskiro leidimo ir bandymų lango (`REGISTRATION-TEST.md`) | NOT TESTED |
| Tikri įrenginiai, projektorius, mokyklos Wi-Fi | nėra fizinių įrenginių | NOT TESTED |
| Atkūrimas iš kopijos | nėra prieigos prie Supabase | NOT TESTED |
| Mokami DI kvietimai | draudžiama | NOT TESTED |

Pastaba apie aplinką: šioje mašinoje buvo tik PostgreSQL 16, todėl `test:db` paleistas su PostgreSQL 17.12 dvejetainiais failais iš npm paketo `@embedded-postgres/linux-x64`, įdiegtais už repozitorijos ribų. Repozitorijos priklausomybės nekeistos.

## 4. Atliktų testų matrica

Žymos: PASS (faktiškai paleista ir praėjo), FAIL, BLOCKED (negalėjo būti paleista dėl prieigos), NOT TESTED. „Kodo peržiūra“ nėra PASS: ji žymima CODE OK arba CODE GAP ir reiškia tik tai, kad kelias perskaitytas kode.

### 4.1 Automatinės patikros

| ID | Scenarijus | Pr. | Laukiama | Faktiškai | Žyma | Įrodymas | Radinys |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-01 | `npm ci` | P1 | be klaidų | be klaidų | PASS | vietinis vykdymas | |
| T-02 | `npx tsc --noEmit` | P1 | 0 klaidų | 0 klaidų | PASS | vietinis vykdymas | |
| T-03 | `npm run lint` | P2 | 0 klaidų | 0 klaidų, 24 įspėjimai | PASS | vietinis vykdymas | |
| T-04 | `npm test` | P1 | visi žali | 51 failas, 395 testai žali | PASS | vietinis vykdymas | |
| T-05 | `npm run test:db`, PG 17.12 | P1 | migracijos, atspaudas, saugumas, grąžinimas | 37 migracijos; atspaudas sutampa; `security checks passed`; CLS-011, TEAM-001, TEAM-006 pasiūlymai praėjo; grąžinimas ir pakartotinis taikymas praėjo | PASS | vietinis vykdymas | |
| T-06 | `scripts/test-data-api.sh` | P2 | anon 401, rolės pagal lentelę | vietoje nepaleista | BLOCKED | CI Database #85 žalias | |
| T-07 | `npm run build` | P1 | sėkmingas | sėkmingas | PASS | vietinis vykdymas | |
| T-08 | `npm run test:e2e` vietoje | P1 | 22 žali | 22 krito dėl tinklo (proxy 403) | BLOCKED | CI E2E #357 žalias 2026-11-22 | |
| T-09 | `npm audit` | P2 | produkcinėse 0 | produkcinėse 0; kūrimo įrankiuose 7 vidutiniai | PASS | vietinis vykdymas | OPS-007 |
| T-10 | axe-core, WCAG 2.2 AA, 5 vieši puslapiai, 3 pločiai | P2 | 0 pažeidimų | 0 pažeidimų; nėra horizontalaus slinkimo; `lang="lt"` | PASS | vietinis vykdymas | R-19 (ko axe nemato) |

### 4.2 Mokytojo kelias

| ID | Scenarijus | Pr. | Laukiama | Faktiškai | Žyma | Įrodymas | Radinys |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M-01 | Paskyros prašymas | P1 | pateikiamas tik su nuoroda ar QR, validuojamas | kelias pilnas; viešos formos nėra (`/prasymas` be žetono 404) | CODE OK, produkcijoje NOT TESTED | `lib/access/requests.ts:54-135` | |
| M-02 | Prašymo patvirtinimas | P1 | tik super administratorius, be dvigubo patvirtinimo | kelias pilnas | CODE OK, NOT TESTED | `app/api/admin/access-requests/[id]/route.ts:60-99` | R-06 |
| M-03 | Kvietimo laiškas pasiekia mokytoją | P1 | laiškas gautas | niekada neišbandyta su tikru adresu | NOT TESTED | `REGISTRATION-TEST.md`: „nevykdytas“ | R-06 |
| M-04 | Prisijungimas el. pašto kodu, neteisingas ir pasibaigęs kodas | P1 | aiškus pranešimas | vienas pranešimas abiem atvejams, nėra „siųsti dar kartą“ | CODE GAP, NOT TESTED | `app/auth/login/login-form.tsx:91-137` | R-16 |
| M-05 | Prisijungimas per Google, nepatvirtinta paskyra | P1 | prieigos nėra | priklauso nuo Supabase nustatymo „signups disabled“ | BLOCKED | reikia Auth nustatymų | R-09 |
| M-06 | Profilio užpildymas, privatumo pranešimas | P1 | privaloma, įrašoma | veikia; įrašomas tik laikas, be pranešimo versijos | CODE OK, NOT TESTED | `app/api/onboarding/route.ts:24-52` | R-18 |
| M-07 | Pakartotinis prisijungimas, naujas įrenginys, atsijungimas | P2 | veikia | veikia; atsijungimas nutraukia visų įrenginių sesijas | CODE OK, NOT TESTED | `teacher-nav.tsx:61` | R-16 |
| M-08 | Paskyros blokavimas: rašymas | P1 | iškart draudžiamas | draudžiamas | PASS | T-05, `security.sql:211-237, 636-653` | |
| M-09 | Paskyros blokavimas: skaitymas ir sesija | P1 | prieigos nelieka | sesija lieka; per Data API mato savo veiklas, komandas, atsakymus | FAIL | `evidence/blocked-read-probe.sql`: `1,1,1,1,1` | R-05 |
| M-10 | Nepatvirtinta paskyra negali kurti | P1 | draudžiama | draudžiama; nemato nieko, išskyrus savo profilį | PASS | T-05; probe `0,0,1,0,0` | |
| M-11 | Pamokos plano kūrimas | P1 | galima sukurti | tik per DI generavimą, rankinio kelio nėra | CODE GAP | `lesson-plan-generator.tsx:292-340` | R-15 |
| M-12 | Išsaugoto plano redagavimas, perkrovimas | P1 | darbas neprarandamas | nėra nei juodraščio, nei įspėjimo išeinant | CODE GAP | `lesson-plan-detail.tsx:150-180` | R-14 |
| M-13 | Rankinė užduotis, užuominos, paveikslėlis, atsakymai | P1 | išsaugoma, klaidos atveju forma lieka | veikia; įspėjimas išeinant yra | CODE OK, NOT TESTED | `manual-task-editor.tsx:172-173, 349-357` | |
| M-14 | Eiliškumas, užduoties ir veiklos kopijavimas | P2 | išlieka | veikia; dalinė kopijavimo klaida rodoma kaip sėkmė | CODE OK su spraga | `duplicate/route.ts:157-162` | R-16 |
| M-15 | Veiklos pašalinimas | P2 | su patvirtinimu | negrįžtamas, kaskaduoja; UI leidžia tik juodraščiams, API bet kuriai būsenai | CODE OK su spraga | `games/[gameId]/route.ts:223-244` | R-16 |
| M-16 | Tuščių ir ilgų laukų validacija | P2 | ribos visur | kuriant ribos yra; atnaujinant užduotį ilgio ribų nėra | CODE GAP | `challenges/[challengeId]/route.ts:12-41` | R-21 |
| M-17 | DI: limitai, biudžetas, apskaita | P1 | limitas prieš mokamą kvietimą | atominė rezervacija DB prieš kvietimą; mėnesio limitas ir platformos biudžetas | CODE OK, T-04 dalinai | `lib/ai/usage.ts:223-311`, `tests/ai-limits.test.ts` | R-20 |
| M-18 | DI atsakymą patvirtina mokytojas | P1 | be patvirtinimo veikla neprasideda | prasideda, jei DI tikrintojas neatmetė | CODE GAP | `convert/route.ts:136-159`, `game-builder.tsx:348-370` | R-07 |
| M-19 | DI neveikia: rankinis kūrimas | P1 | veikia | užduotims veikia; planams ne | CODE GAP | `di/generate/route.ts:87-92` | R-15 |
| M-20 | DI: mokinių duomenys į Anthropic | P1 | nesiunčiami | nesiunčiami; DI kviečiamas tik iš vedėjo maršrutų | CODE OK | `lib/ai/prompt.ts`, maršrutai `di/*`, `lesson-plans/*`, `import/process` | |
| M-21 | DI: mokamas kvietimas produkcijoje | P1 | veikia | nevykdyta (draudžiama) | NOT TESTED | | |

### 4.3 Pamokos vedimas ir dalyvis

| ID | Scenarijus | Pr. | Laukiama | Faktiškai | Žyma | Įrodymas | Radinys |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L-01 | Būsenų mašina, pradėjimas, pauzė, pratęsimas | P1 | tik leidžiami perėjimai, laikas sustoja | priverčiama DB trigeriu ir funkcijomis | PASS | T-05, `security.sql:353-540` | |
| L-02 | Veikla be užduočių ar be atsakymo neprasideda | P1 | atmetama | atmetama | PASS | T-05, `security.sql:358, 542-596` | |
| L-03 | Dalyvis negauna atsakymų, neatvertų užuominų, svetimų žetonų | P0 | negauna | negauna | PASS | T-04 (`player-hints`, `leaderboard`), T-05 (`security.sql:56-84, 150-186`) | |
| L-04 | `anon` raktas neskaito žaidimo lentelių | P0 | 42501 | 42501 | PASS | T-05, `security.sql:153-186` | |
| L-05 | Dvigubas teisingas atsakymas taškų nedvigubina | P1 | vienas įskaitymas | unikalus indeksas ir 23505 apdorojimas | CODE OK, veikiančioje programoje NOT TESTED | `00018:96`, `submissions/route.ts:273-281` | R-13 |
| L-06 | QR kodas, prisijungimas kodu, komandos kūrimas | P1 | veikia | kelias pilnas; komandos kūrimas neidempotentiškas | CODE OK su spraga, NOT TESTED | `app/api/teams/route.ts:117-158` | R-10 |
| L-07 | Neteisingi ir teisingi atsakymai, taškai, užuominos | P1 | veikia | normalizavimas, alternatyvos, baudos testuotos vienetiniais testais | PASS (logika), maršrutas NOT TESTED | T-04: `answer-hasher` (38), `scoring`, `accepted-answers` | R-13 |
| L-08 | Lyderių lentelė | P2 | atsinaujina per 4 s | rodomi tik id, pavadinimas, taškai | CODE OK, NOT TESTED | `lib/game/leaderboard.ts:48-70` | |
| L-09 | Vedėjo pranešimas pasiekia dalyvį | P2 | pasiekia | tik 2 min. langas ir 15 s rodymas; užrakintas telefonas nepamatys | CODE GAP | `play/status/route.ts:7,44-49` | R-11 |
| L-10 | Užduotis pridedama vykstant veiklai | P2 | dalyvis gauna | gauna per vieną užklausų ciklą | CODE OK, T-04 dalinai | `tasks-version.test.ts`, `live-edit.test.ts` | R-13 |
| L-11 | Dalyvis perkrauna naršyklę, grįžta į komandą | P1 | grįžta | grįžta, jei žetonas liko; klaidos ekrano mygtukas žetoną ištrina be patvirtinimo | CODE GAP | `play-screens.tsx:38-45`, `play/page.tsx:775-778` | R-10 |
| L-12 | Grįžimas iš naujo įrenginio | P1 | per vedėjo nuorodą | veikia; nuoroda 10 min. daugkartinė | CODE OK su spraga | `lib/game/rejoin-token.ts` | R-13 |
| L-13 | Veiklos pabaiga, automatinis užbaigimas | P1 | baigiasi | rankinis veikia; laiko riba yra kiekvienos komandos atskirai, veikla pati nesibaigia iki nakties | CODE GAP | `submissions/route.ts:188-197`, `lib/game/stale.ts` | R-12 |
| L-14 | Refleksijos, rezultatai, CSV | P2 | veikia, CSV saugus | BOM, `;`, formulių ekranavimas | PASS (CSV logika), kita NOT TESTED | T-04 `csv.test.ts`, `detailed-stats.test.ts` | |
| L-15 | Vedėjo ekranas po ryšio nutrūkimo | P1 | duomenys teisingi | po pakartotinio prisijungimo duomenys neperkraunami | CODE GAP | `hooks/use-live-game.ts:164-173` | R-11 |
| L-16 | Visas integruotas scenarijus 1–20 | P1 | praeina | automatinio nėra; vienintelis rankinis 2026-11-08 super administratoriaus paskyra vienu įrenginiu | NOT TESTED šiame audite | `STATUS.md:25` | R-17 |
| L-17 | iPhone Safari, Android Chrome, Edge, planšetė, projektorius, mokyklos Wi-Fi, QR kamera, užrakintas ekranas | P1 | veikia | nėra fizinių įrenginių | NOT TESTED | protokolas 16 skyriuje | CLS-002 |

### 4.4 Saugumas

| ID | Scenarijus | Pr. | Laukiama | Faktiškai | Žyma | Įrodymas | Radinys |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-01 | Mokytojas nemato kito mokytojo veiklų per Data API | P0 | 0 eilučių | 0 eilučių | PASS | T-05, `security.sql:56-84` | |
| S-02 | Mokytojas nemato kito mokytojo veiklų per API maršrutus | P0 | 404 arba 403 | visi maršrutai filtruoja `teacher_id` naudotojo klientu | CODE OK | `games/[gameId]/route.ts:44,89,168,238` ir kt. | |
| S-03 | Bibliotekos įrašas su svetimos veiklos šaltiniu | P1 | atmetamas | priimamas; kopijavimas su service role perkelia atsakymus ir paaiškinimus | FAIL | `evidence/library-and-admin-probe.sql`: `1`; `lib/library/source-answers.ts:70-86` | R-01 |
| S-04 | Mokytojas nekeičia savo vaidmens ir būsenos | P0 | draudžiama | draudžiama | PASS | T-05, `security.sql:87-97` | |
| S-05 | Administratorius neturi super administratoriaus teisių (API) | P1 | 403 | super administratoriaus maršrutai tikrina vaidmenį serveryje | CODE OK | `lib/access/admin-guard.ts` | |
| S-06 | Administratorius negali perimti svetimos veiklos (Data API) | P2 | draudžiama | leidžiama: `teacher_id` pakeičiamas | FAIL | `evidence/library-and-admin-probe.sql`: `t`; `00002:29` | R-08 |
| S-07 | TEAM darbuotojas neapeina TEAM kontrolės | P1 | be TEAM sesijos prieigos nėra | RESTRICTIVE politikos 16 lentelių ir `storage.objects` | PASS | T-05 (`TEAM-006 verify OK`, `uncovered 0`) | |
| S-08 | SECURITY DEFINER funkcijos: `search_path`, EXECUTE | P1 | prisegtas, tik reikalingos rolės | atitinka | PASS | T-05, schemos atspaudas `grant.function` | |
| S-09 | `get_my_role()`, `handle_new_user()` Advisor įspėjimai | P2 | nėra išnaudojimo | žr. 7.3 | CODE OK, produkcijoje BLOCKED | | R-09 |
| S-10 | Storage: viešumas, tipai, dydžiai, kelias | P2 | pagal migracijas | `challenge-images` viešas skaitymui, tik paveikslėliai, 5 MB, rašoma tik į savo aplanką | PASS (migracijos), produkcijoje BLOCKED | T-05, `security.sql:60-62` | R-18 |
| S-11 | Slapti raktai naršyklėje | P0 | nėra | tik keturi `NEXT_PUBLIC_*`; admin klientas neimportuojamas iš kliento failų | CODE OK | `grep`, `tests/leaderboard.test.ts` | |
| S-12 | Cron autorizacija | P1 | be rakto 503, neteisingas 401 | atitinka | CODE OK | `cron/finish-stale-activities/route.ts:40` | R-21 |
| S-13 | Greičio ribojimas | P2 | veikia tarp serverio egzempliorių | tik atmintyje, nes KV nenustatytas | CODE GAP | Vercel env; `lib/ai/rate-limit.ts:42-54` | R-20 |
| S-14 | Produkcijos schema lygi repozitorijai | P1 | sutampa | paskutinis užrašas 2026-11-09; šiandien nepatikrinta | BLOCKED | `migration-history.md:322` | R-09 |

## 5. Mokytojo kelio rezultatai

**Registracija ir prisijungimas.** Kode kelias pilnas: prašymas pateikiamas tik su vedėjo nuoroda ar QR, tvirtina tik super administratorius, paskyra sukuriama per `auth.admin.createUser`, mokytojui siunčiamas lietuviškas laiškas su vienu mygtuku per Resend. Tačiau su tikra mokytojo paskyra produkcijoje šis kelias dar nė karto nepraeitas (`REGISTRATION-TEST.md`: „nevykdytas“). Kol to nėra, negaliu patvirtinti, kad laiškas pasiekia mokyklų pašto dėžutes ir kad Google prisijungimas elgiasi teisingai.

Rastos spragos:

- Patvirtinimas visada atsako „Kvietimas išsiųstas“, nors laiškas siunčiamas po atsakymo ir jo klaida tik įrašoma į žurnalą (R-06).
- `docs/access-and-email.md` ir `REGISTRATION-TEST.md` B1 žingsnis aprašo seną Supabase kvietimą; kodas jo nebenaudoja.
- Neteisingas ir pasibaigęs kodas rodo tą patį pranešimą, pakartotinio siuntimo mygtuko nėra (R-16).
- Blokavimas sustabdo rašymą iškart, bet sesijos nenutraukia ir skaitymo neuždaro (R-05).

**Pamokų kūrimas.** Automatinio išsaugojimo nėra niekur: viskas išsaugoma mygtuku. Rankinės užduoties redaktorius ir plano generatorius turi įspėjimą išeinant, generatorius dar ir 7 dienų juodraštį naršyklėje. Darbas gali dingti dviejose vietose:

- redaguojant jau išsaugotą planą (nėra nei įspėjimo, nei juodraščio) (R-14);
- puslapyje `/games/[id]/lesson`, kur nepavykusios užduotys tyliai praleidžiamos, o pranešimas rodo sėkmę (R-14).

Atsakymai saugomi tik kaip bcrypt maišos. Mokytojas savo atsakymo vėliau nebepamato, gali tik pakeisti. Tai saugu, bet mokytojui reikia tai paaiškinti.

**DI pagalba.** Mokinių duomenys į Anthropic nesiunčiami. Limitai tikrinami prieš mokamą kvietimą atomine rezervacija DB. Klaidos lietuviškos. DI turinys niekur nerodomas kaip HTML. Spragos:

- DI pasiūlytas atsakymas gali tapti galiojančiu be aiškaus mokytojo patvirtinimo (R-07). Tai prieštarauja `AGENTS.md` taisyklei „teisingą atsakymą visada patvirtina vedėjas“.
- Pamokos plano be DI sukurti negalima (R-15).
- Dvigubo paspaudimo apsauga yra tik naršyklėje; serveryje idempotentiškumo nėra. Rezervacija riboja žalą iki mėnesio limito.
- Įkelto dokumento tekstas į užklausą dedamas tik tarp `---`, be nurodymo laikyti jį nepatikimais duomenimis. Rizika ribota: rezultatas tikrinamas zod schema ir peržiūrimas mokytojo (R-21).
- Naudojami modeliai `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` veikia, bet nėra naujausios kartos; SDK laiko riba (600 s) ilgesnė už maršrutų `maxDuration` (R-21).

## 6. Mokinio kelio rezultatai

Architektūros taisyklės laikomasi: dalyvio puslapiai Supabase naršyklėje nenaudoja, atsakymai tikrinami tik serveryje, dalyviui siunčiami tik saugūs laukai. Tai patvirtina ir vienetiniai, ir DB testai.

Iš dalyvio renkamas tik komandos pavadinimas (iki 30 ženklų), atsakymai, užuominų naudojimas ir refleksijos tekstas. Narių vardai nerenkami. Pagalbinis tekstas prašo nerašyti tikrų vardų, bet tai nepriverčiama.

Silpniausia vieta yra atsparumas blogam ryšiui, o būtent tai pilotas ir turi patikrinti:

- Klaidos ekrane mygtukas „Prisijungti iš naujo“ be patvirtinimo ištrina komandos žetoną. Trumpas Wi-Fi sutrikimas ir vienas paspaudimas, ir komanda nebegali grįžti, o jos pavadinimas užimtas (R-10).
- Jei atsakymas į komandos sukūrimą prarandamas, komanda DB yra, bet įrenginys žetono neturi (R-10).
- Dalyvis nemato, kad ryšys dingo: laikmatis eina toliau, užklausų klaidos tylios (R-11).
- Pranešimas rodomas 15 s ir serveryje galioja 2 min. Užrakintas telefonas jo nepamatys (R-11).
- Projektoriaus laikmatis skaičiuojamas nuo veiklos pradžios, o kiekvienos komandos laikas nuo jos pačios starto (R-12).

## 7. Saugumo išvados

### 7.1 Kas laikosi

- Mokytojų izoliacija per Data API ir per visus API maršrutus su identifikatoriais.
- Savo vaidmens, būsenos, el. pašto ir DI limito mokytojas pakeisti negali (stulpelių teisės ir testai).
- `pending` ir `blocked` paskyros nerašo; `pending` nemato nieko, išskyrus savo profilį.
- Dalyvis negauna `answer_hash`, `accepted_answer_hashes`, neatvertų užuominų, paaiškinimo iki teisingo atsakymo ir kitų komandų `session_token`.
- Dvigubas įskaitymas užkirstas unikaliu indeksu.
- Komandos žetonas: 32 ženklai iš kriptografinio generatoriaus. Grįžimo žetonas: HMAC, pastovaus laiko palyginimas, 10 min., URL fragmente.
- Įkėlimai: tipų sąrašas be SVG ir HTML, serverio parinktas vardas, 4 MB, tik į savo aplanką.
- Cron be rakto neveikia; prisijungimo grįžimo adresas atmeta išorinius adresus.
- TEAM darbuotojo prieiga: RESTRICTIVE politikos, `team_staff_access_ok()` reikalauja susietos TEAM sesijos.

### 7.2 Radiniai

Išsamiai 12 skyriuje: R-01 (P1), R-05, R-08, R-09, R-20, R-21.

### 7.3 Keturi iš anksto nurodyti Supabase klausimai

**1. `get_my_role()` ir `handle_new_user()` Security Advisor įspėjimai.** Advisor produkcijoje nepaleistas (BLOCKED). Pagal migracijas:

- `get_my_role()` yra SECURITY DEFINER su prisegtu `search_path`, ją gali kviesti `PUBLIC`. Ji grąžina tik kviečiančiojo vaidmenį, o neaktyviai paskyrai `teacher`; anonimui `NULL`. Neautorizuoto veiksmo nerandu. Tai ne pažeidžiamumas. Galima uždaryti `anon` vykdymo teisę, kad įspėjimas dingtų, bet prieš tai reikia patikrinti, ar jos nenaudoja politikos, vertinamos `anon` rolei.
- `handle_new_user()` grąžina `trigger`, per RPC jos iškviesti negalima. Pats įspėjimas nėra pažeidžiamumas.

**2. Produkcijos `handle_new_user()` taisyklė pagal el. pašto adresą (CLS-011).** Pagal `docs/migration-history.md:29-33` produkcijoje funkcija pakeista ranka: naujam naudotojui su vienu asmeniniu Gmail adresu įrašomas `super_admin`. Repozitorijoje šios logikos nėra. Vertinimas:

- Tiesioginio išnaudojimo nerandu. Taisyklė veikia tik kuriant naują `auth.users` eilutę su tuo adresu, paskyra lieka `pending`, o `get_my_role()` neaktyviai paskyrai grąžina `teacher`.
- Rizika yra latentinė: jei tokia paskyra būtų sukurta ir kas nors ją patvirtintų, ji taptų `super_admin` be įrašo `admin_audit_log`. Tai priklauso nuo vieno išorinio pašto paskyros saugumo.
- Dėl šios funkcijos schemos atspaudo `function` sritis produkcijoje niekada nesutampa su repozitorija, todėl kitų funkcijų pakeitimai matomi tik detaliu režimu.
- Vertinu P2 (R-09). Sprendimas jau paruoštas ir ištestuotas (`supabase/proposals/cls-011-handle-new-user`, T-05 praėjo).

**3. `supabase_migrations.schema_migrations` turi 0 įrašų (CLS-005).** Tai žinoma ir dokumentuota: migracijos taikomos ranka per SQL Editor. Kompensuojanti kontrolė yra schemos atspaudas, kuris izoliuotoje PG 17 sutampa su laukiamu (T-05). Rizikos:

- `supabase db push` bandytų taikyti viską iš naujo. Tai apsaugo tik dokumentas ir žmogaus atmintis.
- TEAM-006 pritaikytas produkcijoje 2026-11-09, bet jo failai vis dar `supabase/proposals/team-006-sso/`, ne `supabase/migrations/`. Todėl šiandien `supabase/migrations` neatkuria produkcijos schemos. Tai svarbu atkūrimo bandymui (R-02).
- Vertinu P2 (R-09), ne pažeidžiamumas.

**4. Performance Advisor: RLS funkcijų efektyvumas ir kelios permissive politikos.** Advisor nepaleistas (BLOCKED). Pagal kodą dalyvių užklausos eina per service role ir RLS nevertina, todėl šie įspėjimai liečia tik vedėjo ir administratoriaus užklausas, kurių apimtis maža. Dabartiniam mastui (dešimtys mokytojų) tai P3. Prieš optimizuojant reikia `EXPLAIN ANALYZE` su realia apimtimi; politikų apjungimas keičia saugumo logiką ir turi eiti per `test:db`.

## 8. Duomenų apsauga

### 8.1 Privatumo pranešimas ir faktinis tvarkymas

Pranešimas `/privatumas` iš esmės sąžiningas: jis aiškiai sako, kad automatinio trynimo pagal terminą šiuo metu nėra. Tvarkytojai (Supabase, Vercel, Resend, Anthropic, Google prisijungimui) sutampa su kodu. Analitikos ir trečiųjų šalių scenarijų nėra, šriftai talpinami vietoje.

Neatitikimai:

| Kas | Kode | Pranešime | Radinys |
| --- | --- | --- | --- |
| Google Maps iframe dalyvio įrenginyje | kraunamas automatiškai, jei užduotis turi žemėlapio nuorodą (`components/shared/maps-embed.tsx:80-93`, `linear-task.tsx:114`) | „prisijungimą atlieka Google“, „Analitikos ir reklamos slapukų nėra“ | R-03 |
| Išoriniai paveikslėliai | `image_url` priima bet kurį https adresą | neminima | R-03 |
| Administratoriai mato visų veiklų rezultatus | `can_read_game`, administratorių politikos | „Vedėjas mato savo veiklų rezultatus“ | R-18 |
| `profiles.avatar_url` (Google nuotrauka), `profiles.phone` stulpelis | saugoma | neminima | R-18 |
| IP adresas | tik HMAC atmintyje greičio ribojimui; Supabase Auth saugo savo sesijų duomenis | kategorija neįvardyta | R-18 |

### 8.2 Gyvavimo ciklas

- **Eksportas.** Mokytojas eksportuoja CSV vienai veiklai: rezultatus, užduočių statistiką, refleksijas. Savo sukurto turinio ir paskyros duomenų eksporto nėra.
- **Paskyros šalinimas.** Programoje paskyrą galima tik užblokuoti. Šalinama ranka Supabase skydelyje. Kaskada: profilis, veiklos ir planai, užduotys ir komandos, atsakymai, užuominos, refleksijos. Bibliotekos įrašai, DI apskaita ir žurnalas lieka be autoriaus.
- **Baigtos veiklos.** UI leidžia trinti tik juodraščius; baigtos veiklos per sąsają ištrinti negalima.
- **Dalyvio prašymas ištrinti.** `docs/data-retention.md` sako, kad vedėjas pašalina komandą veiklos puslapyje, bet maršrutas tai leidžia tik vykstančiai ar pristabdytai veiklai (`games/[gameId]/teams/[teamId]/route.ts:13,79`). Baigtai veiklai lieka tik visos veiklos trynimas arba SQL (R-18).
- **Įkeltos bylos.** Importuoti dokumentai šiandien netrinami (trynimas įsijungia tik `delete` režimu). Užduočių paveikslėliai viešame kibire netrinami niekada, net ištrynus užduotį, veiklą ar paskyrą (R-18).

### 8.3 Saugojimo terminai ir `RETENTION_MODE`

Patvirtinta trimis šaltiniais: Vercel produkcijoje `RETENTION_MODE` nėra; `lib/retention.ts:37-40` grąžina `delete` tik tiksliai eilutei `delete`; testas tai saugo. Taigi naktinis darbas tik skaičiuoja.

Kaip veikia `delete` režimas: tame pačiame naktiniame cron (02:00 UTC) penki nuoseklūs žingsniai (prašymai, komandos, DI apskaita, žurnalas, importo failai), kiekvienas atskira užklausa be bendros transakcijos. Liečiamos tik komandos tų veiklų, kurių `status = finished` ir `finished_at` senesnis už ribą. Veiklos, užduotys, planai, biblioteka ir vykstančios veiklos neliečiami. Atkūrimas įmanomas tik iš atsarginės kopijos.

Spragos (R-22): `report` režimo rezultatas rašomas tik į Vercel žurnalą, kuris saugomas trumpai; kodas neapima laukiančių prašymų, `request_links` ir paveikslėlių; pirmas vidinis terminas 2027-02-04.

**Saugi įjungimo tvarka (nevykdyta, reikia atskiro leidimo):**

1. Pirmiausia užbaigti atkūrimo bandymą (R-02) ir įsitikinti, kad paskutinė kopija jaunesnė nei 24 val.
2. Įsitikinti, kad nėra vykstančių ar pristabdytų veiklų.
3. Paleisti ataskaitos užklausą iš `docs/data-retention.md`, išsaugoti rezultatą. Tris naktis palyginti su `retention_done` skaičiais (JSON nukopijuoti iš Vercel „Run“, nes žurnalas trumpalaikis).
4. Surašyti trintinas veiklas (id, pavadinimas, vedėjas, `finished_at`, komandų skaičius). Pranešti jų vedėjams ir duoti laiko eksportuoti CSV.
5. Padaryti momentinę kopiją į schemą `backup_YYYYMMDD` (komandos, atsakymai, užuominos, pasiekimai, refleksijos, liečiami prašymai, DI ir žurnalo įrašai). Nustatyti jos ištrynimo datą, pavyzdžiui po 30 dienų.
6. Nuspręsti dėl laukiančių prašymų ir `request_links`, kurių kodas neapima.
7. Pirmą kartą trinti ranka vienoje transakcijoje tik peržiūrėtus id arba priimti visą patvirtintą ribą. Šiandien apimtis labai maža (1 komanda pagal 2026-11-08 ataskaitą).
8. Nustatyti `RETENTION_MODE=delete` Production aplinkoje ir perdiegti. Tai įjungia ir dokumentų trynimą po importo, todėl prieš tai išbandyti vieną importą.
9. Paleisti cron ranka. Laukiama: 200, `failed: []`, `incomplete: false`, skaičiai kaip 3 žingsnyje.
10. Patikrinti: ataskaitos užklausa grąžina 0; yra `retention_run` įrašas žurnale; veiklų ir užduočių skaičiai nepakito; naujesnės komandos vietoje; E2E smoke žalias.
11. Grąžinimas: pašalinti kintamąjį ir perdiegti; atkurti eilutes iš 5 žingsnio kopijos (pirma tėvinės lentelės). Visos DB atkūrimas tik kraštutiniu atveju.
12. Atnaujinti `/privatumas`, prašymo formos sakinį ir `PRIVACY_NOTICE_UPDATED`; įrašyti vykdymą į dokumentus; tris naktis tikrinti žurnalą.

## 9. Patikimumas ir atsarginės kopijos

| Sritis | Būklė | Žyma |
| --- | --- | --- |
| Vercel produkcija | `READY`, 7 d. be runtime klaidų | PASS |
| Sveikatos patikra ir smoke | kasdien ir po kiekvieno diegimo, žalia | PASS (CI) |
| Supabase projekto būsena, Auth klaidos, DB jungtys | nepatikrinta | BLOCKED |
| DB jungtys iš Vercel | visa prieiga per supabase-js (HTTPS), tiesioginių Postgres jungčių nėra | CODE OK |
| Cron | vienas, 02:00 UTC: užbaigia apleistas veiklas ir skaičiuoja saugojimą; `maxDuration` 60 s; paskutinio vykdymo rezultatas šiame audite nepatikrintas | CODE OK, vykdymas NOT TESTED |
| Realtime | tik vedėjui; po pakartotinio prisijungimo duomenys neperkraunami | CODE GAP (R-11) |
| Laiškai | Resend; klaida tik žurnale, pakartojimo nėra; pristatymas į mokyklų paštą netikrintas | NOT TESTED (R-06) |
| Atsarginės kopijos | pagal dokumentus kasdienės fizinės; PITR išjungtas; trukmė „nepatikrinta“ | BLOCKED |
| Atkūrimas | „atkūrimas nebandytas, nes jis keičia produkciją“ (`migration-history.md:741-743`) | **NEPATVIRTINTA** (R-02) |
| Stebėsena | tik Vercel žurnalas ir kasdienis smoke; kas gauna nepavykusio paleidimo pranešimą, nepatikrinta (OPS-008) | CODE GAP (R-04) |
| Incidentų tvarka | nėra; `demo-runbook.md` yra demonstracijos scenarijus | GAP (R-04) |

Atkūrimo kriterijus lieka **nepatvirtintas**. Bandymo šioje sesijoje atlikti negalėjau: nėra prieigos prie Supabase projekto, o naujo projekto kūrimas yra mokamas resursas, kuriam reikia leidimo. Procedūra 16.3 skyriuje.

## 10. Našumas ir apkrova

Apkrovos bandymas nevykdytas (NOT TESTED). Žemiau yra skaičiavimas iš kodo, ne matavimas.

Vienas dalyvio įrenginys siunčia būsenos užklausą kas 5 s arba lentelės užklausą kas 4 s.

| | 10 komandų × 3 įrenginiai (30) | 5 veiklos vienu metu (150) |
| --- | --- | --- |
| Užklausos į Vercel, žaidimo puslapis | 30 / 5 = 6 per s | 30 per s |
| Užklausos į Vercel, lentelė | 30 / 4 = 7,5 per s | 37,5 per s |
| Užklausų per 45 min. pamoką | 6 × 2700 = 16 200 | 81 000 |
| DB užklausos, jei CDN talpykla (`s-maxage` 1–2 s) veikia | iki 2,5 per s | iki 12,5 per s |
| DB užklausos, jei talpykla neveikia | iki 28,5 per s | iki 142,5 per s |

- Būsenos užklausa yra viena DB užklausa, lentelės trys, N+1 nėra. Atsakymo pateikimas yra apie 10–14 DB užklausų ir bent vienas bcrypt palyginimas.
- Tiesioginių Postgres jungčių nėra, todėl jungčių telkinio išsekimo rizika maža.
- Kiekviena užklausa `pamokos.` adresu eina per `proxy.ts`. Jei Vercel planas ribotas, 16 200 užklausų vienai pamokai reikia įvertinti pagal plano limitą (planas nepatikrintas).
- Greičio ribos be KV yra kiekvieno serverio egzemplioriaus atmintyje, todėl realiai švelnesnės nei užrašyta (R-20). Klasė už vieno NAT adreso gali ir atsitrenkti į ribą, ir ją apeiti; tai reikia patikrinti pilote.

Saugaus apkrovos bandymo planas (atskiram leidimui): izoliuotas Supabase projektas arba šaka ir Vercel peržiūros diegimas su jo raktais; sintetinė veikla; pakopos 10, 30, 50 virtualių įrenginių po 10 min.; stabdymo sąlygos: klaidų dalis virš 1 %, p95 virš 2 s, bet kuri 5xx serija; produkcija neliečiama. Tai atitinka CLS-003.

## 11. UX ir prieinamumas

**Naujo mokytojo požiūris (iš kodo).** Pirmas ekranas turi „Pirmieji žingsniai“ sąrašą, pavyzdinės veiklos mygtuką ir dvi įėjimo korteles. Veiklos paleidimas: sukurti, pridėti užduotis, „Pradėti veiklą“, patvirtinti. Nereikalingų žingsnių nematau. Trūkumai:

- Išsaugojimo būsena matoma tik trumpais pranešimais; nėra nuolatinio „neišsaugota“ ženklo.
- Pavadinimai nevienodi: „Pradėti veiklą“ ir standarto „Vesti veiklą“; „dubliuota“, „nukopijuota“, „(kopija)“.
- DI ribotumai paaiškinti tik fraze „Peržiūrėkite ir patvirtinkite“ ir tikrintojo ženkleliais.
- Kai kur naudotoją gali pasiekti angliškas ar DB klaidos tekstas (`login-form.tsx:57`, `duplicate/route.ts`, pranešimų ir `admin/users` maršrutai).
- Pasibaigus sesijai rodoma tik „Neautorizuota“.

**WCAG 2.2 AA.** Automatinis bandymas viešuose puslapiuose pažeidimų nerado (T-10). Prisijungus matomi vedėjo ir dalyvio žaidimo ekranai automatiškai netikrinti, nes tam reikia izoliuoto Supabase. Iš kodo:

Gerai: `lang="lt"`, mastelio keitimas neuždraustas, `prefers-reduced-motion` gerbiamas, kodo laukas turi `autocomplete="one-time-code"` ir leidžia įklijuoti, atsakymo rezultatas skelbiamas `role="alert"`, dialogai Radix, vedėjas gali pratęsti laiką. Telefone kodo laukas 24 px, el. pašto laukas 16 px (iOS nepriartina).

Problemos (R-19):

- Vedėjo pranešimas dalyviui neturi gyvos srities ir pats dingsta po 15 s (4.1.3, 2.2.1).
- Baltas tekstas ant `bg-secondary` 14 px: kontrastas apie 3,9:1; ant `bg-accent` apie 3,8:1 (1.4.3).
- Refleksijos formos etiketės nesusietos su laukais (`reflection-form.tsx:148,175,193`).
- Užduočių rikiavimas turi klaviatūros jutiklį, bet neturi alternatyvos be tempimo (2.5.7).
- Pasiūlymo tempimo rankenėlė be pavadinimo ir nematoma, kol neužvesta pelė.
- Prisijungimo klaidos rodomos tik laikinais pranešimais, be `aria-invalid` ir `aria-describedby`.
- Įvesties lauko rėmelio kontrastas apie 1,2:1 (1.4.11).

**Ko automatinis testas nepastebi:** trūkstama gyva sritis; tempimo alternatyva; dnd-kit angliškos ekrano skaitytuvo instrukcijos lietuviškame puslapyje; bendras paveikslėlio alternatyvus tekstas, kurio mokytojas negali parašyti; laikmačio spalva kaip vienintelis signalas; fokuso tvarka po užduočių sąrašo atnaujinimo; 400 % mastelis; klaviatūros uždengiamas mygtukas tikrame telefone; projektoriaus šriftas (30–36 px) iš paskutinės eilės.

## 12. Radiniai P0–P3

### P0

Nerasta.

### P1

**R-01. Bibliotekos įrašas gali rodyti į kito mokytojo veiklą, o kopijavimas perkelia jos atsakymus ir paaiškinimus.**

- Įrodymas: politika `teacher_insert_library` tikrina tik `published_by` ir `status`; `lib/library/source-answers.ts:70-86` skaito `challenges` service role klientu pagal `source_game_id` be savininko patikros; `app/api/library/[itemId]/clone/route.ts:72-95` kopijuoja `answer_hash` ir `explanation`. Izoliuotoje DB mokytojo įterpimas su svetimos veiklos `source_game_id` pavyko (`evidence/library-and-admin-probe.sql`).
- Scenarijus: mokytojas B prisijungia prie mokytojo A veiklos kaip komanda, sužino veiklos id ir užduočių pavadinimus. Per Data API įterpia bibliotekos įrašą su A veiklos id. Administratoriui patvirtinus, B nukopijuoja šabloną ir gauna veiklą su A atsakymų maišomis ir paaiškinimais, kuriuos gali skaityti.
- Kodėl P1, ne P0: reikia administratoriaus patvirtinimo; atskleidžiamas mokytojo turinys, ne asmens duomenys; atsakymai lieka maišomis. Kodėl ne P2: tai įrodytas privalomo neigiamo testo „mokytojas negali pasiekti kito mokytojo privačių veiklų“ pažeidimas.
- Produkcijoje patikrinti, ar jau nepanaudota (16.1, užklausa 6).

**R-02. Atkūrimas iš atsarginės kopijos niekada nebandytas.**

- Įrodymas: `docs/migration-history.md:741-743, 919`; `docs/privacy-review.md:62,125`; OPS-008 būsena TODO.
- Rizika: visi trynimai negrįžtami (veiklos trynimas kaskaduoja, būsimas saugojimo valymas taip pat). Vienintelis atkūrimo kelias yra viso projekto kasdienė kopija, prarandant iki 24 val. visų mokytojų darbo. Nežinoma, kiek dienų kopijos saugomos ir ar į jas įeina Storage failai. `supabase/migrations` vienas neatkuria produkcijos schemos (TEAM-006 yra pasiūlymų kataloge).

**R-03. Dalyvių įrenginiai krauna Google Maps ir bet kurio išorinio serverio paveikslėlius.**

- Įrodymas: `components/shared/maps-embed.tsx:80-93` (iframe `maps.google.com`, kraunamas be paspaudimo), naudojamas `components/player/linear-task.tsx:114` ir `challenge-detail-modal.tsx:179`; `app/api/challenges/route.ts:40` priima bet kurį https `image_url`.
- Scenarijus: užduotis su žemėlapiu kiekvieno mokinio IP adresą perduoda Google ir leidžia Google nustatyti slapukus. Pranešimas teigia priešingai. Išorinis paveikslėlis tą patį daro bet kuriam serveriui.
- Laikinas sprendimas: nenaudoti žemėlapio užduočių ir išorinių paveikslėlių. Jo neįmanoma priverstinai užtikrinti, todėl P1.

**R-04. Vieno žmogaus priklausomybė ir nėra įspėjimų.**

- Įrodymas: `docs/privacy-review.md:146` („paskyros pas teikėjus yra Vyčio Radvilos, ne KU vardu sudarytos sutartys“); OPS-008 TODO; klaidos tik Vercel žurnale; nėra incidentų tvarkos.
- Rizika ilgalaikiam naudojimui: jei savininkas nepasiekiamas, niekas negali patvirtinti mokytojo, atkurti duomenų, reaguoti į incidentą ar duomenų subjekto prašymą. Naktinio cron ar laiškų gedimo niekas nepastebės.
- Teisinė dalis (tvarkytojų sutartys ne KU vardu) reikalauja KU sprendimo; aš jos nevertinu.

### P2

**R-05. Užblokuota paskyra išlaiko sesiją ir savo duomenų skaitymą.** Blokavimas keičia tik `profiles.status`. RESTRICTIVE politikos apima tik rašymą. Izoliuotoje DB užblokuota paskyra per RLS matė savo veiklą, komandą, atsakymą ir užduotį (`evidence/blocked-read-probe.sql`). Puslapiai ir vedėjo API užsidaro per iki 30 s (`proxy.ts`, `GATE_TTL_MS`); DI maršrutai tame lange dar pasiekiami. Svetimų duomenų nemato.

**R-06. Patvirtinimas praneša „Kvietimas išsiųstas“ nepriklausomai nuo laiško.** `app/api/admin/access-requests/[id]/route.ts:99-106`, `lib/email/send.ts:26-30`. Mokytojas gali niekada negauti laiško, o administratorius matys sėkmę. Pakartotinio siuntimo veiksmo nėra.

**R-07. DI atsakymas gali tapti galiojančiu be mokytojo patvirtinimo.** `convert/route.ts:136-159`, `game-builder.tsx:348-370`. Startą blokuoja tik `needs_answer`, kuris nustatomas, kai DI tikrintojas atmeta. „Neaišku“ ir netikrintos užduotys paleidžiamos laisvai.

**R-08. Administratorius gali perimti bet kurią veiklą per Data API.** Politika `admins_update_all_games` (`00002:29`) be stulpelių ribų; tas pats administratorių politikoms planų keitimui ir trynimui (`20261106140000`). Izoliuotoje DB `admin` pakeitė svetimos veiklos `teacher_id` į save. Programa šių teisių nenaudoja (užbaigimas eina per service role).

**R-09. Produkcijos schema ir migracijų istorija.** Trys susiję dalykai: `handle_new_user()` taisyklė pagal el. paštą (CLS-011); tuščia `schema_migrations` (CLS-005); TEAM-006 pritaikytas iš pasiūlymų katalogo. Papildomai: `grantAccount` esamai nepatvirtintai paskyrai tik nustato `email_confirm` (`lib/access/approve.ts`), todėl jei Supabase registracija kada nors būtų įjungta, iš anksto užregistruotas adresas būtų patvirtintas su svetimu slaptažodžiu. Šiandien tai uždaro „signups disabled“ nustatymas, kurio patikrinti negalėjau.

**R-10. Dalyvis gali prarasti komandą dėl trumpo ryšio sutrikimo.** Klaidos ekrano mygtukas ištrina žetoną be patvirtinimo (`play-screens.tsx:38-45`, `play/page.tsx:775-778`); komandos kūrimas neidempotentiškas (`app/api/teams/route.ts:117-127`).

**R-11. Tylus pasenimas blogame tinkle.** Dalyviui nėra „nėra ryšio“ ženklo (`play/page.tsx:520,556`); pranešimai lengvai praleidžiami (`status/route.ts:7`); vedėjo ekranas po Realtime atsijungimo duomenų neperkrauna (`use-live-game.ts:164-173`).

**R-12. Laiko riba yra komandos, ne veiklos.** Projektoriaus laikmatis ir komandų terminai gali skirtis; pamiršta veikla priima naujas komandas iki nakties.

**R-13. Taškų vientisumas ir grįžimo nuoroda.** Atsakymo įrašas ir taškų pridėjimas yra du atskiri kvietimai (`submissions/route.ts:264-308`); vykstančios veiklos atsakymo ar taškų keitimas neperskaičiuoja rezultatų; grįžimo nuoroda 10 min. daugkartinė, o komandos žetonas nekeičiamas.

**R-14. Mokytojo darbas gali dingti dviejose vietose.** Išsaugoto plano redagavimas be įspėjimo (`lesson-plan-detail.tsx:150-180`); `/games/[id]/lesson` tyliai praleidžia nepavykusias užduotis (`lesson-generator.tsx:174-228`).

**R-15. Pamokos plano be DI sukurti negalima.** Išnaudojus limitą, biudžetą ar sugedus DI, naujų planų nėra.

**R-16. Sesijos ir klaidų elgsena.** Atsijungimas nutraukia visų įrenginių sesijas; 401 rodo tik „Neautorizuota“; nėra kodo pakartotinio siuntimo; kopijavimo dalinė klaida rodoma kaip sėkmė; baigtų veiklų per UI ištrinti negalima.

**R-17. Pamoką vykdantys maršrutai neturi automatinių testų.** `/api/submissions`, `/api/teams`, `/api/play/*`, `/api/reflections` netikrina nei `tests/`, nei `e2e/`. Smoke testas liečia tik įėjimus.

**R-18. Privatumo pranešimo ir duomenų gyvavimo spragos.** Pranešimas nemini administratorių prieigos prie rezultatų, avataro, techninių duomenų; dalyvio komandos negalima pašalinti baigtoje veikloje; paveikslėliai lieka vieši po trynimo; nėra paskyros eksporto ir šalinimo savitarnos.

**R-19. Prieinamumo problemos**, išvardytos 11 skyriuje.

**R-20. Greičio ribos tik atmintyje.** `KV_REST_API_*` produkcijoje nėra. Jei KV būtų įjungtas, `lib/ai/kv-rate-limit.ts` turi kitą riziką: `incr` ir `expire` nėra atominiai, todėl raktas gali likti be galiojimo ir užblokuoti, pavyzdžiui, visą mokyklos IP visam laikui. Ją reikia ištaisyti prieš įjungiant KV.

**R-22. Saugojimo terminai nevykdomi** (aprašyta 8.3). Šiandien P2; po 2027-02-04 taptų P1.

### P3

**R-21. Smulkesni:**

- `CRON_SECRET` nekeistas nuo 2026-11-07, kai jį įvedė agentas (OPS-001); `ANTHROPIC_API_KEY` ir `SUPABASE_SERVICE_ROLE_KEY` ne `sensitive` tipo (OPS-002). Ekosistemos backloge tai P1. Aš vertinu žemiau, nes raktai jau tik Production aplinkoje ir skaityti juos gali tik Vercel projekto savininkas; konkretaus neautorizuoto veiksmo neįrodžiau. Vis tiek rekomenduoju užbaigti prieš prijungiant mokytojus.
- Kodo paieška be greičio ribos: `/api/play/state`, `status`, `leaderboard` (31^6 kodų). Baigtų veiklų lentelės lieka skaitomos pagal kodą.
- Nėra Origin patikros tuščio kūno POST maršrutams; CSP be `script-src`; `lib/supabase/admin.ts` be `import "server-only"`.
- Neribotos zod eilutės keliuose maršrutuose; DB klaidų tekstai grąžinami naudotojui.
- Užuominas galima atverti pristabdytoje ar baigtoje veikloje; pasirinkimo užduotis atspėjama per 4 bandymus.
- `localStorage` skaitomas be `try/catch`; `min-h-screen` be `dvh`; planšetės pločio laukai 14 px.
- DI: SDK laiko riba ilgesnė už `maxDuration`; leidimo patikra DB klaidos atveju praleidžia; dokumento tekstas nepažymėtas kaip nepatikimas.
- Pasenę dokumentai: `access-and-email.md`, `REGISTRATION-TEST.md` B1, `demo-runbook.md` (senas `play.` adresas), `audit-talking-points.md` (neteisingi teiginiai apie švelnų trynimą). `AGENTS.md` mini `types/database.ts`, kurio nėra.
- Performance Advisor įspėjimai (7.3, 4 klausimas).

## 13. Konkretūs taisymo pasiūlymai

Kiekvienas taisymas atskiru PR ir su atskiru patvirtinimu. DB pakeitimai su grąžinimo failu ir `test:db`.

| Radinys | Pasiūlymas | Apimtis |
| --- | --- | --- |
| R-01 | `sourceAnswers` reikalauti `games.teacher_id = library_items.published_by`; tą pačią sąlygą pridėti į abiejų bibliotekos politikų `WITH CHECK` arba trigerį; testas į `security.sql` | mažas kodo PR ir migracija |
| R-02 | Atkurti paskutinę kopiją į naują Supabase projektą, paleisti `schema-fingerprint.sql` ir eilučių skaičius, užrašyti trukmę; nuspręsti dėl PITR; užrašyti RPO ir RTO; TEAM-006 perkelti į `supabase/migrations` | Vyčio veiksmas ir dokumentas |
| R-03 | Žemėlapį krauti tik paspaudus arba rodyti tik nuorodą; paveikslėlius leisti tik iš platformos saugyklos arba per tarpinį serverį; kitaip papildyti pranešimą | mažas kodo PR |
| R-04 | Antras asmuo su Supabase, Vercel, Resend ir DNS prieiga; nepavykusio smoke ir cron pranešimas patvirtintam gavėjui; vieno puslapio incidentų tvarka; KU sprendimas dėl paskyrų | organizacinis |
| R-05 | Blokuojant kviesti `auth.admin.signOut(userId)`; RESTRICTIVE SELECT politika neaktyvioms paskyroms; būsenos patikra `checkAiAllowance` | PR ir migracija |
| R-06 | Laukti siuntimo rezultato ir jį rodyti; „siųsti dar kartą“ naudotojo eilutėje; atnaujinti dokumentus | mažas PR |
| R-07 | Blokuoti startą arba reikalauti aiškaus patvirtinimo, kol yra neperžiūrėtų DI užduočių | PR |
| R-08 | Pašalinti `admins_update_all_games` ir administratorių planų keitimo bei trynimo politikas | migracija |
| R-09 | Taikyti CLS-011 ir CLS-005; `grantAccount` nepatvirtintai paskyrai atkurti slaptažodį arba perkurti naudotoją | jau paruošta, laukia leidimo |
| R-10 | Pašalinti mygtuką iš klaidos ekrano arba pridėti patvirtinimą; kliento sugeneruotas prisijungimo vienkartinis raktas | PR |
| R-11 | „Nėra ryšio“ juosta po 2–3 nepavykusių užklausų; grąžinti paskutinį nematytą pranešimą; perkrauti duomenis po kiekvieno `SUBSCRIBED` ir lėta saugos užklausa | PR |
| R-12 | Aiški etiketė projektoriuje arba klasės bendro termino parinktis; automatinis užbaigimas praėjus visų komandų terminams | PR |
| R-13 | Viena RPC įrašui ir taškams; įspėjimas keičiant vykstančios veiklos atsakymą; vienkartinė grįžimo nuoroda | PR ir migracija |
| R-14, R-15, R-16 | `useLeaveWarning` plano redagavimui; klaidų rodymas generatoriuje; rankinis plano kūrimas; pakartotinio prisijungimo langas | PR |
| R-17 | Izoliuotas integruotas E2E CI darbe su vietiniu Supabase (`supabase start`), apimantis 1–20 žingsnius su sintetiniais duomenimis | atskiras PR |
| R-22 | Saugi įjungimo tvarka 8.3 skyriuje | Vyčio leidimas |
| R-18, R-19 | Papildyti pranešimą; komandos šalinimas baigtoje veikloje; paveikslėlių trynimas; prieinamumo taisymai | PR |
| R-20 | Ištaisyti `incrAtomic` atomiškumą, tada spręsti dėl KV (CLS-009) | PR |

## 14. Likutinė rizika

Net įvykdžius A ir B sąlygas, liks:

- Atsakymai saugomi tik maišomis: mokytojas, pamiršęs atsakymą, jo neatkurs.
- Dalyvių duomenys atkuriami tik iš kasdienės kopijos, jei PITR nebus įjungtas (iki 24 val. praradimas).
- Komandos pavadinime gali atsirasti tikras vardas; tai valdoma tik instrukcija.
- DI turinio pedagoginė kokybė priklauso nuo mokytojo peržiūros.
- Viena infrastruktūros regiono ir tiekėjų grandinė (Vercel, Supabase, Resend, Anthropic) be atsarginio kelio.
- Šis auditas pats yra to paties agento tipo darbas kaip ir kodas. OPS-009 (nepriklausoma žmogaus peržiūra) lieka reikalinga.

## 15. GO / CONDITIONAL GO / NO-GO

**CONDITIONAL GO.**

**A sąlygos: iki pirmų tikrų mokytojų paskyrų (ribota grupė, siūlau iki 5 mokytojų).**

| Nr. | Sąlyga | Priėmimo įrodymas |
| --- | --- | --- |
| A1 | Ištaisytas R-01 | testas `security.sql`, produkcijos užklausa 6 grąžina 0 |
| A2 | Ištaisytas R-03 arba papildytas pranešimas | dalyvio puslapis nekrauna trečiųjų šalių turinio be veiksmo |
| A3 | Atliktas atkūrimo bandymas atskirame projekte (R-02) | protokolas su schemos atspaudu ir eilučių skaičiais |
| A4 | Įvykdytas `REGISTRATION-TEST.md` su T1 ir T2, pridėjus neigiamus atvejus (16.2) | radinių lentelė, `admin_audit_log` įrašai |
| A5 | Produkcijos tik skaitymo patikros (16.1) be netikėtumų | užklausų rezultatai |
| A6 | Paskirtas antras asmuo su prieiga ir pranešimų gavėjas (R-04) | įrašas `ECOSYSTEM.md` |
| A7 | OPS-001 ir OPS-002 užbaigti | Vercel metaduomenys |

**B sąlygos: iki platesnio ir ilgalaikio prijungimo.**

| Nr. | Sąlyga |
| --- | --- |
| B1 | Pilotas su 5–10 tikrų įrenginių praėjo (`PILOT PASSED`, CLS-002) |
| B2 | Ištaisyti R-05, R-06, R-07, R-08, R-10, R-11 |
| B3 | Taikyti CLS-011 ir CLS-005; TEAM-006 perkeltas į migracijas |
| B4 | `RETENTION_MODE=delete` įjungtas pagal 8.3 tvarką, ne vėliau kaip 2027-02-04 |
| B5 | Integruotas automatinis E2E (R-17) žalias CI |
| B6 | KU sprendimas dėl tvarkytojų paskyrų (R-04) |

NO-GO taptų, jei: produkcijos užklausa 6 parodytų, kad R-01 jau panaudotas; atkūrimo bandymas nepavyktų; registracijos bandyme laiškai nepasiektų mokytojo; Supabase registracija pasirodytų įjungta.

## 16. Neužbaigtų patikrų procedūros

### 16.1 Produkcijos tik skaitymo patikros (Supabase SQL Editor, vykdo Vytis arba sesija su prieiga)

```sql
-- 1. Schemos atspaudas: supabase/tests/schema-fingerprint.sql
--    Laukiama: kaip supabase/proposals/team-006-sso/fingerprint-after.expected, išskyrus function (CLS-011).
-- 2. Rolės ir būsenos
select role, status, count(*) from public.profiles group by 1, 2 order by 1, 2;
-- 3. SECURITY DEFINER funkcijos ir teisės
select p.oid::regprocedure, p.proconfig, p.proacl from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.prosecdef;
-- 4. Ne darbuotojų paskyros su slaptažodžiu (R-09)
select count(*) from auth.users u join public.profiles p on p.id = u.id
 where coalesce(u.encrypted_password, '') <> '' and p.role <> 'staff';
-- 5. Storage kibirai
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
select bucket_id, count(*) from storage.objects group by 1;
-- 6. R-01: ar yra bibliotekos įrašų su svetimos veiklos šaltiniu (laukiama 0)
select count(*) from public.library_items l join public.games g on g.id = l.source_game_id
 where g.teacher_id <> l.published_by;
-- 7. Atsakymai tik maišomis (laukiama 0)
select count(*) from public.challenges where answer_hash not like '$2%';
-- 8. Vykstančios veiklos ir apimtis
select status, count(*) from public.games group by 1;
```

Skydelyje: Security ir Performance Advisor sąrašai; Authentication → „Allow new users to sign up“ išjungta; kodo galiojimas ir ilgis; laiškų siuntimo ribos; SMTP rodo į Resend; Google peradresavimo adresai; Database → Backups: planas, dienų skaičius, PITR.

### 16.2 Registracijos bandymas (CLS-004)

Pagal `docs/REGISTRATION-TEST.md`, kai Vytis pateikia T1, T2 ir langą. Prieš vykdant pataisyti B1 žingsnį (laiškas dabar siunčiamas per Resend, ne Supabase kvietimu). Papildomi neigiami atvejai:

1. Neteisingas kodas ir pasibaigęs kodas: ar pranešimas suprantamas.
2. Google paskyra, kuriai nėra patvirtinimo: prieigos neturi būti.
3. T1 užblokuojamas, kol turi atvirą skydelį: per kiek laiko užsidaro puslapiai; ar DI mygtukas dar veikia.
4. T1 atsijungia viename įrenginyje, kai kitame redaguoja užduotį.
5. T2 (administratorius) bando atverti `/admin/prasymai` ir `/admin/di`: turi būti atmesta.
6. Resend žurnale matomas pristatytas laiškas į T1.

### 16.3 Atkūrimo bandymas

1. Supabase → `menmndjyfeuwfweubwnl` → Database → Backups: užrašyti planą, kopijų skaičių ir paskutinės laiką.
2. Atkurti paskutinę kopiją **į naują projektą** (ne į produkciją). Jei planas to neleidžia, atsisiųsti kopiją ir atkurti vietinėje PostgreSQL 17.
3. Atkurtoje bazėje paleisti `schema-fingerprint.sql` ir palyginti su produkcijos reikšmėmis.
4. Palyginti eilučių skaičius: `profiles`, `games`, `challenges`, `teams`, `submissions`, `lesson_plans`, `library_items`.
5. Patikrinti, ar `storage.objects` ir patys failai įtraukti. Jei ne, aprašyti kibirų eksportą.
6. Užrašyti trukmę, RPO ir RTO; ištrinti bandomąjį projektą; įrašyti protokolą į `docs/`.

### 16.4 Pilotas su tikrais įrenginiais (CLS-002)

Pagrindas: `docs/PILOT.md`. Reikia: vieno vedėjo su **mokytojo vaidmens** paskyra (ne super administratoriaus), 5–10 dalyvių įrenginių (bent 2 iPhone Safari, 2 Android Chrome, 1 planšetė), vedėjo kompiuterio su Chrome ir antro su Edge, projektoriaus, mokyklos Wi-Fi, stebėtojo, kuris pildo radinių lentelę. Veikla su 6–8 rankomis parašytomis užduotimis, iš jų viena su paveikslėliu; be žemėlapio, kol neištaisytas R-03.

Prie `PILOT.md` scenarijaus pridėti šio audito patikras:

| Nr. | Veiksmas | Ko žiūrėti | Radinys |
| --- | --- | --- | --- |
| P1 | QR iš projektoriaus nuskaitomas iš paskutinės eilės telefono kamera | atsidaro `pamokos.kusteam.app/play/<kodas>` | |
| P2 | Visi įrenginiai jungiasi per vieną minutę iš to paties Wi-Fi | nėra 429 | R-20 |
| P3 | Vienam telefonui išjungiamas Wi-Fi tiksliai spaudžiant „Prisijungti prie veiklos“ | ar komanda sukurta ir ar telefonas ją turi | R-10 |
| P4 | Lėktuvo režimas atsakymo viduryje, tada perkrovimas | koks ekranas, ką mokinys spaudžia | R-10 |
| P5 | Telefonas užrakinamas 3 min.; tuo metu vedėjas siunčia pranešimą ir pristabdo | ką rodo atrakinus | R-11 |
| P6 | Perėjimas į kitą programą ir atgal | būsena ir laikmatis teisingi | |
| P7 | Vedėjo kompiuteriui 10 s išjungiamas Wi-Fi, per tą laiką komanda išsprendžia užduotį | ar vedėjo ekranas sutampa su perkrautu | R-11 |
| P8 | Vėluojanti komanda veikloje su laiko riba | projektoriaus laikmatis ir komandos laikas | R-12 |
| P9 | Tas pats komandos žetonas dviejuose įrenginiuose | antras mato sprendimus tik perkrovus | |
| P10 | Vedėjo grįžimo nuoroda naujam įrenginiui, senas dar siunčia atsakymus | kas nutinka abiem | R-13 |
| P11 | iPhone: komandos pavadinimo ir atsakymo laukai | nepriartina; mygtukas matomas virš klaviatūros | |
| P12 | Planšetė: laukų priartinimas | | R-21 |
| P13 | Vedėjas vykstant veiklai prideda užduotį ir pataiso atsakymą | ką mato komandos | R-13 |
| P14 | Užbaigimas, refleksijos, CSV atidaromas Excel su lietuviškais nustatymais | raidės, skyriklis, komanda `=1+1` | |
| P15 | Laikmatis ir lentelė projektoriuje iš paskutinės eilės | įskaitoma | R-19 |
| P16 | Naršyklės įrankiuose `x-vercel-cache` būsenos ir lentelės užklausoms | `HIT` | 10 skyrius |

Po piloto: Vercel runtime klaidos, Supabase žurnalai, radinių lentelė, sprendimas `PILOT PASSED` ar ne.

## 17. Būsena 2026-11-23

Šis skyrius pridėtas po audito. Ankstesni skyriai nekeisti ir rodo 2026-11-22 būseną. Išvada lieka **CONDITIONAL GO**: A sąlygos dar neįvykdytos visos.

### 17.1 Radiniai

| Radinys | Būsena | Įrodymas ar kas liko |
| --- | --- | --- |
| R-01 | Ištaisyta kode | #133: šaltinio atsakymai skaitomi tik iš publikavusio vedėjo veiklos. DB taisyklė `library_items_source_rules` yra #144 (nepritaikyta). Produkcijos užklausa 6 (16.1) nevykdyta |
| R-02 | Neatlikta | Atkūrimo bandymas, Vyčio veiksmas (16.3) |
| R-03 | Iš dalies | #134: žemėlapis įkeliamas tik paspaudus. Užduočių paveikslėliai iš bet kurio `https` serverio lieka |
| R-04 | Neatlikta | Antras asmuo su prieiga ir pranešimų gavėjas, Vyčio sprendimas |
| R-05 | Parengta, nepritaikyta | #144: RESTRICTIVE skaitymo politika tik aktyvioms paskyroms |
| R-06 | Ištaisyta | #149: atsakymas ir administratoriaus ekranas rodo, ar laišką priėmė siuntimo paslauga; „Siųsti dar kartą“. Gyvai produkcijoje nebandyta (reikėtų siųsti tikrą laišką) |
| R-07 | Ištaisyta | #139: veiklos pradėti negalima, kol vedėjas nepatvirtina peržiūrėjęs DI užduotis (`ai_review_required`). #138, #148: užuominų ir atsakymų patikros, „DI klaidų nerado“ |
| R-08 | Parengta, nepritaikyta | #144: pašalinamos `admins_update_all_games` ir administratorių planų keitimo bei trynimo politikos |
| R-09 | Neatlikta | CLS-011, CLS-005, TEAM-006 perkėlimas į migracijas: Vyčio sprendimai |
| R-10 | Iš dalies | #137: klaidos ekranas nebetrina žetono, bandoma iš naujo. #147: DB trikdis nebelaikomas „komanda nerasta“. Komandos kūrimo idempotentiškumas nekeistas |
| R-11 | Ištaisyta | #137: ryšio juosta ir neišnykstantys skelbimai. #139, #145: vedėjo ekranas perskaito duomenis po kiekvieno kanalo prisijungimo |
| R-12 | Vykdoma | CLS-022, reikia migracijos |
| R-13 | Vykdoma | CLS-022, reikia migracijos |
| R-14 | Neperžiūrėta po audito | |
| R-15 | Neatlikta | |
| R-16 | Iš dalies | #136: kodo pakartotinis siuntimas. #139: pasibaigusios sesijos pranešimas, veiklos trynimo ir kopijavimo dialogai. Atsijungimas visuose įrenginiuose nekeistas |
| R-17 | Ištaisyta | #143: visos pamokos E2E su vietiniu Supabase kiekvienam PR. #147: maršrutų testai |
| R-18 | Parengta, laukia patvirtinimo | #150 (juodraštis): pranešimo papildymas ir 11 klausimų Vyčiui |
| R-19 | Iš dalies | #137: skelbimo kontrastas, formų etiketės. #139: užduočių rikiavimas klaviatūra. 11 skyriaus sąrašas iš naujo netikrintas |
| R-20 | Neatlikta | Greičio ribos lieka atmintyje |
| R-21 | Iš dalies | #137: saugus `localStorage` skaitymas. Kiti punktai neperžiūrėti. Gyvo bandymo radiniai N-1 (#136), N-2 ir N-5 (#147) ištaisyti |
| R-22 | Neatlikta | `RETENTION_MODE` nekeistas, terminas 2027-02-04 |

### 17.2 Sąlygos

| Nr. | Būsena |
| --- | --- |
| A1 | Kodas ištaisytas (#133). Produkcijos užklausa 6 nevykdyta |
| A2 | Įvykdyta žemėlapiui (#134). Išoriniai paveikslėliai lieka (R-03) |
| A3 | Neįvykdyta |
| A4 | Iš dalies: T1 mokytojo paskyra ir visa pamokos eiga patikrinta gyvai (`CLASSROOM-LIVE-TEST-2026-11-22.md`). T2, naujos paskyros kvietimo nuoroda ir neigiami atvejai nevykdyti |
| A5 | Neįvykdyta: sesijos Supabase jungtis neturėjo prieigos prie projekto |
| A6 | Neįvykdyta |
| A7 | Neįvykdyta |
| B1 | Neįvykdyta |
| B2 | R-06, R-07, R-11 ištaisyti; R-10 iš dalies; R-05 ir R-08 laukia #144 pritaikymo |
| B3 | Neįvykdyta |
| B4 | Neįvykdyta |
| B5 | Įvykdyta (#143) |
| B6 | Neįvykdyta |

### 17.3 Papildomai padaryta po audito

Slaptažodžio prisijungimas ir „Pamiršau slaptažodį“ (#136), DI metodikos patikros (#138, #148), 15 paruoštų veiklų (#140), formuojamoji analitika (#141), pirmo karto pradžia ir gidas (#142). Po kiekvieno sujungimo tikrinta produkcija: diegimas, `CI`, `E2E smoke (production)`, Vercel vykdymo klaidos. Pastaba: `E2E smoke (production)` buvo raudonas nuo #136 iki #146 dėl pasenusio testo, ne dėl produkto klaidos.
