import type { StarterActivityInput } from "./schema"

// Every answer below was solved twice by two methods; the key calculation is
// in each task's `explanation`. All prices, distances and counts are invented.

const fractionsAndPercentages: StarterActivityInput = {
  slug: "matematika-5-6-trupmenos-procentai-muge",
  title: "Trupmenos ir procentai mokyklos mugėje",
  description:
    "Komandos skaičiuoja mokyklos mugės pirkinius, nuolaidas ir pardavimus: randa skaičiaus dalį, procentus ir visą kiekį pagal jo dalį.",
  subject: "Matematika",
  grade_band: "5-6 kl.",
  duration_minutes: 30,
  curriculum:
    "Matematikos bendroji programa (2022), 5-6 klasės. Sritis „Skaičiai ir skaičiavimai“: paprastosios ir dešimtainės trupmenos, procentai, skaičiaus dalies ir procentų radimas, skaičiaus radimas pagal jo dalį.",
  learning_goals: [
    "Rasti skaičiaus dalį, kai dalis nurodyta trupmena arba procentais.",
    "Palyginti dalis, užrašytas paprastąja trupmena, dešimtaine trupmena ir procentais.",
    "Rasti visą kiekį, kai žinoma, kiek procentų jo sudaro duotas skaičius.",
  ],
  teacher_notes: {
    before:
      "Suskirstykite mokinius į komandas po 2-4. Kiekvienai komandai reikia popieriaus lapo ir pieštuko, skaičiuotuvai nenaudojami. Priminkite, kad 1 % yra šimtoji skaičiaus dalis. Susitarkite: atsakymas įvedamas tik tada, kai jam pritaria visa komanda. Pasakykite, kad užuomina kainuoja taškų, todėl pirmiausia verta pasitarti.",
    during:
      "Stebėkite, ar komandos užsirašo tarpinius skaičiavimus, ar spėlioja. Užduotyje „Kas liko piniginėje?“ dalis mokinių 30 % skaičiuos nuo likučio, o ne nuo visos sumos: paprašykite dar kartą perskaityti sąlygą. Paskutinėje užduotyje paklauskite, kurią visų sausainių dalį sudaro likę 12 sausainių.",
    after:
      "Aptarkite dvi dažniausias klaidas. Pirma: nuolaidos dydis painiojamas su nauja kaina (užduotis „Sąsiuvinis su nuolaida“). Paprašykite vienos komandos parodyti skaičiavimą lentoje dviem būdais: atimant nuolaidą ir iš karto randant 75 % kainos. Antra: procentai priskiriami ne tam dydžiui (paskutinėje užduotyje 12 sausainių yra 20 %, o ne 80 %). Nubraižykite juostelę, padalytą į 5 lygias dalis, ir parodykite, kad viena dalis yra 12 sausainių.",
  },
  reflection_questions: [
    "Kurioje užduotyje jūsų komanda nesutarė dėl atsakymo ir kaip nusprendėte, kas teisus?",
    "Kada patogiau skaičiuoti su trupmenomis, o kada su procentais? Pateikite pavyzdį iš šios veiklos.",
    "Kaip pasitikrinote atsakymą prieš jį įvesdami?",
    "Ką kitą kartą darytumėte kitaip, kad sugaištumėte mažiau laiko?",
  ],
  sources: [
    "Matematikos bendroji programa (2022): 5-6 klasių mokymo turinys, sritis „Skaičiai ir skaičiavimai“.",
    "Užduotis sukūrė KU STEAM CLASSROOM turinio autoriai. Visi skaičiai ir kainos sugalvoti.",
  ],
  challenges: [
    {
      title: "Nuolaidos kortelė",
      description:
        "Mugėje ant stalo padėta kortelė „25 % nuolaida“. Kokia kainos dalis nuleidžiama? Pasirinkite trupmeną, lygią 25 %.",
      type: "multiple_choice",
      points: 100,
      correct_answer: "1/4",
      hints: [
        "Procentas yra šimtoji dalis. Užrašykite 25 % kaip trupmeną su vardikliu 100.",
        "Gautą trupmeną suprastinkite: skaitiklį ir vardiklį padalykite iš to paties skaičiaus.",
      ],
      options: ["1/25", "1/4", "2/5", "1/5"],
      explanation:
        "25 % = 25/100. Skaitiklį ir vardiklį padaliję iš 25, gauname 1/4. Dažna klaida: procentų skaičių įrašyti į vardiklį ir gauti 1/25, bet tai tik 4 %.",
      difficulty: "easy",
      cognitive_level: "remember",
    },
    {
      title: "Sausainių kepėjai",
      description:
        "Klasėje mokosi 24 mokiniai. 3/8 klasės mokinių mugei kepė sausainius. Kiek mokinių kepė sausainius? Atsakymą įrašykite sveikuoju skaičiumi.",
      type: "number",
      points: 100,
      correct_answer: "9",
      hints: [
        "Reikia rasti skaičiaus dalį: tris aštuntąsias visų klasės mokinių.",
        "Pirmiausia raskite, kiek mokinių sudaro vieną aštuntąją klasės.",
        "Vieną aštuntąją padauginkite iš trupmenos skaitiklio.",
      ],
      options: null,
      explanation:
        "Viena aštuntoji klasės yra 24 : 8 = 3 mokiniai. Trys aštuntosios yra 3 · 3 = 9 mokiniai. Dažna klaida: 24 padalyti iš 3 ir gauti 8, tai yra rasti trečdalį, o ne tris aštuntąsias.",
      difficulty: "easy",
      cognitive_level: "apply",
    },
    {
      title: "Kuri komanda pardavė daugiausia?",
      description:
        "Trys komandos iškepė po tiek pat keksiukų. „Aitvarai“ pardavė 3/5 savo keksiukų, „Bitės“ pardavė 65 % savo keksiukų, o „Cepelinai“ pardavė 0,7 savo keksiukų. Kuri komanda pardavė didžiausią dalį?",
      type: "multiple_choice",
      points: 150,
      correct_answer: "Cepelinai",
      hints: [
        "Dalis galima palyginti tik tada, kai jos užrašytos vienodai.",
        "Visas tris dalis užrašykite procentais: paprastąją trupmeną išplėskite iki vardiklio 100, dešimtainę trupmeną padauginkite iš 100.",
      ],
      options: ["Aitvarai", "Bitės", "Cepelinai", "Visos pardavė po lygiai"],
      explanation:
        "3/5 = 60/100 = 60 %, o 0,7 = 70 %. Lyginame 60 %, 65 % ir 70 %: didžiausią dalį pardavė „Cepelinai“. Dažna klaida: manyti, kad 0,7 yra 7 %, arba lyginti skaičius 5, 65 ir 7, nežiūrint, kaip užrašyta dalis.",
      difficulty: "medium",
      cognitive_level: "understand",
    },
    {
      title: "Sąsiuvinis su nuolaida",
      description:
        "Sąsiuvinis kainuoja 2,40 €. Mugės dieną jam taikoma 25 % nuolaida. Kiek eurų kainuoja sąsiuvinis su nuolaida? Atsakymą įrašykite dešimtaine trupmena, eurais (tik skaičių).",
      type: "number",
      points: 150,
      correct_answer: "1,8",
      accepted_answers: ["1,80"],
      hints: [
        "Klausiama naujos kainos, o ne nuolaidos dydžio.",
        "25 % yra ketvirtadalis. Raskite ketvirtadalį kainos: tai nuolaida eurais.",
        "Nuolaidą atimkite iš pradinės kainos.",
      ],
      options: null,
      explanation:
        "Nuolaida yra ketvirtadalis kainos: 2,40 : 4 = 0,60 €. Nauja kaina: 2,40 - 0,60 = 1,80 €. Galima ir kitaip: lieka 75 % kainos, tai yra 3 · 0,60 = 1,80 €. Dažna klaida: atsakyti 0,60, nors tai tik nuolaidos dydis.",
      difficulty: "medium",
      cognitive_level: "apply",
    },
    {
      title: "Kas liko piniginėje?",
      description:
        "Ugnė į mugę atsinešė 40 €. Ketvirtadalį šios sumos ji išleido knygai, o 30 % visos atsineštos sumos išleido užkandžiams. Kiek eurų Ugnei liko? Atsakymą įrašykite sveikuoju skaičiumi, eurais.",
      type: "number",
      points: 200,
      correct_answer: "18",
      hints: [
        "Abi išlaidos skaičiuojamos nuo visos atsineštos sumos, ne nuo likučio.",
        "Atskirai raskite, kiek eurų kainavo knyga ir kiek užkandžiai. Dešimt procentų sumos rasite padaliję ją iš dešimties.",
        "Sudėkite abi išlaidas ir atimkite iš atsineštos sumos.",
      ],
      options: null,
      explanation:
        "Knyga: 40 : 4 = 10 €. Užkandžiai: 10 % yra 4 €, todėl 30 % yra 12 €. Liko 40 - 10 - 12 = 18 €. Patikrinimas: išleista 25 % + 30 % = 55 %, liko 45 % nuo 40 €, tai yra 18 €. Dažna klaida: 30 % skaičiuoti nuo likusių 30 €.",
      difficulty: "medium",
      cognitive_level: "apply",
    },
    {
      title: "Mugės kasa",
      description:
        "Komanda iškepė sausainių ir pardavė 80 % jų. Liko 12 neparduotų sausainių. Vienas sausainis kainavo 0,50 €. Kiek eurų komanda gavo už parduotus sausainius? Atsakymą įrašykite sveikuoju skaičiumi, eurais.",
      type: "number",
      points: 250,
      correct_answer: "24",
      hints: [
        "Pirmiausia išsiaiškinkite, kiek procentų visų sausainių sudaro likę 12 sausainių.",
        "Žinodami, kiek sausainių atitinka tą procentų dalį, raskite, kiek sausainių buvo iškepta iš viso.",
        "Raskite parduotų sausainių skaičių ir padauginkite iš vieno sausainio kainos.",
      ],
      options: null,
      explanation:
        "Liko 100 % - 80 % = 20 % sausainių, tai yra 12 vienetų. 20 % yra penktadalis, todėl iškepta 12 · 5 = 60 sausainių, parduota 60 - 12 = 48. Gauta 48 · 0,50 = 24 €. Dažna klaida: manyti, kad 12 sausainių yra 80 %, arba skaičiuoti pinigus už visus iškeptus sausainius.",
      difficulty: "hard",
      cognitive_level: "analyse",
    },
  ],
}

const proportionsAndScale: StarterActivityInput = {
  slug: "matematika-7-8-proporcijos-mastelis-kelione",
  title: "Proporcijos ir mastelis: kelionė po Lietuvą",
  description:
    "Komandos planuoja kelionę: pagal žemėlapio mastelį randa atstumus, skaičiuoja degalus ir laiką, skiria tiesioginį ir atvirkštinį proporcingumą.",
  subject: "Matematika",
  grade_band: "7-8 kl.",
  duration_minutes: 30,
  curriculum:
    "Matematikos bendroji programa (2022), 7-8 klasės. Sritys „Skaičiai ir skaičiavimai“ ir „Modeliai ir sąryšiai“: santykis, proporcija, mastelis, tiesiogiai ir atvirkščiai proporcingi dydžiai, jų taikymas praktiniuose uždaviniuose.",
  learning_goals: [
    "Pagal žemėlapio mastelį apskaičiuoti tikrąjį atstumą ir teisingai paversti ilgio vienetus.",
    "Atpažinti, ar du dydžiai yra tiesiogiai, ar atvirkščiai proporcingi, ir pagrįsti pasirinkimą.",
    "Sudaryti ir išspręsti proporciją žodiniame uždavinyje.",
  ],
  teacher_notes: {
    before:
      "Suskirstykite mokinius į komandas po 2-4. Reikia popieriaus ir pieštuko, skaičiuotuvai nenaudojami. Prieš pradėdami kartu prisiminkite, kad 1 m = 100 cm ir 1 km = 1000 m, ir užrašykite tai lentoje. Patarkite komandoms pasiskirstyti darbus: vienas garsiai skaito sąlygą, kitas užrašo duomenis, visi kartu tikrina atsakymą.",
    during:
      "Stebėkite, ar komandos prieš skaičiuodamos nusprendžia, kokie yra dydžiai: tiesiogiai ar atvirkščiai proporcingi. Jei užduotyje „Palapinių miestelis“ komanda gauna 45, paklauskite: „Ar gali būti, kad daugiau mokinių dirbs ilgiau?“ Mastelio užduotyse žiūrėkite, ar vienetai verčiami žingsnis po žingsnio.",
    after:
      "Lentoje surašykite visų užduočių dydžių poras ir kartu suskirstykite jas į tiesiogiai ir atvirkščiai proporcingas. Aptarkite klausimą, kurį verta užduoti prieš skaičiuojant: „Jei vienas dydis didėja, kitas didėja ar mažėja?“ Tada peržiūrėkite vienetų vertimą: paprašykite vienos komandos parodyti, kaip 500 000 cm paverčiami kilometrais. Paskutinėje užduotyje aptarkite, kodėl 1,5 h nėra 1 valanda 50 minučių.",
  },
  reflection_questions: [
    "Kaip nusprendėte, ar dydžiai tiesiogiai, ar atvirkščiai proporcingi?",
    "Kurioje užduotyje padėjo klausimas „Ar toks atsakymas apskritai gali būti?“",
    "Kaip pasiskirstėte darbus komandoje paskutinėje, dviejų žingsnių užduotyje?",
    "Kur dar kasdienybėje susiduriate su masteliu ar proporcijomis?",
  ],
  sources: [
    "Matematikos bendroji programa (2022): 7-8 klasių mokymo turinys (santykiai, proporcijos, mastelis).",
    "Užduotis sukūrė KU STEAM CLASSROOM turinio autoriai. Atstumai, masteliai ir degalų sąnaudos sugalvoti ir nurodyti pačiose užduotyse.",
  ],
  challenges: [
    {
      title: "Ką reiškia mastelis?",
      description:
        "Turistinio žemėlapio mastelis yra 1 : 100 000. Kokį tikrąjį atstumą atitinka 1 cm žemėlapyje?",
      type: "multiple_choice",
      points: 100,
      correct_answer: "1 km",
      hints: [
        "Mastelis 1 : 100 000 reiškia, kad tikrasis atstumas yra 100 000 kartų didesnis už atstumą žemėlapyje.",
        "Gautą atstumą centimetrais paverskite metrais (viename metre yra 100 cm), o tada kilometrais (viename kilometre yra 1000 m).",
      ],
      options: ["100 m", "1 km", "10 km", "100 km"],
      explanation:
        "1 cm žemėlapyje atitinka 100 000 cm tikrovėje. 100 000 cm = 1000 m = 1 km. Dažna klaida: verčiant vienetus praleisti arba pridėti vieną žingsnį ir gauti 100 m arba 10 km.",
      difficulty: "easy",
      cognitive_level: "remember",
    },
    {
      title: "Nuo Klaipėdos iki Palangos",
      description:
        "Žemėlapio mastelis yra 1 : 500 000. Šiame žemėlapyje atstumas tiesia linija nuo Klaipėdos iki Palangos yra 5 cm. Koks tikrasis atstumas tiesia linija? Atsakymą įrašykite sveikuoju skaičiumi, kilometrais.",
      type: "number",
      points: 100,
      correct_answer: "25",
      hints: [
        "Pirmiausia išsiaiškinkite, kiek kilometrų atitinka 1 cm šiame žemėlapyje.",
        "500 000 cm paverskite metrais, tada kilometrais.",
        "Vieno centimetro atitikmenį padauginkite iš atstumo žemėlapyje.",
      ],
      options: null,
      explanation:
        "1 cm žemėlapyje atitinka 500 000 cm = 5000 m = 5 km. Tada 5 cm atitinka 5 · 5 = 25 km. Dažna klaida: neteisingai paversti centimetrus kilometrais ir gauti 2,5 km arba 250 km.",
      difficulty: "easy",
      cognitive_level: "apply",
    },
    {
      title: "Greičiau ar lėčiau?",
      description:
        "Autobusas tą patį kelią nuo Šiaulių iki Panevėžio vieną dieną važiuoja įprastu greičiu, o kitą dieną dėl kelio remonto važiuoja dvigubai mažesniu greičiu. Kaip pasikeičia kelionės laikas?",
      type: "multiple_choice",
      points: 150,
      correct_answer: "Pailgėja 2 kartus",
      hints: [
        "Kelias abi dienas tas pats. Pagalvokite, kaip susiję greitis ir laikas, kai kelias nesikeičia.",
        "Kelias lygus greičio ir laiko sandaugai. Jei vienas daugiklis sumažėja, kaip turi pasikeisti kitas, kad sandauga liktų ta pati?",
      ],
      options: ["Sutrumpėja 2 kartus", "Nepasikeičia", "Pailgėja 2 kartus", "Pailgėja 2 valandomis"],
      explanation:
        "Kai kelias tas pats, greitis ir laikas yra atvirkščiai proporcingi: jų sandauga pastovi. Greičiui sumažėjus 2 kartus, laikas pailgėja 2 kartus. Dažna klaida: painioti „kartus“ su „valandomis“ arba manyti, kad mažėjant greičiui trumpėja ir laikas.",
      difficulty: "medium",
      cognitive_level: "understand",
    },
    {
      title: "Degalai kelionei",
      description:
        "Automobilis 100 km nuvažiuoja sunaudodamas 6 l degalų. Šeimos kelionės maršruto ilgis yra 250 km. Kiek litrų degalų reikės visai kelionei, jei sąnaudos nesikeičia? Atsakymą įrašykite sveikuoju skaičiumi, litrais.",
      type: "number",
      points: 150,
      correct_answer: "15",
      hints: [
        "Kuo ilgesnis kelias, tuo daugiau degalų: dydžiai tiesiogiai proporcingi.",
        "Sudarykite proporciją: 100 km atitinka 6 l, 250 km atitinka x l.",
        "Galite skaičiuoti ir dalimis: kiek degalų reikia 50 km? Kiek kartų po 50 km telpa į visą maršrutą?",
      ],
      options: null,
      explanation:
        "Proporcija: 100 : 6 = 250 : x, todėl x = 6 · 250 : 100 = 15 l. Kitas būdas: 50 km reikia 3 l, o 250 km yra 5 kartus po 50 km, taigi 5 · 3 = 15 l. Dažna klaida: sudarant proporciją sukeisti narius ir gauti mažiau nei 6 l, nors kelias ilgesnis.",
      difficulty: "medium",
      cognitive_level: "apply",
    },
    {
      title: "Palapinių miestelis",
      description:
        "4 mokiniai visas stovyklos palapines pastato per 30 minučių. Per kiek minučių tas pačias palapines pastatytų 6 mokiniai, jei visi dirba vienodu tempu? Atsakymą įrašykite sveikuoju skaičiumi, minutėmis.",
      type: "number",
      points: 200,
      correct_answer: "20",
      hints: [
        "Pagalvokite: kai dirba daugiau mokinių, laiko reikia daugiau ar mažiau?",
        "Dydžiai atvirkščiai proporcingi: mokinių skaičiaus ir laiko sandauga nesikeičia.",
        "Raskite, per kiek minučių visą darbą atliktų vienas mokinys, ir padalykite iš naujo mokinių skaičiaus.",
      ],
      options: null,
      explanation:
        "Vienas mokinys visą darbą atliktų per 4 · 30 = 120 minučių. Šeši mokiniai jį atliks per 120 : 6 = 20 minučių. Dažna klaida: sudaryti tiesioginę proporciją ir gauti 45 minutes, nors daugiau mokinių negali dirbti ilgiau.",
      difficulty: "medium",
      cognitive_level: "apply",
    },
    {
      title: "Dviračių žygis",
      description:
        "Žemėlapio mastelis yra 1 : 200 000. Dviračių tako ilgis žemėlapyje yra 12 cm. Dviratininkas visą taką važiuoja pastoviu 16 km/h greičiu ir nesustoja. Per kiek minučių jis nuvažiuos visą taką? Atsakymą įrašykite sveikuoju skaičiumi, minutėmis.",
      type: "number",
      points: 250,
      correct_answer: "90",
      hints: [
        "Uždavinys dviejų dalių: pirmiausia raskite tikrąjį tako ilgį kilometrais, tada laiką.",
        "Išsiaiškinkite, kiek kilometrų atitinka 1 cm šiame žemėlapyje, ir padauginkite iš tako ilgio žemėlapyje.",
        "Laikas lygus keliui, padalytam iš greičio. Gausite valandas: nepamirškite jų paversti minutėmis.",
      ],
      options: null,
      explanation:
        "1 cm atitinka 200 000 cm = 2 km, todėl tako ilgis yra 12 · 2 = 24 km. Laikas: 24 : 16 = 1,5 h = 90 minučių. Dažna klaida: 1,5 h palaikyti 1 valanda ir 50 minučių arba atsakyti valandomis, nors prašoma minučių.",
      difficulty: "hard",
      cognitive_level: "analyse",
    },
  ],
}

const pythagoreanTheorem: StarterActivityInput = {
  slug: "matematika-9-10-pitagoro-teorema",
  title: "Pitagoro teorema: nuo kopėčių iki stogo",
  description:
    "Komandos taiko Pitagoro teoremą praktinėse situacijose: randa įžambinę ir statinį, atpažįsta statųjį trikampį, skaičiuoja atstumą koordinačių plokštumoje ir plotą.",
  subject: "Matematika",
  grade_band: "9-10 kl.",
  duration_minutes: 35,
  curriculum:
    "Matematikos bendroji programa (2022), 9-10 klasės. Sritis „Geometrija ir matavimai“: Pitagoro teoremos ir jai atvirkštinės teoremos kartojimas ir taikymas stačiojo trikampio, atstumo tarp taškų ir ploto uždaviniuose.",
  learning_goals: [
    "Pagal Pitagoro teoremą apskaičiuoti stačiojo trikampio įžambinę arba statinį.",
    "Patikrinti, ar trikampis su duotais kraštinių ilgiais yra statusis.",
    "Praktinėje situacijoje įžvelgti statųjį trikampį ir išspręsti dviejų žingsnių uždavinį.",
  ],
  teacher_notes: {
    before:
      "Suskirstykite mokinius į komandas po 2-4. Reikia popieriaus (geriausia languoto), pieštuko ir liniuotės brėžiniams, skaičiuotuvai nenaudojami. Prieš pradėdami kartu prisiminkite skaičių nuo 1 iki 20 kvadratus arba leiskite komandoms pasidaryti jų lentelę. Susitarkite: kiekvienai žodinei užduočiai komanda pirmiausia nusibraižo brėžinį.",
    during:
      "Stebėkite, ar komandos braižo brėžinius ir pažymi, kuri kraštinė yra įžambinė. Užduotyje „Gaisrininkų kopėčios“ dalis mokinių kvadratus sudės, nors reikia atimti: paklauskite, kuri kraštinė ilgiausia. Paskutinėje užduotyje nesakykite, kad reikia aukštinės: užtenka klausimo „Ko trūksta plotui apskaičiuoti?“",
    after:
      "Paprašykite komandų parodyti užduočių „Gaisrininkų kopėčios“ ir „Stogo siena“ brėžinius ir palyginkite, kur ieškota įžambinės, o kur statinio. Aptarkite klaidas: kvadratų sudėtį vietoj atimties, pamirštą šaknies traukimą, šoninę kraštinę vietoj aukštinės. Atkreipkite dėmesį į Pitagoro trejetus (3, 4, 5 ir jo kartotinius, 5, 12, 13 bei 8, 15, 17): juos atpažinus skaičiuoti greičiau. Paklauskite, kaip patikrinti, ar atsakymas prasmingas: įžambinė visada ilgesnė už kiekvieną statinį ir trumpesnė už jų sumą.",
  },
  reflection_questions: [
    "Kaip brėžinys padėjo (arba būtų padėjęs) jūsų komandai išvengti klaidos?",
    "Kaip nusprendėte, ar kvadratus reikia sudėti, ar atimti?",
    "Kurioje užduotyje pastebėjote pažįstamą skaičių trejetą ir kaip tai pagreitino darbą?",
    "Kaip pasiskirstėte vaidmenis: kas braižė, kas skaičiavo, kas tikrino?",
  ],
  sources: [
    "Matematikos bendroji programa (2022): pagrindinio ugdymo mokymo turinys, sritis „Geometrija ir matavimai“ (statusis trikampis, Pitagoro teorema).",
    "Užduotis sukūrė KU STEAM CLASSROOM turinio autoriai. Visi matmenys sugalvoti ir parinkti taip, kad šaknys būtų sveikieji skaičiai.",
  ],
  challenges: [
    {
      title: "Teoremos užrašas",
      description:
        "Stačiojo trikampio statinių ilgiai yra a ir b, įžambinės ilgis yra c. Kuri lygybė išreiškia Pitagoro teoremą?",
      type: "multiple_choice",
      points: 100,
      correct_answer: "a² + b² = c²",
      hints: [
        "Pitagoro teorema sieja kraštinių ilgių kvadratus, ne pačius ilgius.",
        "Įžambinė yra ilgiausia stačiojo trikampio kraštinė, todėl jos kvadratas lygybėje stovi vienas.",
      ],
      options: ["a + b = c", "a² + c² = b²", "a² + b² = c²", "a² - b² = c²"],
      explanation:
        "Pitagoro teorema: stačiojo trikampio įžambinės kvadratas lygus statinių kvadratų sumai, a² + b² = c². Dažna klaida: sudėti pačius ilgius (a + b = c) arba supainioti, kuri kraštinė yra įžambinė.",
      difficulty: "easy",
      cognitive_level: "remember",
    },
    {
      title: "Kirpimo linija",
      description:
        "Stačiakampio formos kartono lapo kraštinės yra 9 cm ir 12 cm. Lapas perkerpamas tiesiai pagal įstrižainę. Koks kirpimo linijos ilgis? Atsakymą įrašykite sveikuoju skaičiumi, centimetrais.",
      type: "number",
      points: 100,
      correct_answer: "15",
      hints: [
        "Įstrižainė dalija stačiakampį į du stačiuosius trikampius. Kuri trikampio kraštinė yra įstrižainė?",
        "Įžambinės kvadratas lygus statinių kvadratų sumai.",
        "Apskaičiuokite 9² + 12² ir ištraukite kvadratinę šaknį.",
      ],
      options: null,
      explanation:
        "Įstrižainė yra stačiojo trikampio, kurio statiniai 9 cm ir 12 cm, įžambinė. √(9² + 12²) = √(81 + 144) = √225 = 15 cm. Dažna klaida: pamiršti ištraukti šaknį ir atsakyti 225 arba tiesiog sudėti statinius.",
      difficulty: "easy",
      cognitive_level: "apply",
    },
    {
      title: "Kuris trikampis statusis?",
      description:
        "Duoti keturių trikampių kraštinių ilgiai. Tik vienas iš šių trikampių yra statusis. Kuris?",
      type: "multiple_choice",
      points: 150,
      correct_answer: "8 cm, 15 cm, 17 cm",
      hints: [
        "Trikampis yra statusis, jei jo kraštinėms galioja Pitagoro teoremos lygybė.",
        "Kiekvienam variantui sudėkite dviejų trumpesnių kraštinių kvadratus ir palyginkite su ilgiausios kraštinės kvadratu.",
      ],
      options: ["5 cm, 6 cm, 7 cm", "6 cm, 8 cm, 12 cm", "8 cm, 15 cm, 17 cm", "9 cm, 12 cm, 16 cm"],
      explanation:
        "Trikampis statusis, jei dviejų trumpesnių kraštinių kvadratų suma lygi ilgiausios kraštinės kvadratui. 8² + 15² = 64 + 225 = 289 = 17². Kitur lygybė negalioja, pavyzdžiui, 6² + 8² = 100, o 12² = 144. Dažna klaida: pasirinkti skaičius, panašius į žinomus trejetus 6, 8, 10 arba 9, 12, 15, jų nepatikrinus.",
      difficulty: "medium",
      cognitive_level: "understand",
    },
    {
      title: "Gaisrininkų kopėčios",
      description:
        "Gaisrininkų kopėčios yra 13 m ilgio. Jų apačia stovi ant lygios žemės 5 m atstumu nuo vertikalios pastato sienos, o viršus remiasi į sieną. Kokiame aukštyje kopėčių viršus liečia sieną? Atsakymą įrašykite sveikuoju skaičiumi, metrais.",
      type: "number",
      points: 150,
      correct_answer: "12",
      hints: [
        "Nusibraižykite brėžinį: siena, žemė ir kopėčios sudaro statųjį trikampį. Kuri kraštinė yra įžambinė?",
        "Kopėčios yra įžambinė, todėl ieškote statinio. Statinio kvadratas lygus įžambinės kvadrato ir kito statinio kvadrato skirtumui.",
        "Apskaičiuokite 13² - 5² ir ištraukite kvadratinę šaknį.",
      ],
      options: null,
      explanation:
        "Kopėčios yra įžambinė, siena ir žemė yra statiniai. Aukštis: √(13² - 5²) = √(169 - 25) = √144 = 12 m. Dažna klaida: kvadratus sudėti (169 + 25), tarsi būtų ieškoma įžambinės, arba tiesiog atimti 13 - 5.",
      difficulty: "medium",
      cognitive_level: "apply",
    },
    {
      title: "Nuo starto iki finišo",
      description:
        "Orientavimosi varžybų žemėlapyje nubrėžta stačiakampė koordinačių sistema. Viena vienetinė atkarpa abiejose ašyse atitinka 100 m. Startas yra taške A(3; 2), finišas yra taške B(15; 18). Koks atstumas tiesia linija nuo starto iki finišo? Atsakymą įrašykite sveikuoju skaičiumi, metrais.",
      type: "number",
      points: 200,
      correct_answer: "2000",
      hints: [
        "Atkarpa AB yra stačiojo trikampio įžambinė. Jo statiniai lygiagretūs koordinačių ašims.",
        "Statinių ilgius rasite atėmę taškų koordinates: atskirai x ir atskirai y.",
        "Radę atstumą vienetinėmis atkarpomis, nepamirškite jo paversti metrais.",
      ],
      options: null,
      explanation:
        "Statiniai: 15 - 3 = 12 ir 18 - 2 = 16 vienetų. Įžambinė: √(12² + 16²) = √(144 + 256) = √400 = 20 vienetų. Tikrasis atstumas: 20 · 100 = 2000 m. Dažna klaida: sudėti statinius (12 + 16 = 28) arba pamiršti vienetus paversti metrais.",
      difficulty: "medium",
      cognitive_level: "apply",
    },
    {
      title: "Stogo siena",
      description:
        "Sandėlio galinė stogo siena yra lygiašonio trikampio formos. Trikampio pagrindas yra 16 m, kiekviena šoninė kraštinė yra 10 m. Koks šios sienos plotas? Atsakymą įrašykite sveikuoju skaičiumi, kvadratiniais metrais.",
      type: "number",
      points: 250,
      correct_answer: "48",
      hints: [
        "Trikampio plotui apskaičiuoti reikia pagrindo ir aukštinės. Aukštinė neduota: ją reikia rasti.",
        "Lygiašonio trikampio aukštinė, nuleista į pagrindą, dalija pagrindą pusiau. Gaunate du vienodus stačiuosius trikampius.",
        "Stačiajame trikampyje žinote įžambinę (šoninę kraštinę) ir vieną statinį (pusę pagrindo). Raskite kitą statinį, tada plotą.",
      ],
      options: null,
      explanation:
        "Aukštinė dalija pagrindą pusiau: 16 : 2 = 8 m. Aukštinė: √(10² - 8²) = √(100 - 64) = √36 = 6 m. Plotas: 16 · 6 : 2 = 48 m². Dažna klaida: aukštine laikyti šoninę kraštinę (16 · 10 : 2 = 80) arba pamiršti padalyti iš 2.",
      difficulty: "hard",
      cognitive_level: "analyse",
    },
  ],
}

const algorithmsAndBinary: StarterActivityInput = {
  slug: "informatika-7-8-algoritmai-dvejetainiai",
  title: "Algoritmai ir dvejetainiai skaičiai be kompiuterio",
  description:
    "Komandos be kompiuterio vykdo algoritmus žingsnis po žingsnio, verčia skaičius iš dvejetainės sistemos į dešimtainę ir atgal. Užtenka popieriaus ir pieštuko.",
  subject: "Informatika",
  grade_band: "7-8 kl.",
  duration_minutes: 30,
  curriculum:
    "Informatikos bendroji programa (2022), 7-8 klasės. Sritis „Algoritmai ir programavimas“: algoritmo samprata, nuoseklūs veiksmai, šakojimas ir kartojimas, algoritmo vykdymas; duomenų kodavimas dvejetainiais skaičiais.",
  learning_goals: [
    "Įvykdyti algoritmą su kartojimu ir šakojimu žingsnis po žingsnio ir nustatyti jo rezultatą.",
    "Paversti skaičių iš dvejetainės sistemos į dešimtainę ir atgal.",
    "Rasti ir paaiškinti tipines algoritmo vykdymo klaidas, pavyzdžiui, klaidą vienetu.",
  ],
  teacher_notes: {
    before:
      "Suskirstykite mokinius į komandas po 2-4. Kompiuterių nereikia: užtenka popieriaus ir pieštuko. Lentoje užrašykite dvejetainių skaitmenų vertes 16, 8, 4, 2, 1 ir vienu pavyzdžiu parodykite, kaip jos sudedamos (pavyzdžiui, 101 yra 4 + 1 = 5). Patarkite komandoje paskirti vykdytoją, kuris skaito žingsnius, ir tikrintoją, kuris reikšmes užrašo lentelėje.",
    during:
      "Stebėkite, ar komandos algoritmus vykdo raštu, žingsnis po žingsnio, ar bando atspėti mintyse. Jei užduotyje „Kiek kartų suksis ciklas?“ atsakymas skiriasi vienetu, paprašykite parodyti reikšmių seką ir paklauskite, ką komanda skaičiuoja: reikšmes ar veiksmus. Dvejetainėse užduotyse žiūrėkite, ar didžiausia vertė rašoma kairėje.",
    after:
      "Lentoje kartu įvykdykite ciklo užduotį ir užrašykite reikšmių seką 6, 3, 10, 5, 16, 8, 4, 2, 1. Aptarkite klaidą vienetu: kodėl devynios reikšmės reiškia aštuonis veiksmus. Tada palyginkite, kaip komandos vertė skaičių 13 į dvejetainę sistemą, ir aptarkite atvirkščios skaitmenų tvarkos klaidą. Pabaigoje paklauskite, kodėl kompiuteriui svarbu, kad kiekvienas algoritmo žingsnis būtų vienareikšmis, ir kuo tai panašu į tikslią instrukciją komandos draugui.",
  },
  reflection_questions: [
    "Kaip jūsų komanda sekė kintamųjų reikšmes: mintyse, lentelėje ar kitaip? Kuris būdas patikimiausias ir kodėl?",
    "Kurioje vietoje lengviausia suklysti vykdant algoritmą ir kaip tokią klaidą pastebėti?",
    "Kuo algoritmo vykdymas ranka padeda suprasti, kaip dirba kompiuteris?",
    "Ką patartumėte komandai, kuri šią veiklą atliks rytoj?",
  ],
  sources: [
    "Informatikos bendroji programa (2022): 7-8 klasių mokymo turinys, sritis „Algoritmai ir programavimas“.",
    "Užduotis sukūrė KU STEAM CLASSROOM turinio autoriai. Ciklo užduotis remiasi žinoma „3n + 1“ skaičių seka (Kolaco hipotezė).",
  ],
  challenges: [
    {
      title: "Kas yra algoritmas?",
      description: "Kuris apibūdinimas geriausiai tinka algoritmui?",
      type: "multiple_choice",
      points: 100,
      correct_answer: "Baigtinė aiškių veiksmų seka uždaviniui išspręsti",
      hints: [
        "Pagalvokite apie receptą arba surinkimo instrukciją: kas juose svarbiausia?",
        "Algoritmas nėra įrenginys ir nėra kalba. Jį galima vykdyti ir be kompiuterio.",
      ],
      options: [
        "Kompiuterio dalis, atliekanti skaičiavimus",
        "Baigtinė aiškių veiksmų seka uždaviniui išspręsti",
        "Programavimo kalba, kuria rašomos programos",
        "Atsitiktinai parenkami veiksmai, kol pavyksta",
      ],
      explanation:
        "Algoritmas yra baigtinė aiškių, tiksliai nusakytų veiksmų seka, kurią atlikus išsprendžiamas uždavinys. Jį gali vykdyti ir žmogus, ir kompiuteris. Dažna klaida: algoritmą tapatinti su programavimo kalba, nors kalba yra tik priemonė algoritmui užrašyti.",
      difficulty: "easy",
      cognitive_level: "remember",
    },
    {
      title: "Roboto skaičiuotuvas",
      description:
        "Robotas vykdo algoritmą. 1 žingsnis: kintamajam x priskirk 3. 2 žingsnis: 4 kartus pakartok veiksmą „prie x pridėk 2“. 3 žingsnis: parodyk x. Kokį skaičių parodys robotas? Atsakymą įrašykite sveikuoju skaičiumi.",
      type: "number",
      points: 100,
      correct_answer: "11",
      hints: [
        "Vykdykite algoritmą patys: po kiekvieno veiksmo užsirašykite naują x reikšmę.",
        "Pasidarykite lentelę: kartojimo numeris ir x reikšmė po jo. Kartojimų turi būti lygiai tiek, kiek nurodyta.",
      ],
      options: null,
      explanation:
        "Pradžioje x = 3. Po keturių kartojimų x įgyja reikšmes 5, 7, 9, 11, todėl robotas parodys 11. Trumpiau: 3 + 4 · 2 = 11. Dažna klaida: pamiršti pradinę reikšmę ir gauti 8 arba pakartoti veiksmą tik 3 kartus ir gauti 9.",
      difficulty: "easy",
      cognitive_level: "understand",
    },
    {
      title: "Lempučių kodas",
      description:
        "Penkios lemputės iš eilės rodo dvejetainį skaičių: deganti lemputė reiškia 1, nedeganti reiškia 0. Lempučių vertės iš kairės į dešinę yra 16, 8, 4, 2, 1. Dabar lemputės rodo 10110. Koks tai skaičius dešimtainėje sistemoje? Atsakymą įrašykite sveikuoju skaičiumi.",
      type: "number",
      points: 150,
      correct_answer: "22",
      hints: [
        "Kiekviena lemputė turi savo vertę. Skaičiuojamos tik degančių lempučių vertės.",
        "Po skaitmenimis 1, 0, 1, 1, 0 parašykite vertes 16, 8, 4, 2, 1 ir pabraukite tas, virš kurių stovi vienetas.",
        "Pabrauktas vertes sudėkite.",
      ],
      options: null,
      explanation:
        "Dega lemputės, kurių vertės 16, 4 ir 2. Jų suma: 16 + 4 + 2 = 22. Dažna klaida: vertes priskirti iš kito galo (tada gaunama 13) arba įskaičiuoti ir nedegančias lemputes.",
      difficulty: "medium",
      cognitive_level: "apply",
    },
    {
      title: "Skaičius 13 dvejetainiu kodu",
      description: "Kaip skaičius 13 užrašomas dvejetainėje sistemoje?",
      type: "multiple_choice",
      points: 150,
      correct_answer: "1101",
      hints: [
        "Naudokite vertes 8, 4, 2, 1. Kurias iš jų reikia sudėti, kad gautumėte 13?",
        "Pradėkite nuo didžiausios vertės: jei ji telpa į likusį skaičių, rašykite vienetą ir ją atimkite, jei netelpa, rašykite nulį. Taip pereikite visas vertes iš kairės į dešinę.",
      ],
      options: ["1011", "1100", "1101", "1110"],
      explanation:
        "13 = 8 + 4 + 1, todėl ties vertėmis 8, 4, 2, 1 rašome 1, 1, 0, 1 ir gauname 1101. Patikrinimas: 8 + 4 + 0 + 1 = 13. Dažna klaida: skaitmenis užrašyti atvirkščia tvarka ir gauti 1011, o tai yra skaičius 11.",
      difficulty: "medium",
      cognitive_level: "apply",
    },
    {
      title: "Kiek kartų suksis ciklas?",
      description:
        "Algoritmas pradedamas nuo n = 6. Kol n nelygus 1, kartojamas vienas veiksmas: jei n lyginis, n padalijamas iš 2; jei n nelyginis, n padauginamas iš 3 ir prie sandaugos pridedamas 1. Kai n tampa lygus 1, algoritmas sustoja. Kiek kartų bus atliktas kartojamas veiksmas? Atsakymą įrašykite sveikuoju skaičiumi.",
      type: "number",
      points: 200,
      correct_answer: "8",
      hints: [
        "Vykdykite algoritmą ranka ir užrašykite visas n reikšmes iš eilės.",
        "Prieš kiekvieną veiksmą patikrinkite, ar n lyginis, ar nelyginis: nuo to priklauso, kurią šaką vykdyti.",
        "Skaičiuokite atliktus veiksmus (rodykles tarp reikšmių), o ne užrašytus skaičius.",
      ],
      options: null,
      explanation:
        "Reikšmių seka: 6, 3, 10, 5, 16, 8, 4, 2, 1. Tarp devynių reikšmių yra 8 perėjimai, todėl veiksmas atliekamas 8 kartus. Dažna klaida: suskaičiuoti užrašytus skaičius (9) vietoj atliktų veiksmų arba nelyginį skaičių padalyti iš 2.",
      difficulty: "hard",
      cognitive_level: "analyse",
    },
    {
      title: "Roboto šifras",
      description:
        "Robotas gauna dvejetainį skaičių 1100 ir vykdo algoritmą. 1 žingsnis: paversk skaičių dešimtainiu. 2 žingsnis: jei skaičius didesnis už 10, atimk 5, kitu atveju pridėk 5. 3 žingsnis: rezultatą padaugink iš 2. 4 žingsnis: rezultatą užrašyk dvejetainėje sistemoje. Ką užrašys robotas? Atsakymą įrašykite dvejetainiu skaičiumi: tik skaitmenys 0 ir 1, be tarpų.",
      type: "number",
      points: 250,
      correct_answer: "1110",
      hints: [
        "Vykdykite žingsnius iš eilės ir po kiekvieno užsirašykite tarpinį rezultatą.",
        "Pirmam žingsniui naudokite vertes 8, 4, 2, 1. Antrame žingsnyje atidžiai patikrinkite sąlygą: kurią šaką reikia vykdyti?",
        "Paskutiniame žingsnyje gautą dešimtainį skaičių išskaidykite į verčių 8, 4, 2, 1 sumą.",
      ],
      options: null,
      explanation:
        "1100 yra 8 + 4 = 12. Kadangi 12 didesnis už 10, atimame 5 ir gauname 7. Padauginę iš 2, gauname 14. 14 = 8 + 4 + 2, todėl robotas užrašys 1110. Dažna klaida: pasirinkti ne tą sąlygos šaką arba pamiršti paskutinį žingsnį ir atsakyti 14.",
      difficulty: "hard",
      cognitive_level: "analyse",
    },
  ],
}

export const MATEMATIKA_INFORMATIKA: StarterActivityInput[] = [
  fractionsAndPercentages,
  proportionsAndScale,
  pythagoreanTheorem,
  algorithmsAndBinary,
]
