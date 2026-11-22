# CLASSROOM pasirengimo auditas: santrauka savininkui

Data: 2026-11-22. Visa ataskaita: [`CLASSROOM-TEACHER-READINESS-2026-11-22.md`](CLASSROOM-TEACHER-READINESS-2026-11-22.md).

## Išvada: CONDITIONAL GO

Šiandien platformos dar negalima be apribojimų atverti ilgalaikiam mokytojų naudojimui. Nedidelę kontroliuojamą grupę (siūlau iki 5 mokytojų) galima prijungti įvykdžius A sąlygas. Platesnis prijungimas tik po B sąlygų.

Kritinių (P0) radinių nėra: dalyvis negauna atsakymų ir svetimų žetonų, mokytojas nepakeičia savo vaidmens, slapti raktai į naršyklę nepatenka.

## Keturi P1 radiniai

1. **R-01. Mokytojų turinio izoliacijos spraga bibliotekoje.** Mokytojas gali pateikti bibliotekos įrašą, rodantį į kito mokytojo veiklą. Administratoriui patvirtinus, kopija gauna svetimos veiklos atsakymus ir paaiškinimus. Įrodyta izoliuotoje DB. Taisymas mažas.
2. **R-02. Atkūrimas iš atsarginės kopijos niekada nebandytas.** PITR išjungtas, kopijų trukmė nepatikrinta, trynimai negrįžtami.
3. **R-03. Mokinių telefonai gali krauti Google Maps ir išorinius paveikslėlius.** Privatumo pranešimas teigia kitaip.
4. **R-04. Viskas laikosi ant vieno žmogaus.** Nėra antro asmens su prieiga, įspėjimų ir incidentų tvarkos; tvarkytojų paskyros asmeninės.

## Kas nepatikrinta

| Kas | Kodėl | Kas turi padaryti |
| --- | --- | --- |
| Produkcijos DB, Advisor, Auth nustatymai, kopijos | Supabase prieiga šiai sesijai neleista | Vytis: 8 užklausos ataskaitos 16.1 skyriuje |
| Registracija su tikra mokytojo paskyra | reikia T1, T2 ir leidimo | Vytis: `REGISTRATION-TEST.md` ir 16.2 |
| Tikri telefonai, projektorius, mokyklos Wi-Fi | nėra įrenginių | pilotas, 16.4 |
| Atkūrimas iš kopijos | nėra prieigos | Vytis, 16.3 |
| Integruotas pamokos scenarijus ir apkrova | aplinkoje nėra izoliuoto Supabase | atskiras PR su CI darbu |

## Kas patikrinta ir žalia

- Vietoje: `tsc`, `lint`, 395 vienetiniai testai, `test:db` su PostgreSQL 17.12, `build`.
- Produkcija: diegimas `READY` iš `255f7ac`, 7 dienas be runtime klaidų, CI, Database, E2E smoke ir Scheduled tests žali.
- Vieši puslapiai: 0 WCAG 2.2 AA pažeidimų automatiniame bandyme trimis pločiais.

## Ko reikia iš tavęs dabar

1. Leidimo taisyti R-01 ir R-03 atskirais PR.
2. Paleisti 16.1 užklausas arba suteikti tik skaitymo Supabase prieigą. Ypač 6 užklausą: ar R-01 jau nepanaudotas.
3. Atkūrimo bandymo atskirame projekte (16.3).
4. T2 adreso, bandymų lango ir leidimo CLS-004.
5. Užbaigti OPS-001 (`CRON_SECRET` nekeistas nuo 2026-11-07) ir OPS-002 (du raktai vis dar ne `sensitive` tipo).
6. Sprendimo, kas yra antras asmuo su prieiga.

## Tavo keturi Supabase klausimai trumpai

- `get_my_role()` ir `handle_new_user()` įspėjimai: išnaudojimo kelio neradau, tai ne pažeidžiamumai.
- `handle_new_user()` taisyklė pagal el. paštą: tiesiogiai neišnaudojama, bet suteikia `super_admin` be audito įrašo ir gadina schemos palyginimą. P2, sprendimas CLS-011 paruoštas.
- Tuščia migracijų istorija: žinoma, kompensuoja schemos atspaudas. Nauja: TEAM-006 produkcijoje pritaikytas, bet repozitorijoje vis dar ne migracijų kataloge.
- Performance Advisor: dabartiniam mastui P3; nepaleistas, nes nėra prieigos.

`RETENTION_MODE` produkcijoje tikrai nenustatytas (patikrinta Vercel). Saugi įjungimo tvarka ataskaitos 8.3 skyriuje; režimas nekeistas.
