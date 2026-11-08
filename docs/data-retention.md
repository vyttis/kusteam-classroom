# Duomenų saugojimo politikos projektas (CLS-014)

**Būsena: projektas.** Terminus pasiūlė Vytis Radvila 2026-11-08, po konsultacijos su KU duomenų apsaugos pareigūnu (jis vidaus sprendimus paliko KU STEAM centrui). Tai dar ne patvirtinta ir ne įgyvendinta politika. Produkcijoje niekas netrinama.

**v1.0 sąlyga.** CLASSROOM v1.0 priimamas tik turint patvirtintą ir įgyvendinamą planą: kiekvienai kategorijai terminas, atsakingas asmuo ir trynimo būdas. Privatumo pranešimas (`/privatumas`) turi sakyti tai, kas iš tikrųjų daroma.

## Terminai ir ar jų galima laikytis

Faktai patikrinti kode ir migracijose 2026-11-08.

| Kategorija | Siūlomas terminas | Nuo kada skaičiuojama | Ar dabar laikomasi | Ko trūksta | Darbas, svarba |
| --- | --- | --- | --- | --- | --- |
| Paskyrų prašymai | 90 dienų po sprendimo | Sprendimo laikas (`reviewed_at`, būsena patvirtinta ar atmesta) | Ne: trynimo nėra | Naktinis trynimas | CLS-018, v1.0. Pirmas terminas baigiasi 2027-02-04 (prašymas išspręstas 2026-11-06) |
| Veiklų dalyvių rezultatai | 6 mėnesiai po užsiėmimo | Veiklos pabaiga (`games.finished_at`, nustatoma automatiškai) | Ne: rezultatai lieka, kol vedėjas ištrina veiklą | Naktinis komandų trynimas (kartu atsakymai, užuominos, ženkleliai, refleksijos). Veikla ir užduotys lieka vedėjui | CLS-018, v1.0. Pirmas terminas: 6 mėn. po piloto |
| Vedėjų paskyros | Kol reikalingos; peržiūra po 24 mėn. neaktyvumo | Paskutinis prisijungimas (rodomas Administravimas → Vartotojai) | Taip, rankiniu būdu: sąrašas rodo paskutinį prisijungimą | Tik procedūra, kodo nereikia | Procedūra žemiau. v1.0: aprašyta. Pirmas taikymas ne anksčiau kaip 2028 m. |
| DI sąnaudų įrašai | 12 mėnesių, jei nėra ilgesnių KU prievolių | Įrašo laikas | Ne | Naktinis trynimas | CLS-018, v1.0. Produkcijoje įrašų dar nėra |
| Administravimo žurnalas | 12 mėnesių, jei nėra ilgesnių KU prievolių | Įrašo laikas | Ne | Naktinis trynimas | CLS-018, v1.0. Pirmas terminas 2027-11-06 |
| Importuoti dokumentai | Po apdorojimo, ne vėliau kaip per 7 dienas | Įkėlimo laikas | Ne: failai niekada netrinami | Trynimas po apdorojimo ir naktinis valymas | CLS-017, iki PILOT READY, nes pranešimas tai žada. Produkcijoje failų dabar nėra |
| Atsarginės kopijos | Pagal faktiškai patikrintą paslaugos planą | Supabase | Taip, automatiškai keičiamos | Vytis patikrina trukmę Supabase → Database → Backups | Vyčio veiksmas, iki PILOT READY |

Kitos kategorijos, kurių šis sprendimas neapima:

- **Užduočių paveikslėliai:** saugomi, kol yra užduotis, bet dabar lieka ir ištrynus užduotį. Nenaudojamų failų valymas POST-V1. Produkcijoje 1 failas.
- **Prašymo nuorodos:** siūlau trinti kartu su prašymais, 90 dienų po galiojimo pabaigos ar atšaukimo (tame pačiame CLS-018 darbe).
- **Dalyvio naršyklė:** komandos žetonas galioja 24 valandas. Kodo nereikia.
- **Bandymų ribojimo identifikatoriai:** tik serverio atmintyje. Kodo nereikia.
- **Paslaugų teikėjų žurnalai:** pagal teikėjų nustatymus. Supabase Auth žurnalas duomenų bazėje produkcijoje tuščias (2026-11-08).

## Minimalūs pakeitimai

Naujos infrastruktūros nereikia. Migracijų nereikia: visi laiko laukai jau yra. Abu darbai naudoja esamą naktinį Vercel cron (`/api/cron/finish-stale-activities`, 02:00 UTC) ir tą patį `CRON_SECRET`.

**CLS-017. Importuoti dokumentai (P1, iki PILOT READY).**

- `app/api/import/process`: po sėkmingo apdorojimo ištrinti failą iš saugyklos. Nepavykus failas lieka, kad vedėjas galėtų bandyti dar kartą.
- Naktinis darbas: per Storage API ištrinti `documents/imports/**` failus, senesnius nei 7 dienos.
- Patikra: testas su imituota saugykla parenka tik senesnius nei 7 dienos failus; peržiūros diegime įkėlus ir apdorojus dokumentą jo saugykloje nebėra.

**CLS-018. Naktinis saugojimo valymas (P2, V1-BLOCKER, iki 2027-02-04).**

- Vienas modulis, kviečiamas iš to paties naktinio darbo, su tuo pačiu laiko biudžetu.
- Taisyklės:
  - prašymai po sprendimo senesni nei 90 dienų;
  - nebegaliojančios nuorodos senesnės nei 90 dienų;
  - komandos veiklose, pasibaigusiose prieš daugiau nei 6 mėnesius;
  - DI ir žurnalo įrašai senesni nei 12 mėnesių.
- Režimas `RETENTION_MODE`: numatytasis `report` tik suskaičiuoja, `delete` trina. Pirmi paleidimai tik skaičiuoja; Vytis įjungia trynimą peržiūrėjęs skaičius.
- Kiekvienas paleidimas įrašo į administravimo žurnalą tik skaičius, be asmens duomenų.
- Patikra:
  - testai: ribinės datos;
  - `test:db`: senesni įrašai trinami, naujesni lieka;
  - ištrynus komandas, veikla ir užduotys lieka;
  - po produkcijos įjungimo ataskaitos užklausa (žemiau) rodo 0.

**Nebūtina, Vyčio sprendimas.** Jei KU STEAM centrui ataskaitoms reikia ilgalaikių dalyvių skaičių, prieš trinant rezultatus galima išsaugoti tik skaičius veiklos eilutėje. Tam reikėtų mažos migracijos. Jei tokių ataskaitų nereikia, nedarome.

## Ištrynimo procedūra

**Periodinis valymas (kol nėra CLS-018, ir po jo patikrai).** Ataskaita, tik SELECT:

```sql
select 'access_requests' as k, count(*) from public.access_requests
  where status in ('approved', 'rejected') and reviewed_at < now() - interval '90 days'
union all select 'access_requests_undecided', count(*) from public.access_requests
  where status = 'pending' and created_at < now() - interval '90 days'
union all select 'teams', count(*) from public.teams t join public.games g on g.id = t.game_id
  where g.status = 'finished' and g.finished_at < now() - interval '6 months'
union all select 'ai_usage', count(*) from public.ai_usage where created_at < now() - interval '12 months'
union all select 'admin_audit_log', count(*) from public.admin_audit_log where created_at < now() - interval '12 months'
union all select 'documents', count(*) from storage.objects
  where bucket_id = 'documents' and created_at < now() - interval '7 days';
```

Užklausa patikrinta vietinėje Postgres 17 kopijoje. Jei kurioje nors eilutėje skaičius didesnis nei 0, trynimą vykdo CLS-018 darbas `delete` režimu, Vyčiui patvirtinus. Rankinis trynimas SQL Editor tik išimtiniu atveju, viena transakcija, ištrintų eilučių skaičius turi sutapti su ataskaita. Dokumentų failus trinti tik per Storage API ar skydelį, ne SQL.

**Neaktyvios paskyros (kas pusmetį).**

1. Super administratorius Vartotojų sąraše randa paskyras, kurios neprisijungė 24 mėnesius.
2. Parašo vedėjui. Jei vedėjas paskyros nebenori arba neatsako per 30 dienų, paskyrą užblokuoja.
3. Ištrina Supabase → Authentication → Users. Kartu ištrinamos vedėjo veiklos su dalyvių rezultatais ir pamokų planai. Patvirtinti bibliotekos šablonai lieka be autoriaus.
4. Užrašo datą ir skaičių (be el. pašto adresų).

**Žmogaus prašymas ištrinti duomenis (steam@ku.lt arba dpo@ku.lt).**

1. Atsakyti per vieną mėnesį.
2. Vedėjui: kaip 3 žingsnis aukščiau. Jei prašo, ištrinti ir jo bibliotekos šablonus (Administravimas → Moderavimas → „Pašalinti“).
3. Dalyviui: komandą pagal veiklos kodą ir komandos pavadinimą pašalina veiklos vedėjas (veiklos puslapyje).
4. Užrašyti, kas ir kada įvykdyta.

## Patikrinimo kriterijai

- CLS-017: po apdorojimo failo saugykloje nėra; naktinis darbas ištrina tik senesnius nei 7 dienos failus.
- CLS-018: `report` režimo skaičiai sutampa su ataskaitos užklausa; po `delete` ataskaita rodo 0; naujesni įrašai lieka; veikla ir užduotys lieka; administravimo žurnale yra paleidimo įrašas su skaičiais.
- Procedūros: pirmas neaktyvių paskyrų peržiūros įrašas; prašymų įvykdymo įrašai.
- Pranešimas: kiekvienas jame nurodytas terminas turi įgyvendintą mechanizmą arba aprašytą procedūrą.

## Produkcijos apimtis (2026-11-08)

Vyčio SELECT patikra (`docs/privacy-review.md`):

| Kas | Kiekis |
| --- | --- |
| Paskyrų prašymai | 1 (nuo 2026-11-06) |
| DI įrašai | 0 |
| Administravimo žurnalas | 3 (nuo 2026-11-06) |
| Auth žurnalas | 0 |
| Saugyklos failai | 1, `challenge-images`, nuo 2026-03-02 |

Apimtis maža, todėl pirmas valymas bus paprastas.

## Laukia Vyčio sprendimo

1. Patvirtinti terminus (lentelė viršuje) ir kad KU neturi ilgesnių prievolių DI ir administravimo įrašams.
2. Nepriimti sprendimo prašymai: siūlau tą patį 90 dienų terminą nuo pateikimo.
3. Ar reikia ilgalaikių dalyvių skaičių ataskaitoms (nebūtina migracija).
4. Atsarginių kopijų trukmė pagal Supabase planą.
5. Leisti CLS-017 ir CLS-018 darbus. CLS-017 reikia iki PILOT READY.
