# Duomenų saugojimas ir ištrynimas (CLS-014)

**Suderinimo dokumentas.** Sprendimas S13 (Vytis Radvila, 2026-11-08): saugojimo terminai derinami su KU duomenų apsaugos pareigūnu (DAP). Claude Code jų nenustato. Kol terminai nesuderinti, šis dokumentas yra pagrindas pokalbiui su DAP, ne patvirtintas planas.

Suvestinė privatumo pranešimui (CLS-013). Faktai patikrinti kode ir migracijose 2026-11-08.

**v1.0 sąlyga.** CLASSROOM v1.0 priimamas tik turint patvirtintą ir įgyvendinamą saugojimo planą: kiekvienai kategorijai patvirtintas terminas, atsakingas asmuo ir būdas, kuriuo duomenys ištrinami. Būdas gali būti rankinė procedūra. Automatinis trynimas gali būti vėlesnės versijos funkcija, bet privatumo pranešimas turi aprašyti tai, kas iš tikrųjų daroma.

## Kategorijos

„Dabar“ reiškia, kaip yra šiandien. „Siūlomas procesas“ yra pasiūlymas, kurį tvirtina Vytis; terminas jame paliktas DAP.

| Nr. | Duomenys | Kur | Dabar saugoma | Esamas ištrynimo būdas | Siūlomas procesas | Klausimas DAP |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Vedėjų paskyros ir profiliai | Supabase `auth.users`, `profiles` | Kol ištrinama | Platformoje paskyrą galima tik užblokuoti. Ištrinti galima tik Supabase skydelyje (Authentication → Users). Kartu ištrinamos veiklos su dalyvių duomenimis ir pamokų planai | Ištrinti vedėjo prašymu ir periodiškai peržiūrėti neaktyvias paskyras. Atlieka super administratorius, užrašo, kas ir kada ištrinta (skydelio veiksmas į `admin_audit_log` nepatenka) | Terminas neaktyviai paskyrai. Ar ištrinant paskyrą trinti ir veiklų rezultatus |
| 2 | Paskyrų prašymai, taip pat atmesti | `access_requests` (vardas, pavardė, el. paštas, mokykla, šaltinis, sprendimas) | Neribotai. Ištrynus paskyrą prašymas lieka | Nėra | Periodinis rankinis trynimas pagal terminą (paruošta SQL užklausa, Vyčio patvirtinimas) | Terminai patvirtintiems ir atmestiems prašymams |
| 3 | Prašymo nuorodos | `request_links` (žyma, kas sukūrė, galiojimas) | Neribotai, atšauktos lieka | Atšaukimas platformoje, trynimo nėra | Kartu su 2 kategorija | Ar žyma laikoma asmens duomenimis, jei joje įrašytas vardas |
| 4 | Veiklos, užduotys, skelbimai | `games`, `challenges`, `announcements` | Kol vedėjas ištrina. Naktinis darbas veiklas tik užbaigia | Vedėjas ištrina veiklą (kaskada) | Vedėjams rekomenduoti trinti nebereikalingas veiklas; periodinė senų baigtų veiklų peržiūra | Terminas baigtoms veikloms |
| 5 | Dalyvių duomenys | `teams`, `submissions`, `hint_reveals`, `achievements`, `reflections` | Kaip veikla | Kaskada su veikla; vedėjas gali pašalinti komandą | Kartu su 4 kategorija | Terminas. Ar refleksijas ar statistiką galima laikyti ilgiau be komandų pavadinimų |
| 6 | Pamokų planai | `lesson_plans` | Kol vedėjas ištrina | Vedėjas ištrina; kaskada ištrynus paskyrą | Kartu su 1 kategorija | Ar reikia atskiro termino |
| 7 | Bibliotekos įrašai | `library_items` | Neribotai. Ištrynus autorių įrašas lieka be autoriaus | Super administratorius ištrina platformoje | Turinio peržiūra kartu su 1 kategorija | Ar įrašas gali likti ištrynus autoriaus paskyrą |
| 8 | Užduočių paveikslėliai | Supabase saugykla `challenge-images` (vieša) | Neribotai. Lieka ištrynus užduotį, veiklą ar paskyrą | Nėra (kode nėra `storage.remove`), tik Supabase skydelis | Vienkartinis nebenaudojamų failų valymas pagal patvirtintą sąrašą; vėliau trynimas kartu su užduotimi | Terminas. Ar paveikslėliuose gali būti žmonių atvaizdai |
| 9 | Vedėjų įkelti dokumentai | Supabase saugykla `documents`, `imports/<vedėjas>/...` | Neribotai, ir po importo | Nėra | Periodinis rankinis trynimas; vėliau trynimas iškart po importo | Ar dokumentą reikia laikyti po importo; jei taip, kiek |
| 10 | DI naudojimo įrašai | `ai_usage` (naudotojas, funkcija, modelis, žetonai, kaina, laikas, be užklausų turinio) | Neribotai. Ištrynus paskyrą įrašas lieka be naudotojo | Nėra | Periodiškai pasilikti tik mėnesio sumas ir ištrinti eilutes | Terminas, atsižvelgiant į išlaidų apskaitą |
| 11 | Administratorių veiksmų žurnalas | `admin_audit_log` (veiksmas, kas, kada; `details` yra el. pašto adresai) | Neribotai. Ištrynus paskyrą įrašas lieka, el. paštas detalėse lieka | Nėra | Periodinis rankinis trynimas pagal terminą | Terminas |
| 12 | Vedėjų prisijungimo įvykiai | Supabase Auth (`auth.audit_log_entries`, gali būti IP adresas) | Produkcijoje 0 įrašų (2026-11-08). Supabase žurnalai už DB ribų nepatikrinti | Supabase nustatymai | Patikrinti; jei įrašai kaupiami, įtraukti į planą | Terminas. Ar šis žurnalas reikalingas |
| 13 | Bandymų ribojimo identifikatoriai | Serverio egzemplioriaus atmintis (HMAC iš IP adreso) | Kol veikia serverio egzempliorius | Išnyksta su egzemplioriumi | Nieko nekeisti | Ar pakanka aprašymo pranešime |
| 14 | Dalyvio naršyklė | `localStorage`: komandos žetonas, pradžios laikas, refleksijos būsena | Žetonas laikomas negaliojančiu po 24 val.; likusius išvalo „Išeiti“ arba naršyklė | „Išeiti“ dalyvio ekrane, naršyklės duomenų valymas | Nieko nekeisti | Ar pakanka aprašymo pranešime |
| 15 | Atsarginės kopijos | Supabase | Kasdien; trukmė pagal Supabase planą, nepatikrinta | Automatiškai pagal planą | Patikrinti planą ir įrašyti trukmę į planą bei pranešimą | Ar trukmė tinka |
| 16 | Išsiųsti laiškai | Resend žurnalai | Nepatikrinta | Resend nustatymai | Patikrinti Resend paskyroje | Terminas, jei reikia |
| 17 | Paslaugų teikėjų techniniai žurnalai | Vercel, Supabase | Pagal teikėjų planus, nepatikrinta | Automatiškai pagal teikėją | Patikrinti ir įrašyti į planą | Ar reikia nurodyti pranešime |

## Produkcijos apimtis (2026-11-08)

Vyčio SELECT patikra (`docs/privacy-review.md`): `access_requests` 1 įrašas (nuo 2026-11-06), `ai_usage` 0, `admin_audit_log` 3 (nuo 2026-11-06), `auth.audit_log_entries` 0, `storage.objects` 1 failas `challenge-images` (nuo 2026-03-02). Apimtis maža, todėl pirmas rankinis vykdymas paprastas, bet terminai reikalingi prieš v1.0.

## Siūloma rankinė procedūra v1.0

Kol nėra automatinio trynimo:

1. Kiekvienai kategorijai Vytis patvirtina terminą ir atsakingą asmenį pagal DAP atsakymą.
2. Claude Code repozitorijoje paruošia peržiūros užklausas (tik SELECT) ir trynimo užklausas kiekvienai kategorijai, su testu vietinėje Postgres 17.
3. Nustatytu periodiškumu (pvz., semestro pabaigoje) super administratorius paleidžia peržiūrą, Vytis patvirtina, tada vykdomas trynimas SQL Editor arba Supabase skydelyje.
4. Kiekvienas vykdymas užrašomas: data, kategorija, kiek įrašų ištrinta, kas vykdė.
5. Privatumo pranešime aprašomi patvirtinti terminai ir tai, kad trynimas atliekamas periodiškai.

Automatinis trynimas (pvz., naktinis darbas) yra atskira užduotis po plano patvirtinimo.

## Ko šis dokumentas nesprendžia

- Konkrečių terminų.
- Teisinio pagrindo (`docs/privacy-review.md`, 1 klausimas).
