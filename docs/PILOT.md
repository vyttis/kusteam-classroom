# CLASSROOM pilotas su tikrais įrenginiais (CLS-002)

Tikslas: patikrinti, ar interaktyvi pamoka veikia tikroje klasėje su 5–10
dalyvių įrenginių, QR kodu, projektoriumi ir mokyklos tinklu, ir ar ji
pedagogiškai pasiteisina. Pilotas nėra viešas paleidimas. Datą, vietą ir
dalyvius derina Vytis Radvila.

Pilotas vyksta tik pasiekus CLASSROOM PILOT READY (`kusteam-ai-lab/docs/MILESTONES.md`):
OPS-001 ir OPS-002 atlikti, privatumo pranešimas (CLS-013) patvirtintas ir
paskelbtas, registracijos patikra (CLS-004) praėjo.

## Kas jau patikrinta be tikrų įrenginių

- Automatiniai testai (`npm test`) ir CI: atsakymų tikrinimas serveryje,
  dalyvio puslapiai nenaudoja Supabase naršyklėje, RLS ir migracijos.
- `E2E smoke (production)` po kiekvieno diegimo: įėjimai `/prisijungti` ir
  `/vedejui`, seni QR adresai, dalyvio įėjimas be horizontalaus slinkimo
  telefono pločiu, sveikatos patikra.
- Gyva eiga produkcijoje (CLS-001, 2026-11-07, veikla ZJR2JK): vienas
  dalyvis kompiuterio naršyklėje prisijungė kodu, neteisingas atsakymas
  atmestas, užuomina ir teisingi atsakymai priimti. Vedėjo ekranas gavo
  komandą, taškus ir sprendimus realiu laiku. Dalyvio lentelė atsinaujino
  per 4 s. Vedėjo pridėta užduotis, skelbimas ir pauzė dalyvį pasiekė per
  iki 7 s. Perkrovus puslapį komanda atkurta.

### Ko tai neįrodo

- **Telefonai ir Safari.** Tikrinta kompiuterio Chromium. iOS Safari,
  ekrano klaviatūra, automatinis priartinimas ir lietimas netikrinti.
- **QR.** Nei projektoriaus QR nuskaitymas telefono kamera, nei QR
  skaitytuvas `/prisijungti` puslapyje (naršyklės leidimas kamerai) tikru
  įrenginiu netikrinti.
- **Kelios komandos.** Tikrinta viena komanda. Kaip lentelė ir vedėjo
  ekranas elgiasi su 5–10 komandų vienu metu, nežinoma.
- **Mokyklos tinklas.** Mokyklos Wi-Fi, ugniasienė, prisijungimo puslapis
  (captive portal) ir vienas viešas adresas visai klasei neimituoti. Ribos
  pagal adresą dosnios (komandų kūrimas 400 per minutę), bet tikrame tinkle
  nepatikrintos.
- **Ryšio nutrūkimas ir užrakintas ekranas.** Neįrodyta, kad nutrūkus
  ryšiui atsakymas neprarandamas ir kad atrakinus ekraną būsena atsinaujina.
- **Įrenginio pakeitimas.** Grąžinimo į komandą QR (vedėjo ekrane
  „Grąžinti į komandą“) tikru antru įrenginiu netikrintas. Kaip jis veikia
  (kodas vienkartinis, senas įrenginys atjungiamas), aprašyta skyriuje
  „Grąžinimas į komandą“.
- **Projektorius.** Kodo, QR, laikmačio ir lentelės įskaitomumas iš
  paskutinio suolo neįvertintas.
- **Žmonės.** Ar dalyviai supranta užduotis, ar vedėjas suspėja per pamoką,
  ar veikla atitinka pamokos tikslą.

## Prieš pilotą

| Kas | Veiksmas |
| --- | --- |
| Vytis | Suderina datą, vietą, mokytoją ir dalyvius (5–10 komandų, po vieną įrenginį komandai) |
| Vytis | Suderina įrenginius: bent du iPhone su Safari, bent du Android su Chrome, bent viena planšetė, projektorius, vedėjo kompiuteris. Atsarginis mobilusis internetas |
| Vytis | Su mokykla suderina dalyvavimo sąlygas pagal KU tvarką. Dalyviai naudoja tik komandų vardus, be vardų ir pavardžių. Mokinių veidų nefotografuojame, fotografuojami tik ekranai |
| Vytis | Patvirtina, kas veda: pats ar pilotinis mokytojas. Pilotinis mokytojas turi aktyvią vedėjo paskyrą (kvietimas per Administravimas → Vartotojai) |
| Vytis, vedėjas | Projektorius jungiamas kaip išplėstas ekranas: projektoriuje gyvas ekranas, vedėjo kompiuteryje veiklos puslapis. Grąžinimo QR negalima rodyti visai klasei (procedūra skyriuje „Grąžinimas į komandą“) |
| Vedėjas | Paruošia 30–40 min. veiklą su 5–8 užduotimis: bent viena su užuomina, bent viena su paveikslėliu, laiko riba. Įjungia „Priimti vedėjo paskyros prašymus“, jei norima patikrinti prašymų duris |
| Vytis | Piloto dieną nekeičia produkcinių raktų ir nustatymų (OPS-001, OPS-002 atlikti iš anksto) |
| Claude Code | Piloto dieną paleidžia `E2E smoke (production)`, peržiūri Vercel klaidas ir `https://pamokos.kusteam.app/api/health` |
| Claude Code | Išspausdinama arba ekrane paruošiama radinių lentelė (žemiau) |

## Eiga klasėje

Vedėjas veda įprastai. Stebėtojas pildo radinių lentelę ir pažymi laiką.
Šalia įprastų veiksmų sąmoningai atliekami pažymėti bandymai.

| Etapas | Ką tikriname |
| --- | --- |
| Pasiruošimas | Vedėjas prisijungia `/vedejui`, pradeda veiklą („Pradėti veiklą“), atidaro gyvą ekraną projektoriuje, įjungia „Visas ekranas“ ir „Pateiktis“. **Projektorius:** ar kodas, QR ir laikmatis įskaitomi iš paskutinio suolo? Ar QR adresas yra `pamokos.kusteam.app/play/<kodas>`? |
| Prisijungimas | **QR kamera:** pusė komandų nuskaito projektoriaus QR telefono kamera. Iš kokio atstumo pavyksta? Kiek telefonų nepavyko? **QR skaitytuvas:** viena komanda atidaro `pamokos.kusteam.app/prisijungti` ir naudoja „arba“ skaitytuvą (naršyklė prašo leidimo kamerai). **Kodas:** likusios komandos įveda kodą ranka. **Laikas:** per kiek minučių prisijungė visos komandos? Ar visos prisijungė mokyklos tinklu? |
| Komandos vardas | **Klaviatūra:** ar iPhone Safari nepriartina vaizdo paspaudus lauką „Komandos vardas“? Ar mygtukas matomas atidarius klaviatūrą? |
| Užduotys | Dalyviai sprendžia. **Atsakymas:** neteisingas atmetamas, teisingas priimamas. **Užuomina:** bent viena komanda ją atidaro, taškų pasikeitimas suprantamas. **Paveikslėlis:** įsikelia ir įskaitomas telefone |
| Vedėjo ekranas | Ar vedėjas mato visas komandas, taškus ir kuri komanda stringa? Ar lentelė projektoriuje atsilieka nuo telefonų? |
| Ryšio nutrūkimas | Vienas telefonas įjungia lėktuvo režimą, įveda atsakymą ir bando pateikti. Laukiama klaida („Tinklo klaida. Bandykite dar kartą.“ arba „Nepavyko pateikti atsakymo“). Ar įvestas atsakymas lieka lauke? Išjungus lėktuvo režimą atsakymas pateikiamas, taškai įskaitomi |
| Užrakintas ekranas | Vienas telefonas 1–2 min. užrakinamas. Tuo metu vedėjas siunčia skelbimą. Atrakinus: ar skelbimas matomas, būsena ir laikmatis teisingi, darbas neprarastas? |
| Pauzė ir skelbimas | Vedėjas pristabdo („Pristabdyti“), po minutės tęsia („Tęsti“). Ar visi įrenginiai mato pauzę per kelias sekundes? Ar laikmatis sustoja? Skelbimas pasiekia visus įrenginius (laukta iki 7 s) |
| Sesijos atkūrimas tame pačiame įrenginyje | Viena komanda perkrauna puslapį. Kita visiškai uždaro naršyklę ir vėl atidaro `pamokos.kusteam.app/play/<kodas>`. Laukiama: ta pati komanda, taškai ir išspręstos užduotys išlieka |
| Įrenginio pakeitimas | Viena komanda pereina į kitą įrenginį pagal skyriaus „Grąžinimas į komandą“ procedūrą. Naujas įrenginys tęsia toje pačioje komandoje. Kiek laiko tai užtrunka? **Senas įrenginys:** bando pateikti atsakymą. Laukiama: atsakymas nepriimamas, ekranas rodo „Komanda tęsia kitame įrenginyje“. Ar dalyviai supranta, kas nutiko? Ar QR nebuvo matomas kitoms komandoms? |
| Panaudotas grąžinimo QR | Tą patį grąžinimo QR nuskaityti antru įrenginiu. Laukiama: „Ši nuoroda jau panaudota. Paprašykite vedėjo naujos.“ |
| Pasibaigęs grąžinimo QR | Nepanaudotą grąžinimo QR nuskaityti po 10 min. Laukiama: „Nuoroda nebegalioja. Paprašykite vedėjo naujos.“ |
| Privatus langas (jei yra iPhone) | Komanda prisijungia Safari privačiame lange, uždaro skirtuką. Ar grįžti galima tik per vedėjo „Grąžinti į komandą“? Ar vedėjas tai supranta be pagalbos? |
| Pabaiga | Vedėjas baigia veiklą („Baigti veiklą“). Visi įrenginiai rodo pabaigos ekraną ir galutinę lentelę. Jei įjungta, dalyviai užpildo refleksiją. **Prašymų durys:** pabaigos ekrane ir gyvame ekrane („Rodyti prašymo QR“) tik patikrinama, ar matoma. Prašymas teikiamas tik tuo atveju, jei mokytojas tikrai nori paskyros |
| Po pamokos | Vedėjas atidaro „Veiklos ataskaita“. Ar matoma, kurios užduotys buvo sunkiausios, kiek užuominų panaudota? |

## Grąžinimas į komandą

Vedėjo „Grąžinti į komandą“ **perkelia komandą** į kitą įrenginį (nuo audito R-13 pataisos). Kodas:
`app/api/play/rejoin`, `lib/game/rejoin-token.ts`, `app/api/play/state` (`session_moved`),
`components/player/play-screens.tsx` (`PlaySessionMoved`).

| Situacija | Kas vyksta |
| --- | --- |
| Naujas įrenginys | Gauna naują komandos žetoną ir tęsia su tais pačiais taškais, išspręstomis užduotimis ir tuo pačiu laiku |
| Senas įrenginys | Jo žetonas nebegalioja. Bandant pateikti atsakymą, atverti užuominą ar perkrovus puslapį rodoma „Komanda tęsia kitame įrenginyje“. Kol dalyvis nieko nespaudžia, senas ekranas dar gali rodyti užduotį, bet atsakymų serveris nepriima |
| Grįžti į seną įrenginį | Tik su nauju vedėjo grąžinimo kodu; tada atjungiamas tas įrenginys, kuriame komanda buvo |
| Du įrenginiai vienoje komandoje | Per grąžinimo kodą nebeįmanoma: komanda dirba viename įrenginyje |
| Grąžinimo kodas | Galioja 10 min. ir **vieną kartą**. Panaudojus nebeveikia nei jis, nei anksčiau tai komandai sukurti kodai. Jei kodą pirmas nuskaito ne tas žmogus, komandą perima jis: vedėjas sukuria naują kodą tikrajai komandai, ir svetimas įrenginys atjungiamas. Todėl kodas vis tiek yra privatus |
| Atsakymas prarastas tinkle | Jei naujas įrenginys nuskaitė kodą, bet atsakymo negavo (dingo ryšys), kodas jau panaudotas, o senas įrenginys atjungtas: vedėjas sukuria naują kodą |

Procedūra pilote:

1. Prieš pamoką: projektorius jungiamas kaip išplėstas ekranas. Projektoriuje tik gyvas ekranas, veiklos puslapis su komandų sąrašu tik vedėjo ekrane. Jei išplėsti negalima, grąžinimą daryti iš atskiro įrenginio (vedėjo telefono ar planšetės, prisijungus prie tos pačios paskyros) arba prieš atidarant langą išjungti projektoriaus vaizdą.
2. Dalyvis prieina prie vedėjo. Vedėjas pasitikslina komandos pavadinimą.
3. Prieš spausdamas „Grąžinti į komandą“ vedėjas pažiūri, ar projektorius nerodo šio ekrano.
4. QR rodomas iš arti tik tos komandos nariui: prieiti prie suolo arba pasukti ekraną. Nuorodos nekopijuoti į klasės pokalbį ar bendrą laišką.
5. Kai naujas įrenginys rodo komandą, vedėjas uždaro langą („Uždaryti“). Senas įrenginys atjungiamas pats, „Išeiti“ jame spausti nereikia.
6. Jei kodą pirma nuskaitė kita komanda (tikroji komanda mato „Ši nuoroda jau panaudota“), vedėjas iš karto sukuria naują kodą ir parodo jį tikrajai komandai. Tai užrašoma radinių lentelėje.

Seno įrenginio atjungimas serverio pusėje ir vienkartinis grąžinimo kodas būtų nauja funkcija. Šiame etape jos nekuriamos; jei pilotas parodys poreikį, tai bus radinys backloge.

## Pedagoginis vertinimas

Stebėtojas užrašo pastebėjimus be dalyvių vardų.

| Klausimas | Kaip vertinama |
| --- | --- |
| Ar dalyviai suprato, ką daryti, be papildomo vedėjo aiškinimo? | Kiek kartų vedėjas aiškino tą patį; kurios užduotys kėlė klausimų |
| Ar komandos dirbo kartu? | Stebėjimas: ar įrenginį laiko vienas, ar sprendžia kartu |
| Ar sunkumas tinkamas? | Ataskaita: užduotys, kurių neišsprendė dauguma, ir užduotys, išspręstos per minutę |
| Ar užuominos padėjo mokytis, ar tik atskleidė atsakymą? | Stebėjimas ir vedėjo nuomonė |
| Ar laiko užteko? | Kiek komandų baigė visas užduotis per laiko ribą |
| Ar vedėjas spėjo stebėti klasę ir ekraną? | Vedėjo nuomonė, kiek kartų jis žiūrėjo į ekraną, o ne į klasę |

Po pamokos vedėjas atsako žodžiu arba raštu:

1. Ar veikla atitiko pamokos tikslą ir dalyvių amžių?
2. Ar vedėjo ekrane matėte, kuri komanda stringa, ir spėjote padėti?
3. Kiek laiko užtruko paruošti veiklą?
4. Kas trukdė labiausiai?
5. Ar vestumėte tokią pamoką dar kartą? Kodėl?

Dalyvių klausiama žodžiu, anonimiškai, atsakymai neužrašomi su vardais: kas
buvo aiškiausia, kas sunkiausia, ar norėtų dar tokios pamokos.

## Kada pilotas laikomas pavykusiu

PILOT PASSED, jei visi punktai teisingi:

- Visos komandos prisijungė per 5 min. (QR arba kodu), bent pusė per QR.
- Nė viena komanda neprarado taškų ar išspręstų užduočių.
- Atkūrimas tame pačiame įrenginyje ir įrenginio pakeitimas pavyko. Perkėlimas baigtas sename įrenginyje paspaudus „Išeiti“.
- Grąžinimo QR nebuvo rodomas visai klasei.
- Nutrūkus ryšiui atsakymas pateiktas grįžus ryšiui.
- Projektoriaus kodas ir QR įskaitomi iš paskutinio suolo.
- Nėra P0 ar P1 radinių. P2 ir P3 radiniai įrašyti į backlogą.
- Vedėjas pravedė pamoką iki galo be techninės pagalbos.

P0 (veikla sustoja, prarandami duomenys, rodomi svetimi duomenys) stabdo
pilotą. Tada vedėjas baigia veiklą, Claude Code sprendžia incidentą iš
karto.

## Po piloto

1. Vedėjas išsaugo ataskaitą. Bandomoji veikla paliekama arba ištrinama
   pagal Vyčio sprendimą.
2. Claude Code paleidžia `E2E smoke (production)`, peržiūri Vercel klaidas
   piloto laiku.
3. Claude Code parašo piloto ataskaitą `kusteam-ai-lab/docs/STATUS.md`
   (CLS-002), radiniai įrašomi į `BACKLOG.md` (CLS skyrius).
4. Vytis nusprendžia, ar pilotas pavyko, ir ar reikia CLS-003 apkrovos
   testo (jei v1.0 režimas apims daugiau nei 10 komandų).

## Radinių lentelė

| Laikas | Įrenginys ir naršyklė | Etapas | Kas nutiko | Ar sutrukdė veiklai |
| --- | --- | --- | --- | --- |
| | | | | |

## Vyčio veiksmai pilotui

Atskirai, kad būtų aišku, ko be Vyčio padaryti negalima:

1. OPS-001 ir OPS-002 (raktų pakeitimas) iki piloto.
2. Privatumo pranešimo turinio patvirtinimas (CLS-013, PR #112).
3. Testiniai el. pašto adresai ir leidimas vykdyti CLS-004
   (`docs/REGISTRATION-TEST.md`).
4. Data, vieta, mokytojas, dalyviai ir įrenginiai.
5. Dalyvavimo sąlygų suderinimas su mokykla.
6. Pilotinio mokytojo vedėjo paskyra.
7. Sprendimas po piloto: PILOT PASSED ar ne, ir ką daryti su bandomąja
   veikla.
