# DI užduočių pedagogikos ir lietuvių kalbos peržiūra (2026-11-22)

Šaka: `fix/ai-pedagogy-and-copy`. Peržiūrėta: DI nurodymai (`lib/ai/**`), pamokų planų logika (`lib/lesson-plans/**`), laiškų šablonai, pradžios puslapis, privatumo pranešimas, klaidų puslapiai, zod pranešimai.

**Svarbi išlyga.** Nurodymų pakeitimai nebuvo išbandyti su tikru DI modeliu: šioje užduotyje mokamos DI paslaugos kviesti nebuvo leista. Patikrinta tik tai, kas tikrinama be modelio (kodo taisyklės ir testai). Prieš diegiant reikia sugeneruoti bent po kelias užduotis ir planus kelioms klasėms ir dalykams ir juos peržiūrėti su dalyko mokytoju (žr. skyrių „Kas lieka žmogaus sprendimui“).

## 1. Kas buvo negerai

Bandant produkcijoje, veiklai apie Baltijos jūrą DI pasiūlė skaitinę užduotį „Kuršių marių plotas“ su atsakymu 1584. Trečia užuomina buvo „Tikslus skaičius artimas 1584 km²“, tai yra užuomina pasakė atsakymą. Tikrinantis modelis užduotį vis tiek pažymėjo „DI patikrino“.

Peržiūrėjus nurodymus rasta ir daugiau:

- Užuominoms buvo vienas sakinys („nuo bendros iki konkrečios“), be draudimo rašyti atsakymą.
- Nebuvo reikalavimo, kad atsakymas būtų vienas ir trumpas. Sistema atsakymą lygina pažodžiui, todėl ilgas ar keliais būdais užrašomas atsakymas mokiniui reiškia „neteisingai“, nors jis mąstė teisingai.
- Skaitinėms užduotims nebuvo reikalaujama nurodyti vieneto ir apvalinimo.
- Užduočių generavimas negauna klasės ir dalyko, o nurodymuose nebuvo pasakyta, ką tada daryti.
- Tikrintojas matė siūlomą atsakymą iš karto ir galėjo tiesiog su juo sutikti.
- Buvo išvardytos šešios kompetencijos. Atnaujintose Bendrosiose programose (2022 m.) jų septynios: trūko skaitmeninės. Socialinė, emocinė ir sveikos gyvensenos kompetencija buvo rašoma „Socialinė-emocinė“.
- Pamokos plano nurodymuose kaip „universalus dizainas mokymuisi“ buvo aprašyti „vizualus, garsinis, kinestetinis“ mokinių tipai. Tai mokymosi stilių teorija, kurios tyrimai nepatvirtina, ir tai nėra universalus dizainas mokymuisi.
- Pavyzdyje apie Maironio „Trakų pilį“ užuomina įvardijo teisingą variantą („Personifikacija ...“), o paaiškinime buvo cituojami žodžiai, kurių eilėraštyje nėra. Pavyzdžiai modeliui yra stipriausias signalas, todėl jis mokėsi būtent to.
- Ryšio su programa pavyzdys („BUP, Matematika 7 kl., 2.3 skyrius“) skatino išgalvoti skyrių numerius.
- Buvo frazė, kad planą turi būti galima „rodyti Švietimo ministerijos inspektoriui“. Ji neduoda jokio kokybės kriterijaus.
- Laiko planavimui pakako „turi tilpti į pamoką“, todėl planas galėjo būti gerokai trumpesnis už pamoką.

## 2. Kas pakeista ir kodėl

### 2.1. Užuominos (kodas ir nurodymai)

**Kodo patikra** (`lib/ai/hint-leak.ts`, testai `tests/hint-leak.test.ts`). Ji veikia be DI, todėl nieko nekainuoja ir nepriklauso nuo modelio nuotaikos. Užuomina laikoma atskleidžiančia atsakymą, jei joje yra:

- pats atsakymas (neskiriant didžiųjų raidžių ir diakritinių ženklų);
- kita to paties žodžio forma (atsakymas „Nemunas“, užuominoje „prie Nemuno“);
- teisingas skaičius, taip pat užrašytas lietuviškai („1 584“, „1584,0“);
- toks siauras intervalas, kad atsakymą lengva atspėti („tarp 1580 ir 1590“, „tarp 6 ir 8“, kai atsakymas 7);
- pasirinkimo užduotyje: teisingas variantas arba visi neteisingi variantai.

Skaičius, kuris jau parašytas užduoties sąlygoje, nelaikomas atskleidimu (tai duomenys). Labai trumpi ir dažni žodžiai („taip“, „ne“) neieškomi, kad nebūtų klaidingų pranešimų.

Kas vyksta radus tokią užuominą:

- generuojant užduotis ir importuojant dokumentą, užduotis gauna įvertinimą „Klaida“ su pastaba, pvz., „Užuomina nr. 3 atskleidžia atsakymą: joje parašytas teisingas skaičius. Perrašykite arba pašalinkite ją.“ Pastaboje atsakymas necituojamas;
- verčiant pamokos planą į veiklą, tokia užuomina pašalinama, o užduotis pažymima „Reikia peržiūros“ su pastaba „Pašalinta užuomina, kuri atskleidė atsakymą.“

Ko kodas nepagauna: perfrazavimo ir sinonimo („didžiausia Lietuvos upė“ vietoj „Nemunas“). Tai palikta DI tikrintojui ir vedėjui.

**Nurodymai.** Užuominos dabar aprašytos kaip laipteliai: pirma mąstymo kryptis, antra susiaurinantis faktas, trečia sprendimo būdas ar pirmas žingsnis, bet ne rezultatas. Aiškiai uždrausta rašyti atsakymą, jo sinonimą, kitą formą, skaičių, siaurą intervalą, įvardyti teisingą variantą ar atmesti visus kitus. Ta pati taisyklė naudojama užduočių, pamokos eigos ir pamokos plano nurodymuose (viena vieta kode, `HINT_RULES`).

### 2.2. Vienas neginčijamas atsakymas

- Tekstinis atsakymas: 1-3 žodžiai, vardininko forma, be skyrybos; sąlygoje pasakoma, kokio atsakymo laukiama („Atsakymą rašyk vienu žodžiu.“).
- Skaitinis atsakymas: lauke tik skaičius, o sąlygoje nurodomas vienetas ir apvalinimas.
- Pasirinkimo užduotis: teisingas tik vienas variantas; neteisingi variantai remiasi tipinėmis mokinių klaidomis, yra panašaus ilgio; be juokingų variantų ir be „visi išvardyti“.
- DI gali pasiūlyti kitas taisyklingas atsakymo rašybas (`accepted_answers`). Schema jas priima, bet vedėjo sąsaja jų dar neperduoda į užduotį (žr. 4 skyrių, 1 punktą).
- Smulki klaida kode: skaitinės užduoties atsakymas su kableliu („2,5“) tikrintuve buvo skaitomas kaip 2. Dabar skaitomas taip pat, kaip dalyvių atsakymai.

### 2.3. Mąstymo lygis, sunkumas, amžius

- Mąstymo lygiai paaiškinti veiksmais (prisiminti, paaiškinti, pritaikyti, palyginti). Viename rinkinyje ne daugiau kaip trečdalis užduočių gali būti prisiminimo lygio, bent viena turi būti taikymo arba analizės.
- Sunkumas susietas su žingsnių skaičiumi ir taškais (lengva: vienas žingsnis, 50-100; vidutinė: du žingsniai, 150-200; sunki: keli žingsniai, 250-400).
- Užduočių generavimas klasės ir dalyko negauna (maršrutų nekeitėme). Nurodyta juos nustatyti iš veiklos pavadinimo, aprašymo ir vedėjo teksto. Jei klasė nenurodyta, kuriama 5-8 klasių lygiui ir rašoma taip, kad suprastų vienuolikmetis. Prielaidos mokiniams skirtame tekste minėti negalima.
- Pamokų planuose klasė ir dalykas perduodami ir naudojami kaip anksčiau. Pataisyti ugdymo pakopų pavadinimai ir amžius (pvz., „pagrindinio ugdymo pirmoji dalis“, pirmokams 6-7 metai, ne 7).
- Scenarijus „Diskusijos pamoka“: nuomonės klausimai, kuriems tinka keli atsakymai, nebekuriami kaip vertinamos užduotys, nes sistema jų įvertinti negali. Scenarijus „Pabėgimo kambarys“: kiekviena užduotis turi būti išsprendžiama atskirai, nes komandos gali spręsti skirtinga tvarka.

### 2.4. Faktų tikslumas ir tikrintojas

- Kūrėjui: rinktis faktus, kuriais modelis tikras; vengti ginčytinų ar šaltiniuose skirtingai pateikiamų skaičių (plotai, ilgiai, gyventojų skaičiai) ir vietinių faktų, kurių negalima patikrinti; neišgalvoti citatų ir šaltinių. Jei toks skaičius būtinas, jis pateikiamas sąlygoje kaip duotas, o klausiama to, ką iš jo galima apskaičiuoti.
- Tikrintojui: užduotis pateikiama pirma, siūlomas atsakymas paskutinis. Tikrintojas pirmiausia pats išsprendžia užduotį ir įrašo savo atsakymą (laukas `own_answer`, kuris į rezultatą nepatenka), tik tada lygina. Jei fakto negali patvirtinti savo žiniomis, turi rašyti „uncertain“ (vedėjui rodoma „Reikia peržiūros“), ne „pass“. Papildomai tikrina, ar atsakymas vienintelis, ar nurodytas vienetas, ar užuominos ir pavadinimas neatskleidžia atsakymo, ar tekstas tinka mokiniams.
- Sąžininga pastaba: vienu kreipimusi modelis vis tiek mato visą žinutę, todėl tvarka ir laukas `own_answer` tik sumažina polinkį pritarti. Visiškai nepriklausomai patikrai reikėtų dviejų kreipinių (žr. 5 skyrių).

### 2.5. Pamokų planai

- **Tikslas**: vienas, pamatuojamas: ką mokinys gebės padaryti ir iš ko tai bus matyti. „Susipažins“, „žinos“ be požymio netinka.
- **Struktūra**: įvadas ir turimų žinių sužadinimas; nauja medžiaga; mokymasis kartu; savarankiškas arba grupinis darbas; formuojamasis vertinimas (trumpa užduotis, tiesiogiai tikrinanti tikslą); refleksija.
- **Laikas**: etapų minučių suma turi būti lygi pamokos trukmei, o ne „tilpti“. Į etapo laiką įskaičiuojamas skaitymas, pasitarimas ir aptarimas. Ilgesnėms nei 45 min. pamokoms numatoma daugiau etapų.
- **Diferencijavimas**: metodinė pastaba turi dalis „Pasiruošimas“, „Kaip pristatyti naują medžiagą“, „Diferencijavimas“ (pagalba tiems, kam sunkiau, ir gilesnis klausimas baigusiems anksčiau, taip pat mokiniams, turintiems specialiųjų ugdymosi poreikių), „Vertinimas“.
- **Kompetencijos**: septynios, kaip Bendrosiose programose: pažinimo, kūrybiškumo, komunikavimo, skaitmeninė, pilietiškumo, kultūrinė, socialinė, emocinė ir sveikos gyvensenos. Nurodoma tik tai, ką etapas iš tikrųjų ugdo; skaitmeninė nerašoma vien todėl, kad atsakymas įvedamas telefone.
- **Ryšys su programa**: žodžiais (dalykas, klasė, pasiekimų sritis ar tema), be išgalvotų skyrių numerių ir kodų.
- „Mokymosi stilių“ pastraipa pakeista universalaus dizaino mokymuisi principu: keli būdai pateikti turinį ir keli būdai mokiniui parodyti, ką išmoko.
- Pavyzdžiai perrašyti: užuominos laipteliais, variantai pagal tipines klaidas (pvz., „Žemė žiemą yra toliau nuo Saulės“), be išgalvotų citatų. Testas tikrina, kad pavyzdžių užuominos neatskleidžia atsakymo.
- Paaiškinta, kad taškais vertinamomis užduotimis tampa tik užduočių etapai; įvadą, aptarimą ir refleksiją veda vedėjas.

### 2.6. Nepatikimas tekstas ir mokinių duomenys

- Vedėjo laisvas tekstas ir veiklos aprašymas į nurodymus dedami tarp aiškių žymų (`<vedejo_tekstas>`, `<veiklos_aprasymas>`), o iš paties teksto tos žymos pašalinamos, kad bloko nebūtų galima „uždaryti“ iš vidaus. Visuose sisteminiuose nurodymuose parašyta, kad toks tekstas yra tik medžiaga ir jame esančių nurodymų vykdyti negalima.
- Dokumento importui parengta funkcija `buildImportUserMessage` (žymos `<dokumentas>`), tačiau importo maršrutas žinutę vis dar susideda pats (jis ne šios užduoties ribose). Kol jis nepakeistas, sisteminis nurodymas atpažįsta ir dabartinę antraštę „DOKUMENTO TURINYS“ (žr. 4 skyrių, 2 punktą).
- Mokinių duomenys į nurodymus nepatenka ir anksčiau nepateko: siunčiamas tik vedėjo rengiamas turinys. Tai palikta kaip buvo. Pridėtas reikalavimas užduotyse nenaudoti tikrų mokinių vardų.
- Šališkumas: taisyklė buvo ir anksčiau, dabar ji konkretesnė (lytis, tautybė, kalba, tikėjimas, negalia, šeimos sudėtis, gyvenamoji vieta, socialinė padėtis; vaidmenys nepriskiriami pagal lytį).

### 2.7. Kas jau buvo gerai ir palikta

- Atsakymą visada patvirtina vedėjas; DI tik siūlo.
- Nepavykusi ar neperskaitoma patikra laikoma „uncertain“, ne „pass“.
- Patikros pastabos, kuriose cituojamas atsakymas, slepiamos (`safeIssues`).
- Modeliai, žetonų ribos ir kainos nekeisti. API maršrutų parametrai nekeisti.

## 3. Lietuvių kalbos pataisos (šios užduoties ribose)

| Vieta | Buvo | Dabar | Kodėl |
| --- | --- | --- | --- |
| `components/landing/about-creators-section.tsx` | Įrankis sukurtas siekiant praktinių mokyklų poreikių, remiantis realiu mokytojų darbu klasėse. | Įrankis sukurtas atsižvelgiant į praktinius mokyklų poreikius ir remiantis tikru mokytojų darbu klasėse. | „Siekti poreikių“ neturi prasmės |
| `components/landing/access-section.tsx` | Prieš pradedant naudoti įrankį, mokytojai dalyvauja | Prieš pradėdami naudoti įrankį, mokytojai dalyvauja | Tas pats veikėjas, reikia pusdalyvio |
| `components/landing/hero-section.tsx` | Simbiozė - abipusiškai naudingas ... santykis. | Simbiozė yra abipusiškai naudingas ... santykis. | Brūkšnelis vietoj brūkšnio |
| `components/landing/hero-section.tsx` | ne plėšrūnas-auka, ne tos pačios rūšies, ne parazitas | ne plėšrūnas ir auka, ne tos pačios rūšies gyvūnai, ne parazitas ir šeimininkas | Aiškesnė sakinio sandara |
| `components/landing/hero-section.tsx` | 24 dalykų pasirinkimai | 24 dalykai | Vertinys iš anglų kalbos |
| `components/landing/what-you-can-do-section.tsx` | Komandų progresas | Komandų pažanga | Tas pats žodis kaip kitoje skiltyje |
| `components/landing/about-creators-section.tsx` | Pepper robotas | Robotas „Pepper“ | Pavadinimas kabutėse |
| `lib/email/templates.ts` | Daugiausiai šį mėnesį | Daugiausia šį mėnesį | Norminė forma |
| `lib/ai/lesson-types.ts` | Socialinė-emocinė ir sveikos gyvensenos | Socialinė, emocinė ir sveikos gyvensenos | Bendrųjų programų pavadinimas |
| `lib/ai/deterministic-validator.ts` | Tipas "number", bet atsakymas "..." nėra skaičius | Skaičiaus užduoties atsakymas „...“ nėra skaičius | Žargonas, tiesios kabutės |
| `lib/ai/deterministic-validator.ts` | Teisingas atsakymas "..." nėra tarp pateiktų variantų | Teisingo atsakymo „...“ nėra tarp pateiktų variantų | Neiginio kilmininkas, kabutės |
| `lib/ai/deterministic-validator.ts` | Taškai (...) ne 50-500 intervale | Taškai (...) turi būti nuo 50 iki 500 | Aiškiau |

Iš viso 12 pataisų. Be to, DI nurodymuose (jų naudotojas nemato, bet modelis mėgdžioja jų stilių) pašalinti ilgieji brūkšniai, tiesios kabutės pakeistos lietuviškomis, suvienodintas kreipinys.

Peržiūrėta ir nekeista, nes klaidų nerasta: `app/laukia/page.tsx`, `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, `lib/validation/zod-lt.ts`, `supabase/templates/invite.html`, `supabase/templates/magic-link.html`, kiti laiškai `lib/email/templates.ts` (`accountActivatedEmail` neliestas, jį perrašo kitas inžinierius).

**Privatumo pranešimas (`app/privatumas/page.tsx`) nekeistas.** Aiškių kalbos klaidų nerasta. Stiliaus pasiūlymai, kuriuos gali priimti tik teksto tvirtintojai:

- „aukščiau nurodytiems tikslams“ teisės tekstuose įprasčiau „pirmiau nurodytiems tikslams“;
- „Platforma veikia naudodama šių paslaugų teikėjų paslaugas“ sklandžiau „Platformai veikti pasitelkiame šiuos paslaugų teikėjus“.

## 4. Pastebėta už šios užduoties ribų (kitiems taisyti)

1. `components/teacher/game-builder/game-builder.tsx:300-312`: priimant DI pasiūlymą į `/api/challenges` neperduodamas `accepted_answers`. Siūloma pridėti `accepted_answers: suggestion.type === "text" ? suggestion.accepted_answers ?? [] : []` ir kortelėje (`components/teacher/ai-suggestion-card.tsx:160`) rodyti eilutę „Taip pat tinka: ...“, kad vedėjas juos patvirtintų.
2. `app/api/import/process/route.ts:107-118`: dokumento tekstas į žinutę dedamas tarp `---` eilučių, kurias pats dokumentas gali pakartoti. Siūloma kviesti `buildImportUserMessage({ game_title, game_description, document_text: truncatedText, count })` iš `lib/ai/prompt.ts`.
3. `app/api/lesson-plans/generate/route.ts`: sugeneruoto plano etapų užuominos netikrinamos ir minučių suma nelyginama su pamokos trukme. Siūloma po generavimo kviesti `dropLeakingHints` kiekvienam etapui ir, jei minučių suma nesutampa su `duration`, parodyti vedėjui pastabą „Etapų trukmė (X min.) nesutampa su pamokos trukme (Y min.).“
4. `app/api/lesson-plans/generate/route.ts:133-134`: komentaras, kad planą „peržiūrės ministerija“, neatitinka tikrovės; siūloma pašalinti.
5. `components/teacher/ai-suggestion-card.tsx:32`: žyma „DI patikrino“ skamba kaip garantija. Siūloma „DI klaidų nerado“ ir paaiškinimas užvedus pelę: „Tai ne garantija. Atsakymą patvirtinate jūs.“ Ta pati frazė `components/teacher/lesson-plan-convert-dialog.tsx:96`: siūloma „DI klaidų atsakymuose nerado. Vis tiek juos peržiūrėkite.“
6. `components/teacher/ai-suggestion-card.tsx:40`: žyma „Klaida“ nepasako, kieno. Siūloma „DI rado klaidą“.
7. `components/teacher/lesson-plan-detail.tsx:436`: „Bloom: Taikymas“. Siūloma „Mąstymo lygis: taikymas“.
8. `components/teacher/lesson-activity-card.tsx:196`: prie pavadinimo pridedamas žodis „kompetencija“; su nauju pavadinimu išeina ilga žyma „Socialinė, emocinė ir sveikos gyvensenos kompetencija“. Siūloma šiai kompetencijai žymoje rodyti „Socialinė, emocinė, sveikos gyvensenos“ arba leisti tekstui lūžti.
9. `lib/curriculum/subjects.ts:13-14`: „Pasaulio pažinimas“ (1-4 kl.) ir „Gamta ir žmogus“ (5-6 kl.) yra ankstesnių programų dalykai. Atnaujintose programose: „Gamtos mokslai“ (1-8 kl.) ir „Visuomeninis ugdymas“ (1-4 kl.). Eilutė 29: „Tikyba“ ir „Etika“ programose yra „Dorinis ugdymas (tikyba)“ ir „Dorinis ugdymas (etika)“. Reikia dalyko eksperto sprendimo, nes keičiasi ir temų sąrašas `lib/curriculum/topics.ts`.
10. `components/teacher/live-view.tsx:393` ir `components/player/qr-scanner.tsx:73,105`: „nuskenuokite“, „skenuoti QR kodą“. Taisyklingiau „nuskaitykite“, „Nuskaityti QR kodą“.
11. `components/teacher/lesson-generator.tsx:411`, `components/teacher/lesson-plan-generator.tsx:704`: pavyzdys „Pvz.: Mokiniai gebės apskaičiuoti trikampio plotą...“. Siūloma pamatuojamas pavyzdys ir daugtaškio ženklas: „Pvz., mokiniai apskaičiuos trikampio plotą, kai žinomas pagrindas ir aukštinė…“
12. `components/teacher/game-form.tsx:24`, `components/teacher/game-edit-dialog.tsx:28`: „Įveskite komandų skaičių (2–100)“. Siūloma „Įveskite komandų skaičių nuo 2 iki 100“.
13. `components/teacher/lesson-plan-generator.tsx:191`: „spauskite „Generuoti“.“ Siūloma patikrinti, ar mygtukas tikrai taip vadinasi; platformos terminas būtų „Kurti planą“.
14. `app/api/di/verify/route.ts:17-25`: schema nepriima `explanation`, todėl tikrinant pakartotinai paaiškinimas netikrinamas. Siūloma pridėti `explanation: z.string().optional()`.
15. `lib/ai/retry.ts:70`: klaidos tekstas „AI atsakymas neatitinka schemos“ (naudotojui jis nerodomas, bet terminas turėtų būti „DI“).
16. Visoje sąsajoje „prisijungti su kodu“, „su Google“. Priemonei reikšti taisyklingiau „įvedus kodą“, „per Google“. Tai plačiai vartojama, todėl nekeista; spręsti kartu su dizaino sistemos terminų sąrašu.

## 5. Kas lieka žmogaus (dalyko eksperto) sprendimui

- **Ar nurodymai veikia.** Reikia tikro bandymo: po 10-15 užduočių bent trims klasių grupėms (3-4, 6-7, 9-10) ir keturiems dalykams, vertinant: ar užuominos neatskleidžia atsakymo, ar atsakymas vienintelis, ar tekstas tinka amžiui, ar faktai teisingi. Atskirai patikrinti, ar tikrintojas dabar dažniau rašo „Reikia peržiūros“ ir ar tai vedėjams ne per dažnai.
- **Numatytasis lygis, kai klasė nenurodyta** (dabar 5-8 klasės). Geresnis sprendimas būtų klasę ir dalyką perduoti iš veiklos nustatymų; tam reikia keisti formą ir maršrutą.
- **Faktų teisingumas.** Nei kūrėjas, nei tikrintojas neturi šaltinių. Vietos ir regiono faktus (Klaipėda, Kuršių marios, Baltijos jūra) turi tikrinti vedėjas. Verta apsvarstyti patikrintų regiono faktų sąrašą, kurį DI gautų kaip medžiagą.
- **Dviejų žingsnių patikra.** Kad tikrintojas tikrai nematytų siūlomo atsakymo, reikia dviejų kreipinių (pirma išspręsti, tada palyginti). Tai padidina DI išlaidas, todėl sprendžia Vytis.
- **Kompetencijų ir pasiekimų sričių formuluotės.** Kompetencijų pavadinimai sutikrinti su Bendrosiomis programomis, bet trumpi jų aprašai nurodymuose yra mūsų santrauka. Ryšys su konkrečia dalyko programa (`curriculum_link`) generuojamas modelio ir nėra tikrinamas pagal programos tekstą.
- **Mąstymo lygių terminai.** Naudojama senoji Bloomo taksonomijos versija (žinios, supratimas, taikymas, analizė, sintezė, vertinimas). Ar pereiti prie atnaujintos (prisiminti, suprasti, taikyti, analizuoti, vertinti, kurti), sprendžia metodininkai; tai keistų saugomus duomenis.
- **Žodžio formų atpažinimas užuominose** yra apytikslis (nukerpama galūnė). Jis gali ir praleisti netaisyklingą formą (vanduo, vandens), ir retkarčiais suklysti. Todėl tokiu atveju pastaba sako „tikriausiai atskleidžia“.
- **Dalykų sąrašas** pagal atnaujintas programas (4 skyrius, 9 punktas).
- **Privatumo pranešimo stiliaus pasiūlymai** (3 skyrius).
