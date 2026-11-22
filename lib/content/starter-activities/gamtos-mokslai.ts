import type { StarterActivityInput } from "./schema"

// Natural science starter activities. Every numeric answer follows from data
// given in the task text; atomic masses and the speed of sound are stated in
// the task itself.
export const GAMTOS_MOKSLAI: StarterActivityInput[] = [
  {
    slug: "vandens-apytakos-ratas",
    title: "Vandens lašo kelionė: apytakos ratas",
    description:
      "Komandos seka vandens lašo kelią nuo balos kieme iki Baltijos jūros ir atgal: aiškinasi garavimą, kondensaciją, debesų sandarą ir paaiškina paprasto stebėjimo rezultatus.",
    subject: "Gamtos mokslai",
    grade_band: "5-6 kl.",
    duration_minutes: 25,
    curriculum:
      "Gamtos mokslų bendroji programa (2022), 5-6 klasės. Medžiagų būsenos ir jų kitimai, vanduo gamtoje: vandens apytakos ratas, garavimas, kondensacija, krituliai.",
    learning_goals: [
      "Pavadinti ir savais žodžiais paaiškinti garavimą ir kondensaciją.",
      "Apibūdinti vandens kelią apytakos rate, remiantis Lietuvos upių pavyzdžiu.",
      "Paaiškinti paprasto stebėjimo rezultatus, taikant žinias apie vandens būsenų kitimus.",
    ],
    teacher_notes: {
      before:
        "Suskirstykite mokinius į komandas po 3 ar 4. Komandai reikia vieno telefono ar planšetės ir lapo užrašams. Pravers Lietuvos žemėlapis (sieninis arba vadovėlyje): jo prireiks užduočiai apie lašo kelionę iš Vilniaus. Priminkite tris vandens būsenas ir susitarkite, kad atsakymą komanda siunčia tik tada, kai jam pritaria visi nariai.",
      during:
        "Stebėkite, ar komandos nespėlioja: paprašykite, kad vienas narys kitiems garsiai paaiškintų, kodėl pasirinko atsakymą. Skaičiavimo užduotyje dažna klaida: atimamas tik antros dienos kiekis. Priminkite, kad užuomina kainuoja taškų, todėl pirmiausia verta pasitarti komandoje.",
      after:
        "Aptarkite tris dažnas klaidas. Pirma: debesis nėra vandens garai. Garai nematomi, o debesį matome, nes jį sudaro lašeliai ir ledo kristalėliai. Antra: vanduo garuoja ne tik verdamas, bet ir esant bet kokiai temperatūrai. Trečia: vanduo gamtoje nedingsta, tik keičia būseną ir vietą. Paprašykite komandų lentoje nupiešti apytakos ratą ir rodyklėmis pažymėti garavimą, kondensaciją, kritulius ir nuotėkį upėmis.",
    },
    reflection_questions: [
      "Kuri užduotis sukėlė daugiausia ginčų komandoje ir kaip susitarėte dėl atsakymo?",
      "Ką apie debesis ar garavimą manėte anksčiau ir kas pasikeitė po šios veiklos?",
      "Kur šiandien savo aplinkoje galėtumėte pastebėti garavimą arba kondensaciją?",
    ],
    sources: [
      "5 klasės gamtos mokslų vadovėlio temos apie vandens būsenas ir vandens apytakos ratą.",
      "Visuotinė lietuvių enciklopedija (vle.lt): straipsniai apie vandens apytaką, debesis, Nerį, Nemuną ir Kuršių marias.",
      "Lietuvos hidrometeorologijos tarnybos švietėjiška informacija apie debesis ir kritulius.",
    ],
    challenges: [
      {
        title: "Kur dingo bala?",
        description:
          "Po lietaus ant asfalto liko bala. Saulėtą dieną ji pamažu išnyko. Kaip vadinamas reiškinys, kai skystas vanduo virsta vandens garais?",
        type: "multiple_choice",
        points: 100,
        correct_answer: "Garavimas",
        hints: [
          "Pagalvokite, kokios būsenos tampa vanduo, kai jo nebematote.",
          "Tas pats reiškinys vyksta, kai lauke džiūsta skalbiniai.",
        ],
        options: ["Garavimas", "Kondensacija", "Lydymasis", "Kietėjimas"],
        explanation:
          "Garavimas yra skysčio virtimas dujomis, šiuo atveju vandens garais. Vandens garai nematomi, todėl atrodo, kad bala tiesiog dingo. Vanduo garuoja ne tik verdamas: jis garuoja esant bet kokiai temperatūrai, tik šiltą ir vėjuotą dieną greičiau.",
        difficulty: "easy",
        cognitive_level: "remember",
      },
      {
        title: "Rasa ant žolės",
        description:
          "Vasaros rytą žolė šlapia nuo rasos, nors naktį nelijo. Naktį oras atvėso, ir ore buvę vandens garai virto lašeliais. Kaip vadinamas reiškinys, kai vandens garai virsta skystu vandeniu? Įrašykite vieną žodį.",
        type: "text",
        points: 100,
        correct_answer: "kondensacija",
        accepted_answers: ["kondensavimasis", "kondensavimas", "kondensuojasi"],
        hints: [
          "Šis reiškinys yra priešingas garavimui.",
          "Tas pats vyksta, kai po dušo aprasoja šaltas veidrodis.",
          "Tai tarptautinis žodis, prasidedantis raide k.",
        ],
        options: null,
        explanation:
          "Kondensacija yra vandens garų virtimas skystu vandeniu. Ji vyksta, kai garai atvėsta: naktį prie šaltos žolės, ant šalto lango ar veidrodžio. Rasa nenukrinta iš dangaus kaip lietus: ji susidaro tiesiog ant žolės iš ore esančių garų.",
        difficulty: "easy",
        cognitive_level: "understand",
      },
      {
        title: "Lašo kelionė iš Vilniaus",
        description:
          "Lietaus lašas nukrito Vilniuje į Nerį. Kuriuo keliu jis nukeliaus iki jūros? Pasirinkite teisingą vandens telkinių eilę. Galite naudotis Lietuvos žemėlapiu.",
        type: "multiple_choice",
        points: 150,
        correct_answer: "Neris, Nemunas, Kuršių marios, Baltijos jūra",
        hints: [
          "Prisiminkite, prie kurio miesto susitinka dvi didžiausios Lietuvos upės ir kuri iš jų teka toliau.",
          "Tarp upės žiočių ir atviros jūros yra seklus vandens telkinys. Nuo jūros jį skiria Kuršių nerija.",
        ],
        options: [
          "Neris, Nemunas, Kuršių marios, Baltijos jūra",
          "Neris, Kuršių marios, Nemunas, Baltijos jūra",
          "Neris, Nemunas, Baltijos jūra, Kuršių marios",
          "Neris, Baltijos jūra, Nemunas, Kuršių marios",
        ],
        explanation:
          "Neris ties Kaunu įteka į Nemuną. Nemunas įteka į Kuršių marias, o iš jų vanduo per Klaipėdos sąsiaurį patenka į Baltijos jūrą. Taip upės grąžina kritulių vandenį į jūrą, iš kurios jis vėl garuoja.",
        difficulty: "medium",
        cognitive_level: "understand",
      },
      {
        title: "Iš ko sudarytas debesis?",
        description:
          "Vandens garai su šiltu oru kyla aukštyn. Aukštai oras šaltesnis, ir ten susidaro debesys. Iš ko sudarytas debesis, kurį matote danguje?",
        type: "multiple_choice",
        points: 150,
        correct_answer: "Iš smulkių vandens lašelių ir ledo kristalėlių",
        hints: [
          "Vandens garai yra nematomi. O debesį jūs matote.",
          "Prisiminkite, kas nutinka vandens garams, kai jie atvėsta.",
        ],
        options: [
          "Iš vandens garų, tai yra dujų",
          "Iš smulkių vandens lašelių ir ledo kristalėlių",
          "Iš dūmų ir dulkių",
          "Iš sutirštėjusio oro",
        ],
        explanation:
          "Aukštai atvėsę vandens garai kondensuojasi į labai smulkius lašelius, o kai labai šalta, susidaro ledo kristalėliai. Jie tokie lengvi, kad laikosi ore, ir būtent juos matome kaip debesį. Patys vandens garai yra nematomos dujos, todėl debesis nėra garai.",
        difficulty: "medium",
        cognitive_level: "understand",
      },
      {
        title: "Lėkštė ant palangės",
        description:
          "Mokiniai į plačią lėkštę įpylė 200 ml vandens ir pastatė ją ant palangės. Per pirmą dieną išgaravo 30 ml vandens. Antrą dieną buvo šilčiau ir langas buvo atidarytas, todėl išgaravo dvigubai daugiau vandens nei pirmą dieną. Kiek mililitrų vandens liko lėkštėje po dviejų dienų? Įrašykite tik skaičių.",
        type: "number",
        points: 200,
        correct_answer: "110",
        hints: [
          "Pirmiausia raskite, kiek vandens išgaravo antrą dieną.",
          "Sudėkite abiejų dienų išgaravusio vandens kiekius.",
          "Iš pradinio vandens kiekio atimkite viską, kas išgaravo per dvi dienas.",
        ],
        options: null,
        explanation:
          "Antrą dieną išgaravo 2 · 30 = 60 ml. Per dvi dienas išgaravo 30 + 60 = 90 ml, todėl liko 200 − 90 = 110 ml. Antrą dieną vanduo garavo greičiau, nes buvo šilčiau, o pro atvirą langą judantis oras nunešdavo garus.",
        difficulty: "medium",
        cognitive_level: "apply",
      },
      {
        title: "Du stiklainiai",
        description:
          "Mokiniai į du vienodus stiklainius įpylė po tiek pat vandens. Vieną sandariai uždengė dangteliu, kitą paliko atvirą. Abu pastatė ant saulėtos palangės. Po savaitės atvirame stiklainyje vandens sumažėjo. Uždengtame vandens kiekis beveik nepakito, bet sienelės ir dangtelis iš vidaus aprasojo. Kuri išvada geriausiai paaiškina abu stebėjimus?",
        type: "multiple_choice",
        points: 250,
        correct_answer:
          "Vanduo garavo abiejuose stiklainiuose, bet uždengtame garai virto lašeliais ir grįžo atgal",
        hints: [
          "Aptarkite, iš kur atsirado lašeliai ant uždengto stiklainio dangtelio.",
          "Pagalvokite, kur keliauja vandens garai, kai stiklainis atviras, ir kur jie gali keliauti, kai jis uždengtas.",
        ],
        options: [
          "Uždengtame stiklainyje vanduo visai negaravo, todėl jo kiekis nepakito",
          "Atvirame stiklainyje vanduo susigėrė į stiklo sieneles",
          "Vanduo garavo abiejuose stiklainiuose, bet uždengtame garai virto lašeliais ir grįžo atgal",
          "Lašeliai uždengtame stiklainyje atsirado iš kambario oro, kuris prasiskverbė pro dangtelį",
        ],
        explanation:
          "Saulės šildomas vanduo garavo abiejuose stiklainiuose. Iš atviro stiklainio garai pasklido po kambarį, todėl vandens sumažėjo. Uždengtame garai neturėjo kur išeiti: ant vėsesnių sienelių ir dangtelio jie kondensavosi, o lašeliai nutekėjo atgal. Tai mažas vandens apytakos rato modelis.",
        difficulty: "hard",
        cognitive_level: "analyse",
      },
    ],
  },
  {
    slug: "mitybos-grandines-ir-tinklai",
    title: "Kas ką ėda: mitybos grandinės ir tinklai",
    description:
      "Komandos nagrinėja Lietuvos miško, pievos ir Baltijos jūros mitybos ryšius: atpažįsta gamintojus ir vartotojus, pagal duotą taisyklę skaičiuoja energijos perdavimą ir numato, kas nutinka pasikeitus vienai grandžiai.",
    subject: "Biologija",
    grade_band: "7-8 kl.",
    duration_minutes: 30,
    curriculum:
      "Biologijos bendroji programa (2022). Organizmų ir aplinkos ryšiai: ekosistemos, gamintojai, vartotojai ir skaidytojai, mitybos grandinės ir tinklai. Energijos perdavimas skaičiuojamas pagal sąlygoje duotą taisyklę.",
    learning_goals: [
      "Atpažinti gamintojus ir skirtingų eilių vartotojus mitybos grandinėje ir tinkle.",
      "Apskaičiuoti, kiek energijos pasiekia tolesnį mitybos lygmenį, kai žinoma perduodama dalis.",
      "Numatyti, kaip vienos rūšies gausos pokytis paveiks kitas mitybos grandinės rūšis.",
    ],
    teacher_notes: {
      before:
        "Suskirstykite mokinius į komandas po 3 ar 4. Komandai reikia vieno telefono ir lapo grandinėms ir tinklui braižyti. Priminkite sąvokas: gamintojas, vartotojas, skaidytojas. Užduotyse rašoma „pirminis, antrinis, tretinis vartotojas“: jei jūsų vadovėlyje vartojama „pirmos, antros, trečios eilės vartotojas“, pasakykite, kad tai tas pats. 10 % energijos taisyklės mokėti nereikia: ji duota sąlygoje kaip supaprastintas modelis.",
      during:
        "Stebėkite, kaip komandos braižo rodykles: dažnai jos nukreipiamos nuo plėšrūno į grobį. Energijos užduotyje žiūrėkite, ar mokiniai dalija iš 10 tiek kartų, kiek yra perėjimų, o ne lygmenų. Jei komanda ginčijasi dėl Baltijos jūros užduoties, paprašykite, kad kiekvieną grandį aptartų atskirai.",
      after:
        "Aptarkite dažnas klaidas. Rodyklė rodo, kur pereina medžiagos ir energija, todėl ji eina nuo suėdamo organizmo prie ėdančio. Grybai nėra augalai ir nėra gamintojai. Energija grandinėje nedingsta be pėdsakų: didžiąją jos dalį organizmai sunaudoja gyvybinei veiklai ir išskiria kaip šilumą. Paklauskite, kodėl grandinėse retai būna daugiau nei keturi ar penki lygmenys. Pabrėžkite, kad gamtoje ryšiai sudaro tinklą, todėl tikri pokyčiai sudėtingesni nei grandinėje.",
    },
    reflection_questions: [
      "Kaip komandoje pasidalijote darbą braižydami pievos mitybos tinklą ir ar tai padėjo?",
      "Kuris atsakymas jus nustebino ir ką jis pakeitė jūsų supratime apie mitybos ryšius?",
      "Kokią mitybos grandinę galėtumėte sudaryti iš organizmų, gyvenančių prie jūsų mokyklos?",
      "Kodėl žmogaus veiklos poveikį vienai rūšiai sunku numatyti iš anksto?",
    ],
    sources: [
      "Pagrindinio ugdymo biologijos vadovėlių temos apie ekosistemas, mitybos grandines, mitybos tinklus ir ekologines piramides.",
      "Visuotinė lietuvių enciklopedija (vle.lt): straipsniai apie mitybos grandinę, ekologinę piramidę, baltąjį gandrą, strimelę ir menkę.",
      "Baltijos jūros grandinė ir energijos kiekiai yra supaprastinti sąlygos duomenys, o ne išmatuoti dydžiai.",
    ],
    challenges: [
      {
        title: "Kas pradeda grandinę?",
        description:
          "Kiekviena mitybos grandinė prasideda gamintoju: organizmu, kuris pats pasigamina organinių medžiagų. Kuris iš šių Lietuvos miško organizmų yra gamintojas?",
        type: "multiple_choice",
        points: 100,
        correct_answer: "Paprastoji pušis",
        hints: [
          "Gamintojai organines medžiagas gamina naudodami šviesos energiją.",
          "Pagalvokite, kurie iš šių organizmų turi chlorofilo.",
        ],
        options: ["Baravykas", "Paprastoji pušis", "Rudoji lapė", "Sliekas"],
        explanation:
          "Pušis yra augalas: jos spygliuose vyksta fotosintezė, todėl ji pati pasigamina organinių medžiagų. Baravykas yra grybas, o ne augalas. Jis neturi chlorofilo ir minta jau pagamintomis organinėmis medžiagomis. Lapė ir sliekas taip pat minta kitų organizmų sukurtomis medžiagomis.",
        difficulty: "easy",
        cognitive_level: "remember",
      },
      {
        title: "Kas yra kas grandinėje?",
        description:
          "Miško mitybos grandinė: ąžuolo lapai → vikšras → zylė → paukštvanagis. Pirminis (pirmos eilės) vartotojas minta gamintojais, antrinis (antros eilės) vartotojas minta pirminiais vartotojais. Kuris šios grandinės organizmas yra antrinis vartotojas? Įrašykite vieną žodį.",
        type: "text",
        points: 100,
        correct_answer: "zylė",
        accepted_answers: ["zylės", "didžioji zylė"],
        hints: [
          "Pradėkite nuo gamintojo ir eikite rodyklių kryptimi.",
          "Pirmiausia nustatykite, kuris organizmas yra pirminis vartotojas. Antrinio ieškokite iš karto po jo.",
        ],
        options: null,
        explanation:
          "Ąžuolas yra gamintojas. Vikšras ėda lapus, todėl jis pirminis vartotojas. Zylė ėda vikšrus, todėl ji antrinis vartotojas, o paukštvanagis, gaudantis zyles, yra tretinis vartotojas. Vartotojo eilė priklauso ne nuo gyvūno dydžio, o nuo to, kuo jis minta.",
        difficulty: "easy",
        cognitive_level: "understand",
      },
      {
        title: "Ką rodo rodyklė?",
        description:
          "Mitybos grandinėje organizmai jungiami rodyklėmis, pavyzdžiui: vikšras → zylė. Ką rodo ši rodyklė?",
        type: "multiple_choice",
        points: 150,
        correct_answer: "Kad medžiagos ir energija iš vikšro pereina zylei",
        hints: [
          "Rodyklė nerodo, kas ką vejasi.",
          "Pagalvokite, kas juda iš vieno organizmo į kitą, kai vienas suėda kitą.",
        ],
        options: [
          "Kad vikšras medžioja zylę",
          "Kad medžiagos ir energija iš vikšro pereina zylei",
          "Kad vikšras užauga ir virsta zyle",
          "Kad vikšrų miške yra daugiau nei zylių",
        ],
        explanation:
          "Rodyklė mitybos grandinėje rodo medžiagų ir energijos kryptį: nuo organizmo, kuris suėdamas, prie to, kuris ėda. Todėl ji nukreipta nuo vikšro į zylę. Dažna klaida yra rodyklę brėžti nuo plėšrūno į grobį, lyg ji rodytų medžioklę.",
        difficulty: "medium",
        cognitive_level: "understand",
      },
      {
        title: "Kiek energijos pasiekia viršūnę?",
        description:
          "Tarkime, kad iš vieno mitybos lygmens į kitą pereina lygiai 10 % energijos (tai supaprastintas modelis). Grandinė: ąžuolo lapai → vikšras → zylė → paukštvanagis. Ąžuolo lapuose sukaupta 20 000 kJ energijos. Kiek kilodžaulių šios energijos pasieks paukštvanagį? Įrašykite sveikąjį skaičių.",
        type: "number",
        points: 200,
        correct_answer: "20",
        hints: [
          "Suskaičiuokite, kiek rodyklių yra tarp lapų ir paukštvanagio.",
          "Rasti 10 % reiškia padalyti iš dešimties.",
          "Dalykite tiek kartų, kiek yra perėjimų tarp lygmenų.",
        ],
        options: null,
        explanation:
          "Vikšrams atitenka 10 % lapų energijos, tai yra 2000 kJ. Zylėms atitenka 200 kJ, o paukštvanagiui 20 kJ. Likusi energija nedingsta: organizmai ją sunaudoja gyvybinei veiklai ir išskiria kaip šilumą. Todėl plėšrūnų grandinės viršūnėje paprastai būna nedaug.",
        difficulty: "medium",
        cognitive_level: "apply",
      },
      {
        title: "Baltijos jūra be menkių",
        description:
          "Supaprastinta Baltijos jūros mitybos grandinė: fitoplanktonas → zooplanktonas → strimelė → menkė → pilkasis ruonis. Tarkime, kad dėl per didelės žvejybos menkių labai sumažėjo. Kas, remiantis šia grandine, labiausiai tikėtina artimiausiais metais?",
        type: "multiple_choice",
        points: 200,
        correct_answer: "Strimelių padaugės, o zooplanktono sumažės",
        hints: [
          "Pirmiausia aptarkite, kas nutinka grobiui, kai sumažėja jo plėšrūnų.",
          "Tada pagalvokite, kaip tas pokytis paveiks organizmus, kuriais minta grobis.",
        ],
        options: [
          "Strimelių sumažės, o zooplanktono padaugės",
          "Strimelių ir zooplanktono padaugės",
          "Strimelių padaugės, o zooplanktono sumažės",
          "Pasikeis tik ruonių skaičius, kitų organizmų gausa liks tokia pati",
        ],
        explanation:
          "Menkės ėda strimeles. Kai menkių mažiau, daugiau strimelių išgyvena ir jų padaugėja. Gausesnės strimelės suėda daugiau zooplanktono, todėl jo sumažėja. Pokytis vienoje grandyje persiduoda per visą grandinę. Tikroje jūroje ryšiai sudaro tinklą, todėl pokyčiai būna sudėtingesni.",
        difficulty: "hard",
        cognitive_level: "analyse",
      },
      {
        title: "Pievos mitybos tinklas",
        description:
          "Nusibraižykite pievos mitybos tinklą pagal šiuos teiginius. Žiogas minta žole. Pelėnas minta žolių sėklomis ir šaknimis. Varlė minta žiogais. Baltasis gandras minta žiogais, varlėmis ir pelėnais. Lapė minta pelėnais. Antrinis (antros eilės) vartotojas minta augalėdžiais, tretinis (trečios eilės) vartotojas minta antriniais vartotojais. Kuris gyvūnas šiame tinkle yra ir antrinis, ir tretinis vartotojas? Įrašykite vieną žodį.",
        type: "text",
        points: 250,
        correct_answer: "gandras",
        accepted_answers: ["baltasis gandras", "gandrai"],
        hints: [
          "Pirmiausia suraskite visus augalėdžius ir pažymėkite juos kaip pirminius vartotojus.",
          "Ieškokite gyvūno, kurio grobis priklauso skirtingiems mitybos lygmenims.",
          "Tretinis vartotojas turi misti bent vienu antriniu vartotoju. Kurie šio tinklo gyvūnai yra antriniai vartotojai?",
        ],
        options: null,
        explanation:
          "Žiogas ir pelėnas minta augalais, todėl jie pirminiai vartotojai. Varlė ėda žiogus, todėl ji antrinis vartotojas. Gandras, ėsdamas žiogus ir pelėnus, yra antrinis vartotojas, o ėsdamas varles, tretinis. Lapė šiame tinkle minta tik pelėnais, todėl ji tik antrinis vartotojas. Tas pats gyvūnas tinkle gali užimti kelis mitybos lygmenis.",
        difficulty: "hard",
        cognitive_level: "analyse",
      },
    ],
  },
  {
    slug: "greitis-kelias-laikas",
    title: "Greitis, kelias ir laikas: nuo dviračio iki žaibo",
    description:
      "Komandos skaičiuoja greitį, kelią ir laiką kasdienėse situacijose, keičia matavimo vienetus, skaito judėjimo grafiką ir išsiaiškina, kodėl vidutinis greitis nėra greičių vidurkis. 9-10 klasėse tinka kartojimui.",
    subject: "Fizika",
    grade_band: "9-10 kl.",
    duration_minutes: 30,
    curriculum:
      "Fizikos bendroji programa (2022). Judėjimas ir jėgos: tolyginis tiesiaeigis judėjimas, greitis, vidutinis greitis, kelio priklausomybės nuo laiko grafikai. Veikla skirta šioms sąvokoms pakartoti ir įtvirtinti.",
    learning_goals: [
      "Apskaičiuoti greitį, kelią arba laiką, kai žinomi kiti du dydžiai, ir pakeisti km/h į m/s.",
      "Iš kelio priklausomybės nuo laiko grafiko aprašymo nustatyti, kada kūnas judėjo greičiausiai ir kada stovėjo.",
      "Apskaičiuoti vidutinį greitį, kai kelio dalys įveikiamos skirtingu greičiu.",
    ],
    teacher_notes: {
      before:
        "Suskirstykite mokinius į komandas po 2 ar 3. Komandai reikia vieno telefono, lapo ir rašiklio. Skaičiuotuvas nebūtinas: visi skaičiai parinkti taip, kad pakaktų skaičiuoti mintinai ar stulpeliu. Mokiniai jau turi būti skaičiavę greitį, kelią ir laiką ir matę kelio grafiką; pagreičio čia nereikia. Formulės iš anksto nepriminkite: ją tikrina pirmoji užduotis. Susitarkite, kad sprendimą komanda užsirašo ant lapo: jo prireiks aptarimui.",
      during:
        "Stebėkite, ar mokiniai prieš skaičiuodami suvienodina vienetus: 1 h 30 min dažnai užrašoma kaip 1,3 h. Grafiko užduotyje pasiūlykite grafiką nusibraižyti ant lapo. Paskutinėje užduotyje daugelis komandų pirmiausia siūlys 45 km/h: neskubėkite taisyti, paklauskite, kiek laiko truko kiekviena kelio dalis.",
      after:
        "Aptarkite tris dalykus. Vidutinis greitis yra visas kelias, padalytas iš viso laiko, o ne greičių aritmetinis vidurkis: lėtai važiuojama ilgiau, todėl lėtoji dalis sveria daugiau. Horizontali kelio grafiko dalis reiškia, kad kūnas stovi, o ne juda pastoviu greičiu. Keičiant km/h į m/s dalijama iš 3,6: paprašykite komandos paaiškinti, iš kur šis skaičius. Paklauskite, kokias prielaidas darėme žaibo užduotyje.",
    },
    reflection_questions: [
      "Kurioje užduotyje pirmas komandos atsakymas buvo klaidingas ir kas padėjo pastebėti klaidą?",
      "Kaip savais žodžiais paaiškintumėte draugui, kodėl vidutinis greitis nėra greičių vidurkis?",
      "Kaip pasidalijote vaidmenis komandoje: kas skaičiavo, kas tikrino, kas abejojo?",
      "Kur kasdienybėje jums praverstų mokėjimas greitai įvertinti greitį, kelią ar laiką?",
    ],
    sources: [
      "Pagrindinio ugdymo fizikos vadovėlių temos apie mechaninį judėjimą: tolyginis tiesiaeigis judėjimas, vidutinis greitis, judėjimo grafikai.",
      "Garso greitis ore (apie 340 m/s, kai oro temperatūra apie 15 °C): fizikos vadovėlio tema apie garso bangas arba Visuotinė lietuvių enciklopedija (vle.lt), straipsnis apie garsą.",
      "Atstumai ir trukmės uždaviniuose yra sąlygos duomenys, o ne išmatuoti tikrų maršrutų dydžiai.",
    ],
    challenges: [
      {
        title: "Greičio formulė",
        description:
          "Kūnas juda tolygiai. Jo greitis v, nueitas kelias s, judėjimo laikas t. Kuri formulė teisingai sieja šiuos tris dydžius?",
        type: "multiple_choice",
        points: 100,
        correct_answer: "v = s : t",
        hints: [
          "Greitis rodo, kokį kelią kūnas nueina per laiko vienetą.",
          "Pažiūrėkite į greičio vienetą m/s: jis parodo, kurį dydį iš kurio reikia dalyti.",
        ],
        options: ["v = s · t", "v = t : s", "v = s : t", "v = s + t"],
        explanation:
          "Greitis rodo, kokį kelią kūnas nueina per laiko vienetą, todėl kelią dalijame iš laiko: v = s : t. Tai matyti ir iš vieneto: metrai, padalyti iš sekundžių, yra m/s. Iš tos pačios formulės gauname s = v · t ir t = s : v.",
        difficulty: "easy",
        cognitive_level: "remember",
      },
      {
        title: "Iš km/h į m/s",
        description:
          "Automobilis užmiesčio keliu važiuoja 72 km/h greičiu. Išreikškite šį greitį metrais per sekundę. Įrašykite sveikąjį skaičių.",
        type: "number",
        points: 100,
        correct_answer: "20",
        hints: [
          "Viename kilometre yra 1000 m, vienoje valandoje yra 3600 s.",
          "Kilometrus paverskite metrais, valandą sekundėmis ir padalykite kelią iš laiko.",
        ],
        options: null,
        explanation:
          "72 km yra 72 000 m, o 1 h yra 3600 s. 72 000 m : 3600 s = 20 m/s. Trumpiau: greitį km/h dalijame iš 3,6. Dažna klaida yra dauginti iš 3,6: tuomet išeitų, kad automobilis per sekundę nuvažiuoja daugiau nei ketvirtį kilometro.",
        difficulty: "easy",
        cognitive_level: "understand",
      },
      {
        title: "Dviračiu į Palangą",
        description:
          "Dviratininkė pajūrio dviračių taku iš Klaipėdos į Palangą nuvažiavo 27 km per 1 h 30 min. Koks buvo jos vidutinis greitis? Atsakymą įrašykite km/h, sveikuoju skaičiumi.",
        type: "number",
        points: 150,
        correct_answer: "18",
        hints: [
          "Laiką pirmiausia išreikškite vien valandomis.",
          "Valandoje yra 60 minučių. Kurią valandos dalį sudaro 30 min?",
          "Visą kelią padalykite iš viso laiko valandomis.",
        ],
        options: null,
        explanation:
          "1 h 30 min yra 1,5 h. Vidutinis greitis: 27 km : 1,5 h = 18 km/h. Dažna klaida yra laiką užrašyti kaip 1,3 h: valandoje yra 60, o ne 100 minučių, todėl 30 min sudaro 0,5 h.",
        difficulty: "medium",
        cognitive_level: "apply",
      },
      {
        title: "Kaip toli trenkė žaibas?",
        description:
          "Žaibo blyksnį pamatėte, o griaustinį išgirdote po 6 s. Skaičiuokite, kad garso greitis ore yra 340 m/s, o šviesa jus pasiekia akimirksniu. Kokiu atstumu nuo jūsų trenkė žaibas? Atsakymą įrašykite metrais, sveikuoju skaičiumi.",
        type: "number",
        points: 200,
        correct_answer: "2040",
        hints: [
          "Nuspręskite, kuris iš trijų dydžių čia nežinomas: greitis, kelias ar laikas.",
          "Griaustinio garsas visą tą laiką sklido pastoviu greičiu.",
          "Kelias lygus greičio ir laiko sandaugai.",
        ],
        options: null,
        explanation:
          "Garsas 6 s sklido 340 m/s greičiu, todėl s = v · t = 340 m/s · 6 s = 2040 m, tai yra apie 2 km. Šviesos sklidimo laiko galime nepaisyti, nes šviesa sklinda beveik milijoną kartų greičiau už garsą. Taip per audrą galima įvertinti, ar žaibuoja arti.",
        difficulty: "medium",
        cognitive_level: "apply",
      },
      {
        title: "Ką pasakoja grafikas?",
        description:
          "Kūno kelio priklausomybės nuo laiko grafiką sudaro trys tiesios atkarpos. Pirmas etapas: nuo 0 s iki 10 s kelias tolygiai didėja nuo 0 m iki 50 m. Antras etapas: nuo 10 s iki 20 s grafikas eina horizontaliai, kelias lieka 50 m. Trečias etapas: nuo 20 s iki 30 s kelias tolygiai didėja nuo 50 m iki 80 m. Nusibraižykite grafiką. Kuris teiginys teisingas?",
        type: "multiple_choice",
        points: 200,
        correct_answer: "Pirmame etape kūnas judėjo greičiausiai, o antrame stovėjo",
        hints: [
          "Kuo statesnė kelio grafiko atkarpa, tuo didesnis greitis.",
          "Kiekvienam etapui raskite, kiek metrų kūnas nuėjo per tas 10 s.",
        ],
        options: [
          "Antrame etape kūnas tolygiai judėjo pirmyn",
          "Trečiame etape kūnas judėjo greičiausiai, nes pasiekė 80 m",
          "Visuose trijuose etapuose kūno greitis buvo vienodas",
          "Pirmame etape kūnas judėjo greičiausiai, o antrame stovėjo",
        ],
        explanation:
          "Pirmame etape kūnas per 10 s nuėjo 50 m, jo greitis 5 m/s. Antrame etape kelias nesikeitė, vadinasi, kūnas stovėjo. Trečiame etape per 10 s nueita 30 m, greitis 3 m/s. Kelio grafike greitį rodo atkarpos statumas, o ne tai, kaip aukštai ji yra.",
        difficulty: "hard",
        cognitive_level: "analyse",
      },
      {
        title: "Vidutinio greičio spąstai",
        description:
          "Automobilis nuvažiavo 120 km. Pirmus 60 km jis važiavo 60 km/h greičiu, o likusius 60 km dėl kelio remonto tik 30 km/h greičiu. Koks buvo automobilio vidutinis greitis visame kelyje? Atsakymą įrašykite km/h, sveikuoju skaičiumi.",
        type: "number",
        points: 250,
        correct_answer: "40",
        hints: [
          "Vidutinis greitis nėra dviejų greičių vidurkis.",
          "Raskite, kiek laiko automobilis važiavo kiekvieną kelio dalį.",
          "Visą kelią padalykite iš viso kelionės laiko.",
        ],
        options: null,
        explanation:
          "Pirma dalis truko 60 km : 60 km/h = 1 h, antra 60 km : 30 km/h = 2 h. Visas kelias 120 km, visas laikas 3 h, todėl vidutinis greitis 120 km : 3 h = 40 km/h. Tai ne 45 km/h, nes lėtai automobilis važiavo dvigubai ilgiau nei greitai.",
        difficulty: "hard",
        cognitive_level: "analyse",
      },
    ],
  },
  {
    slug: "chemines-formules-ir-skaiciavimai",
    title: "Ką pasako cheminė formulė?",
    description:
      "Komandos skaito chemines formules: skiria vienines ir sudėtines medžiagas, skaičiuoja atomus, santykinę molekulinę masę ir elemento masės dalį, o pabaigoje palygina keturias azoto trąšas. 9-10 klasėse tinka kartojimui.",
    subject: "Chemija",
    grade_band: "9-10 kl.",
    duration_minutes: 35,
    curriculum:
      "Chemijos bendroji programa (2022). Medžiagų sudėtis ir cheminiai skaičiavimai: cheminės formulės, vieninės ir sudėtinės medžiagos, santykinė molekulinė masė, elemento masės dalis junginyje. Veikla skirta kartojimui.",
    learning_goals: [
      "Iš cheminės formulės nustatyti medžiagos sudėtį ir atomų skaičių.",
      "Apskaičiuoti santykinę molekulinę masę ir elemento masės dalį junginyje.",
      "Sudaryti joninio junginio formulę pagal jonų krūvius ir palyginti junginius pagal elemento masės dalį.",
    ],
    teacher_notes: {
      before:
        "Suskirstykite mokinius į komandas po 3 ar 4. Komandai reikia vieno telefono, lapo ir skaičiuotuvo (tinka ir telefono). Visos santykinės atominės masės ir jonų krūviai pateikti užduotyse. Mokiniai jau turi mokėti skaičiuoti santykinę molekulinę masę ir masės dalį. Jei formules iki šiol sudarėte pagal valentingumą, pasakykite, kad jono krūvio dydis čia sutampa su valentingumu. Priminkite, ką formulėje reiškia indeksas ir skliaustai.",
      during:
        "Stebėkite, ar komandos indeksą po skliaustų pritaiko visiems skliaustuose esantiems atomams. Paskutinėje užduotyje paskatinkite pasidalyti darbą: kiekvienas narys skaičiuoja vieną junginį, tada rezultatai palyginami. Jei komanda renkasi atsakymą vien pagal azoto atomų skaičių, paklauskite, kokia yra visos formulės masė.",
      after:
        "Aptarkite dažnas klaidas. Elementų skaičius formulėje nėra atomų skaičius: gliukozėje yra trys elementai, bet daug daugiau atomų. Masės dalis priklauso ne tik nuo atomų skaičiaus, bet ir nuo jų masės: geležies okside deguonies atomų daugiau, bet didesnę masės dalį sudaro geležis. Paprašykite komandos lentoje parodyti trąšų palyginimą ir paklauskite, ar buvo galima apsieiti be kai kurių skaičiavimų.",
    },
    reflection_questions: [
      "Kaip pasidalijote skaičiavimus paskutinėje užduotyje ir kaip tikrinote vieni kitų rezultatus?",
      "Kurią klaidą komanda padarė arba vos nepadarė ir kaip ją pastebėjote?",
      "Ką cheminė formulė pasako apie medžiagą ir ko iš jos sužinoti negalima?",
      "Kam ūkininkui ar sodininkui naudinga žinoti azoto masės dalį trąšoje?",
    ],
    sources: [
      "Pagrindinio ugdymo chemijos vadovėlių temos: cheminės formulės, vieninės ir sudėtinės medžiagos, santykinė molekulinė masė, elemento masės dalis junginyje, jonai ir joninių junginių formulės.",
      "Periodinė elementų lentelė: santykinės atominės masės, suapvalintos iki sveikųjų skaičių (H 1, C 12, N 14, O 16, S 32, K 39, Ca 40, Fe 56).",
      "Visuotinė lietuvių enciklopedija (vle.lt): straipsniai apie klintį, hematitą, karbamidą ir azoto trąšas.",
    ],
    challenges: [
      {
        title: "Vieninė ar sudėtinė?",
        description:
          "Vieninė medžiaga sudaryta iš vieno cheminio elemento atomų, sudėtinė iš kelių elementų atomų. Kuri iš šių medžiagų yra vieninė?",
        type: "multiple_choice",
        points: 100,
        correct_answer: "Deguonis O₂",
        hints: [
          "Žiūrėkite ne į indeksus, o į tai, kiek skirtingų elementų simbolių yra formulėje.",
          "Elemento simbolis prasideda didžiąja raide: suskaičiuokite didžiąsias raides kiekvienoje formulėje.",
        ],
        options: ["Vanduo H₂O", "Anglies dioksidas CO₂", "Deguonis O₂", "Valgomoji druska NaCl"],
        explanation:
          "Deguonies molekulę O₂ sudaro du to paties elemento atomai, todėl tai vieninė medžiaga. Vanduo, anglies dioksidas ir valgomoji druska sudaryti iš dviejų skirtingų elementų, todėl jie yra sudėtinės medžiagos. Gryna medžiaga nebūtinai yra vieninė: grynas vanduo vis tiek yra junginys.",
        difficulty: "easy",
        cognitive_level: "remember",
      },
      {
        title: "Suskaičiuokite atomus",
        description:
          "Gliukozės, kurią fotosintezės metu gamina augalai, formulė yra C₆H₁₂O₆. Kiek atomų iš viso yra vienoje gliukozės molekulėje? Įrašykite sveikąjį skaičių.",
        type: "number",
        points: 100,
        correct_answer: "24",
        hints: [
          "Klausiama ne kiek elementų, o kiek atomų.",
          "Indeksas rodo, kiek to elemento atomų yra vienoje molekulėje.",
          "Sudėkite visų trijų elementų atomų skaičius.",
        ],
        options: null,
        explanation:
          "Indeksai rodo atomų skaičių: 6 anglies, 12 vandenilio ir 6 deguonies atomai. Iš viso 6 + 12 + 6 = 24 atomai. Dažna klaida yra atsakyti 3: tiek molekulėje yra skirtingų elementų, o ne atomų.",
        difficulty: "easy",
        cognitive_level: "understand",
      },
      {
        title: "Klinties formulė",
        description:
          "Klintis yra uoliena, iš kurios gaminamas cementas. Pagrindinė klinties medžiaga yra kalcio karbonatas CaCO₃. Apskaičiuokite kalcio karbonato santykinę molekulinę (formulinę) masę. Santykinės atominės masės: Ca 40, C 12, O 16. Įrašykite sveikąjį skaičių.",
        type: "number",
        points: 150,
        correct_answer: "100",
        hints: [
          "Santykinė molekulinė masė yra visų formulėje esančių atomų santykinių atominių masių suma.",
          "Atkreipkite dėmesį į indeksą prie deguonies.",
          "Kiekvieno elemento atominę masę imkite tiek kartų, kiek jo atomų yra formulėje.",
        ],
        options: null,
        explanation:
          "Formulėje CaCO₃ yra vienas kalcio, vienas anglies ir trys deguonies atomai. Mr = 40 + 12 + 3 · 16 = 40 + 12 + 48 = 100. Dažna klaida yra pamiršti indeksą ir deguonį skaičiuoti tik vieną kartą: tuomet gaunama 68.",
        difficulty: "medium",
        cognitive_level: "apply",
      },
      {
        title: "Krūvių pusiausvyra",
        description:
          "Aliuminio oksidas sudarytas iš aliuminio ir oksido jonų. Aliuminio jono krūvis yra 3+, oksido jono krūvis 2−. Junginys turi būti elektriškai neutralus. Kuri aliuminio oksido formulė teisinga?",
        type: "multiple_choice",
        points: 150,
        correct_answer: "Al₂O₃",
        hints: [
          "Visų teigiamų ir visų neigiamų krūvių suma formulėje turi būti lygi nuliui.",
          "Raskite mažiausią skaičių, kuris dalijasi ir iš aliuminio, ir iš oksido jono krūvio dydžio.",
          "Indeksas rodo, kiek jonų reikia tam bendram krūviui surinkti.",
        ],
        options: ["AlO", "Al₃O₂", "AlO₃", "Al₂O₃"],
        explanation:
          "Du aliuminio jonai turi krūvį 2 · (3+) = 6+, trys oksido jonai 3 · (2−) = 6−. Krūviai išsilygina, todėl formulė yra Al₂O₃. Dažna klaida yra jono krūvio skaičių rašyti kaip to paties jono indeksą: taip gaunama Al₃O₂, kur krūviai 9+ ir 4− neišsilygina.",
        difficulty: "medium",
        cognitive_level: "apply",
      },
      {
        title: "Kiek geležies rūdoje?",
        description:
          "Geležies rūdos mineralą hematitą sudaro geležies(III) oksidas Fe₂O₃. Apskaičiuokite geležies masės dalį šiame okside procentais. Santykinės atominės masės: Fe 56, O 16. Įrašykite sveikąjį skaičių be procento ženklo.",
        type: "number",
        points: 200,
        correct_answer: "70",
        hints: [
          "Pirmiausia apskaičiuokite viso junginio santykinę molekulinę (formulinę) masę.",
          "Raskite, kokią masę sudaro visi formulėje esantys geležies atomai.",
          "Geležies atomų masę padalykite iš visos formulės masės ir padauginkite iš šimto.",
        ],
        options: null,
        explanation:
          "Mr(Fe₂O₃) = 2 · 56 + 3 · 16 = 112 + 48 = 160. Geležies masės dalis: 112 : 160 = 0,70, tai yra 70 %. Nors deguonies atomų formulėje daugiau, geležies atomai daug sunkesni, todėl didžiąją masės dalį sudaro geležis.",
        difficulty: "hard",
        cognitive_level: "apply",
      },
      {
        title: "Kuri trąša turi daugiausia azoto?",
        description:
          "Augalams reikia azoto, todėl svarbu, kokią trąšos masės dalį jis sudaro. Palyginkite keturis junginius ir nustatykite, kuriame azoto masės dalis didžiausia. Santykinės atominės masės: H 1, C 12, N 14, O 16, S 32, K 39. Patarimas: pasidalykite skaičiavimus komandoje.",
        type: "multiple_choice",
        points: 250,
        correct_answer: "Karbamidas CO(NH₂)₂",
        hints: [
          "Kiekvienam junginiui raskite azoto atomų masę ir visos formulės masę.",
          "Atidžiai suskaičiuokite azoto atomus: indeksas po skliaustų galioja visiems skliaustuose esantiems atomams.",
          "Jei dviejuose junginiuose azoto atomų masė vienoda, azoto dalis didesnė ten, kur visos formulės masė mažesnė.",
        ],
        options: [
          "Amonio nitratas NH₄NO₃",
          "Kalio nitratas KNO₃",
          "Karbamidas CO(NH₂)₂",
          "Amonio sulfatas (NH₄)₂SO₄",
        ],
        explanation:
          "Karbamido Mr = 60, azoto jame 28, masės dalis apie 47 %. Amonio nitrato Mr = 80, azoto 28, dalis 35 %. Amonio sulfato Mr = 132, azoto 28, dalis apie 21 %. Kalio nitrato Mr = 101, azoto 14, dalis apie 14 %. Trijuose junginiuose azoto atomų po du, todėl lemia visos formulės masė: ji mažiausia karbamido.",
        difficulty: "hard",
        cognitive_level: "analyse",
      },
    ],
  },
]
