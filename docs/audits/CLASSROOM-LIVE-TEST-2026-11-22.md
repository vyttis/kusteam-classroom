# CLASSROOM gyvas bandymas su mokytojo paskyra (produkcija)

Data: 2026-11-22, 20:35–21:00 UTC. Papildo [`CLASSROOM-TEACHER-READINESS-2026-11-22.md`](CLASSROOM-TEACHER-READINESS-2026-11-22.md).
Vykdė: Claude Code su Vyčio leidimu. Produkcija `pamokos.kusteam.app`, diegimas iš `51161c1`.

Paskyra: `vytis.radvila+cls-t1@ku.lt`, vaidmuo `teacher`, sukurta Vyčio per administratoriaus skydelį. Prisijungimo kodą iš laiško perdavė Vytis. Dalyviai: 6 sintetinės komandos atskirose naršyklėse (iPhone 13, Pixel 7, iPad ir kompiuterio emuliacija, Chromium). Tai nėra tikri įrenginiai: iOS Safari, kamera, klaviatūra ir mokyklos Wi-Fi lieka NOT TESTED.

## Rezultatas

Visas mokytojo ir pamokos kelias nuo prisijungimo iki CSV praėjo. Naujų P0 ar P1 nerasta. Patvirtinti keli audito P2 radiniai ir rasti keturi nauji smulkesni.

## Kas praėjo (PASS, faktiškai paleista)

| Nr. | Scenarijus | Faktinis rezultatas |
| --- | --- | --- |
| G-01 | Prisijungimas el. pašto kodu | kodas išsiųstas (200), patvirtintas, nukreipta į `/onboarding` |
| G-02 | Registracijos užbaigimas | be sutikimo neleidžia („pažymėkite sutikimą“); užpildžius atsidaro skydelis su „Pirmieji žingsniai“ |
| G-03 | Užduotis per redaktorių | tuščios formos mygtukas išjungtas; išsaugota; po perkrovimo yra; neišsaugota forma perkraunant rodo naršyklės įspėjimą |
| G-04 | Laukų validacija | tuščias pavadinimas, 201 ženklas, 5000 taškų, 600 ženklų atsakymas, be atsakymo, `http://` paveikslėlis: visi 400 su lietuvišku tekstu |
| G-05 | Paveikslėlio įkėlimas | PNG priimtas; SVG ir HTML atmesti |
| G-06 | Administratoriaus sritis mokytojui | 4 API maršrutai 403; 5 puslapiai nukreipia į skydelį; vaidmens keitimas 403 |
| G-07 | Data API mokytojo žetonu | mato tik savo veiklą ir profilį; `answer_hash`, `accepted_answer_hashes`, `session_token`, `submissions.answer`, `access_requests`, `admin_audit_log`, `ai_usage`: 403; savo vaidmens ir DI limito keitimas: 403 |
| G-08 | Data API be prisijungimo | `games`, `teams`, `challenges`, `library_items`: 401; `profiles`: 0 eilučių |
| G-09 | Supabase registracija | `disable_signup: true`; išoriniai tiekėjai tik `google` ir `email` |
| G-10 | Veiklos pradėjimas | patvirtinimo langas, būsena „Vyksta“, rodomas kodas ir `pamokos.kusteam.app/play/<kodas>` |
| G-11 | 6 komandų prisijungimas vienu metu | visos per 2–7 s; vedėjo ekranas iškart rodo 6 komandas |
| G-12 | Komandos pavadinimas | dublikatas atmestas; 31 ženklas atmestas; nežinomas kodas 404 |
| G-13 | Atsakymai | neteisingas atmestas; teisingas įskaitytas; `98,0` ir `98.00` priimti; `sventoji` priimtas vietoj „Šventoji“; alternatyvus ` SEPTYNI ` priimtas; tuščias ir per ilgas 400 |
| G-14 | Dvigubas pateikimas | du vienalaikiai teisingi: taškai vieną kartą, antras „jau išspręsta“ |
| G-15 | Užuominos | atverta užuomina grąžinta; 200 taškų užduotis po vienos užuominos davė 180; neegzistuojanti 400 |
| G-16 | Dalyvio duomenys | atsakyme nėra maišų, paaiškinimų, kitų komandų žetonų; neatvertos užuominos `null`; be žetono užduočių 0; neteisingas žetonas pateikiant 401 |
| G-17 | Lyderių lentelė | laukai tik `id`, `name`, `total_points`, `solved`, `achievements`; kitos komandos sprendimas matomas po 0,8 s |
| G-18 | Pranešimas | dalyvio ekrane po 2,4 s; matomas ir klasės ekrane |
| G-19 | Pauzė ir tęsimas | dalyvis mato po 1,2 s; atsakymas per pauzę 403; po tęsimo priimamas |
| G-20 | Pratęsimas 5 min. | dalyvio laikmatis 17:45 → 22:37 |
| G-21 | Užduotis pridėta vykstant | dalyvis mato „iš 5“ po 1,2 s; vykstančios veiklos užduoties trynimas 409 |
| G-22 | Perkrovimas ir grįžimas | perkrovus būsena ir taškai atkurti; uždarius naršyklę ir atvėrus su tuo pačiu žetonu grįžta; naujas įrenginys be žetono patenka į prisijungimą; vedėjo grįžimo nuoroda veikia |
| G-23 | Užbaigimas | patvirtinimo langas; dalyvis mato pabaigą po 4,9 s; atsakymas po pabaigos 403; prisijungimas 404; pakartotinis atvėrimas 409 |
| G-24 | Refleksija | išsaugota; antra 409 |
| G-25 | Rezultatai ir CSV | suvestinė ir analitika sutampa su pateiktais atsakymais (19 bandymų, 13 teisingų); abu CSV su BOM, `;` ir teisingomis raidėmis |
| G-26 | Veiklos kopijavimas | 5 užduotys, atsakymai ir alternatyvus atsakymas perkelti, `needs_answer` 0 |
| G-27 | DI užduočių pasiūlymai | 3 pasiūlymai per 37 s, pagal veiklos temą; rodomas atsakymas ir „DI patikrino“; „Pridėti“, „Redaguoti“, „Atmesti“; antras paspaudimas užblokuotas, serveryje vienas kvietimas |
| G-28 | DI pamokos planas | Biologija, 7 klasė, 45 min.: 7 etapai per 104 s; neišsaugotas planas atkurtas grįžus; išsaugotas ir atidaromas |
| G-29 | DI apskaita | `used: 2`, `remaining: 38` po dviejų kvietimų |
| G-30 | Klasės ekranas 1920×1080 | laikmatis, lentelė, QR, kodas, pranešimas; taškai 36 px, pavadinimai 30 px |
| G-31 | Atsijungimas | nukreipia į `/vedejui`; skydelis nebepasiekiamas |

Apkrova šio bandymo metu: 30 lygiagrečių lentelės užklausų per 0,7 s, visos 200, pusė iš CDN talpyklos. Vercel runtime klaidų nebuvo.

## Patvirtinti audito radiniai

| Radinys | Kas pamatyta gyvai |
| --- | --- |
| R-10 | Klaidos ekrane „Prisijungti iš naujo“ be patvirtinimo ištrynė komandos žetoną; tas pats pavadinimas po to „jau užimtas“ |
| R-11 | Dalyvis 14 s be ryšio: jokio pranešimo, laikmatis eina. Pranešimas po 17 s nebematomas |
| R-13 | Grįžimo nuoroda suveikė dviejuose skirtinguose įrenginiuose; senasis žetonas liko galioti. Pakeitus vykstančios užduoties atsakymą, anksčiau išsprendusios komandos liko su taškais, o senas atsakymas naujoms tapo neteisingas |
| R-16 | Atsijungus viename įrenginyje, kitame iškart 401; išsaugojimas grąžina tik „Neautorizuota“ |
| R-19 | Refleksijos formos laukai be susietų etikečių |

Pataisymai ataskaitai:

- R-09 sąlyginė rizika (iš anksto užregistruotas adresas) šiuo metu uždaryta: registracija produkcijoje išjungta (G-09).
- R-01 ir R-03 (žemėlapis) ištaisyti #133 ir #134. Gyvai jie šiame bandyme netikrinti: nebuvo nei bibliotekos įrašo su svetimu šaltiniu, nei užduoties su žemėlapiu.

## Nauji radiniai

**N-1 (P2). Vedėjo API veikia dar neužbaigus registracijos.** Aktyvi paskyra su `onboarding_completed = false` nukreipiama iš puslapių į `/onboarding`, bet `POST /api/games` grąžino 201. Mokytojas gali naudotis platforma nepatvirtinęs privatumo pranešimo. Taisymas: API vartuose tikrinti ir registracijos užbaigimą.

**N-2 (P3). `/api/play/status` neina per CDN talpyklą.** Du iš eilės kvietimai grąžino `x-vercel-cache: MISS`; lentelės maršrutas grąžina `HIT`. Kiekviena būsenos užklausa (kas 5 s kiekvienam įrenginiui) pasiekia funkciją ir DB. Audito apkrovos lentelėje galioja eilutė „talpykla neveikia“ būsenos daliai: apie 6 DB užklausas per sekundę 30 įrenginių.

**N-3 (P3). DI pasiūlymai dingsta perkrovus puslapį.** Sugeneruoti, bet dar nepridėti pasiūlymai po perkrovimo neatkuriami, nors užklausa jau nuskaičiuota. Likučio eilutė iki perkrovimo rodė seną skaičių (40 vietoj 39).

**N-4 (P3). DI užuomina gali atskleisti atsakymą.** Vienoje iš trijų sugeneruotų užduočių trečia užuomina buvo „Tikslus skaičius artimas 1584 km²“, kai atsakymas 1584. Tikrintojas pažymėjo „DI patikrino“. Tai pedagoginės kokybės, ne saugumo klausimas; mokytojo peržiūra būtina.

## Prisijungimas be slaptažodžio

Vyčio klausimas bandymo metu: sukūrus paskyrą atėjo laiškas su mygtuku, bet slaptažodžio susikurti nepasiūlyta.

Taip ir sumanyta. Platformoje slaptažodžių nėra: kode nėra nei `signInWithPassword`, nei slaptažodžio keitimo. Mokytojas jungiasi vienkartiniu kodu iš laiško arba per Google. Laiško mygtukas veda į `/vedejui`, be jokio prisijungimo žetono. Todėl „pamiršau slaptažodį“ funkcijos nereikia: pamiršti nėra ko.

Kas iš tikrųjų trūksta:

- laiške ir prisijungimo puslapyje nepasakyta, kad slaptažodžio nėra ir kad kodas ateis kiekvieną kartą;
- nėra mygtuko „siųsti kodą dar kartą“, o neteisingas ir pasibaigęs kodas rodo tą patį pranešimą (R-16).

Jei norima slaptažodžių, tai atskiras sprendimas: jis keičia Supabase Auth nustatymus ir prideda slaptažodžių saugojimo bei atkūrimo riziką.

## Netikrinta

- Prisijungimas per Google; paskyros blokavimas gyvai (reikia super administratoriaus veiksmo); Realtime nutrūkimas vedėjo ekrane.
- Tikri įrenginiai, kamera, mokyklos Wi-Fi (CLS-002).
- Dokumento importas į DI.

## Kas liko produkcijoje

Nieko netrinta. Visi įrašai priklauso testinei paskyrai:

| Kas | Identifikatorius |
| --- | --- |
| Paskyra | `vytis.radvila+cls-t1@ku.lt`, aktyvi, atsijungta |
| Baigta veikla | „TEST auditas 2026-11-22“, kodas `V6XV72`, 6 komandos, 1 refleksija |
| Juodraštis | „TEST auditas 2026-11-22 (kopija)“, kodas `HKA4QM` |
| Pamokos planas | „Augalų prisitaikymas prie aplinkos: kodėl augalai skirtingi?“ |
| Paveikslėlis | 1 bandomasis PNG kibire `challenge-images` |
| DI | 2 kvietimai iš 40 |

Sprendimas, ar paskyrą blokuoti ir ar duomenis trinti, lieka Vyčiui.
