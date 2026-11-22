import type { StarterActivityInput } from "./schema"

// Ready-made activities for primary education. Written for grades 3 to 4:
// pupils read the tasks themselves, so every text is at most three short
// sentences and every number is small and clean.
export const PRADINIS_UGDYMAS: StarterActivityInput[] = [
  {
    slug: "pradinis-metu-laikai-lietuvoje",
    title: "Metų laikai Lietuvoje: gamtos tyrėjų užduotys",
    description:
      "Komandos tyrinėja, kaip Lietuvoje keičiasi gamta: medžiai, gyvūnai ir dienos ilgumas. Skirta 3-4 klasių mokiniams, kurie jau skaito savarankiškai.",
    subject: "Pradinis ugdymas",
    grade_band: "1-4 kl.",
    duration_minutes: 25,
    curriculum:
      "Pradinio ugdymo bendrosios programos (2022), gamtos mokslai: metų laikų kaita ir jos požymiai, augalų ir gyvūnų prisitaikymas prie sezoninių pokyčių, gamtos stebėjimas. Sąsaja su matematika: skaičiavimas.",
    learning_goals: [
      "Įvardyti metų laikus ir kiekvieno jų požymius Lietuvos gamtoje.",
      "Paaiškinti, kaip gyvūnai prisitaiko prie žiemos.",
      "Pagal gamtos požymius nustatyti metų laiką ir palyginti dienos ilgumą skaičiais.",
    ],
    teacher_notes: {
      before:
        "Veikla skirta 3-4 klasei, kai mokiniai jau skaito sklandžiai. Suskirstykite mokinius į komandas po 2-3, kiekvienai komandai užtenka vieno telefono ar planšetės. Susitarkite, kas komandoje skaito užduotį garsiai ir kas įrašo atsakymą. Šiuos vaidmenis keiskite po kiekvienos užduoties. Priminkite, kad užuomina kainuoja taškų, bet ja naudotis nėra gėda.",
      during:
        "Vaikščiokite tarp komandų ir klausykite, kaip jos tariasi. Jei komanda užstrigo, neatsakykite už ją. Paprašykite dar kartą garsiai perskaityti užduotį ir paklauskite: „Ką jau žinote? Ko klausiama?“ Pasiūlykite atverti užuominą. Jei matote, kad daugumai trūksta laiko, galite jį pratęsti. Pagirkite komandas, kuriose kalba visi nariai.",
      after:
        "Susėskite ratu. Aptarkite ežio užduotį: daug vaikų mano, kad ežys kaupia maistą ar nešiojasi obuolius, o iš tiesų jis miega ir naudoja riebalų atsargas. Paklauskite, kokius metų laiko požymius mokiniai mato pro langą šiandien. Paprašykite kiekvienos komandos pasakyti vieną naują dalyką, kurį sužinojo. Pasidžiaukite ne tik taškais, bet ir tuo, kaip komandos tarėsi.",
    },
    reflection_questions: [
      "Kaip jautėtės dirbdami komandoje?",
      "Kas jums padėjo susitarti, kai nuomonės skyrėsi?",
      "Ką naujo sužinojote apie metų laikus?",
      "Kokį metų laiko požymį pastebėjote šiandien pakeliui į mokyklą?",
    ],
    sources: [
      "Pradinio ugdymo bendrosios programos (2022): gamtos mokslų ir matematikos programos 1-4 klasėms.",
      "Gamtos mokslų vadovėliai 3-4 klasei: temos apie metų laikus, gyvūnų žiemojimą ir paukščių sugrįžimą.",
      "Dienos ilgumas Lietuvoje per žiemos ir vasaros saulėgrįžas (apie 7 ir apie 17 valandų): astronominio kalendoriaus duomenys.",
    ],
    challenges: [
      {
        title: "Spalvoti lapai",
        description:
          "Medžių lapai pagelsta, parausta ir nukrinta ant žemės. Kuriuo metų laiku tai vyksta Lietuvoje?",
        type: "multiple_choice",
        points: 100,
        correct_answer: "Rudenį",
        hints: [
          "Prisiminkite, kada kieme grėbiame daug spalvotų lapų.",
          "Tuo metu prasideda mokslo metai ir renkame kaštonus.",
        ],
        options: ["Pavasarį", "Vasarą", "Rudenį", "Žiemą"],
        explanation:
          "Rudenį dienos trumpėja ir vėsta. Medžiai ruošiasi žiemai, todėl jų lapai pakeičia spalvą ir nukrinta.",
        difficulty: "easy",
        cognitive_level: "remember",
      },
      {
        title: "Metų laikų mėnesiai",
        description:
          "Metai turi 12 mėnesių ir 4 metų laikus. Visi metų laikai trunka vienodai. Kiek mėnesių trunka vienas metų laikas? Įrašykite tik skaičių.",
        type: "number",
        points: 100,
        correct_answer: "3",
        hints: [
          "Pabandykite išvardyti visus vasaros mėnesius ir juos suskaičiuoti.",
          "Visus metų mėnesius reikia padalyti į keturias lygias dalis.",
        ],
        options: null,
        explanation:
          "12 mėnesių padaliję į 4 lygias dalis gauname 3. Pavyzdžiui, vasaros mėnesiai yra birželis, liepa ir rugpjūtis.",
        difficulty: "easy",
        cognitive_level: "understand",
      },
      {
        title: "Kur dingo ežys?",
        description: "Atėjo žiema, ir ežio niekur nematyti. Ką ežys veikia žiemą?",
        type: "multiple_choice",
        points: 150,
        correct_answer: "Miega žiemos miegu",
        hints: [
          "Žiemą ežys neranda vabalų ir sliekų, kuriais minta.",
          "Rudenį ežys daug ėda ir susisuka šiltą guolį iš lapų.",
          "Pagalvokite, kaip gyvūnas gali ištverti kelis mėnesius be maisto.",
        ],
        options: [
          "Ieško maisto po sniegu",
          "Miega žiemos miegu",
          "Minta rudenį sukauptomis atsargomis",
          "Persikelia gyventi į šiltus kraštus",
        ],
        explanation:
          "Žiemą ežys neranda maisto, todėl įminga iki pavasario. Miegodamas jis naudoja riebalus, kuriuos sukaupė rudenį. Maisto atsargų ežys nekaupia.",
        difficulty: "medium",
        cognitive_level: "understand",
      },
      {
        title: "Gamtos dienoraštis",
        description:
          "Rasa užrašė gamtos dienoraštyje: „Tirpsta sniegas. Parskrido vieversys. Pražydo žibuoklės.“ Kurį mėnesį Rasa galėjo tai užrašyti?",
        type: "multiple_choice",
        points: 150,
        correct_answer: "Kovą",
        hints: [
          "Pagalvokite, kuriuo metų laiku tirpsta sniegas.",
          "Vieversys yra vienas pirmųjų paukščių, sugrįžtančių į Lietuvą.",
          "Išrinkite mėnesį, kuris priklauso pavasariui.",
        ],
        options: ["Gruodį", "Kovą", "Liepą", "Spalį"],
        explanation:
          "Visi trys požymiai rodo pavasario pradžią. Iš šių mėnesių tik kovas yra pavasario mėnuo. Liepa yra vasaros, spalis rudens, o gruodis žiemos mėnuo.",
        difficulty: "medium",
        cognitive_level: "analyse",
      },
      {
        title: "Ilga ir trumpa diena",
        description:
          "Trumpiausią žiemos dieną Lietuvoje šviesu būna apie 7 valandas. Ilgiausią vasaros dieną šviesu būna apie 17 valandų. Keliomis valandomis vasaros diena ilgesnė? Įrašykite tik skaičių.",
        type: "number",
        points: 200,
        correct_answer: "10",
        hints: [
          "Užduotyje yra du skaičiai. Raskite juos ir užsirašykite.",
          "Žodis „ilgesnė“ reiškia, kad ieškome skirtumo.",
          "Iš didesnio skaičiaus atimkite mažesnį.",
        ],
        options: null,
        explanation:
          "17 − 7 = 10. Vasarą Saulė danguje būna daug ilgiau, todėl šviesu net 10 valandų ilgiau nei žiemą.",
        difficulty: "hard",
        cognitive_level: "apply",
      },
    ],
  },
  {
    slug: "pradinis-pinigai-ir-laikas",
    title: "Skaičiuojame kasdien: pinigai ir laikas",
    description:
      "Komandos sprendžia kasdienius uždavinius apie eurus, centus, laiką ir knygas bibliotekoje. Skirta 3-4 klasių mokiniams, kurie jau skaito savarankiškai.",
    subject: "Pradinis ugdymas",
    grade_band: "1-4 kl.",
    duration_minutes: 25,
    curriculum:
      "Pradinio ugdymo bendrosios programos (2022), matematika: skaičiai ir skaičiavimai (sudėtis ir atimtis iki 1000, daugyba), matavimai (laikas, pinigai: eurai ir centai), žodinių uždavinių ir problemų sprendimas.",
    learning_goals: [
      "Paversti eurus centais ir apskaičiuoti grąžą.",
      "Apskaičiuoti, kada baigiasi veikla, kai žinoma jos pradžia ir trukmė.",
      "Išspręsti dviejų veiksmų žodinį uždavinį su skaičiais iki 1000.",
    ],
    teacher_notes: {
      before:
        "Veikla skirta 3-4 klasei, kai mokiniai jau skaito sklandžiai ir moka daugybos lentelę. Suskirstykite mokinius į komandas po 2-3, kiekvienai komandai užtenka vieno telefono ar planšetės. Duokite kiekvienai komandai lapą ir pieštuką skaičiavimams. Susitarkite, kas skaito užduotį garsiai, kas skaičiuoja ir kas įrašo atsakymą. Vaidmenis keiskite po kiekvienos užduoties.",
      during:
        "Stebėkite, ar komandos skaičiuoja lape, ar spėlioja. Jei komanda užstrigo, neatsakykite už ją. Paklauskite: „Ką žinote? Ko reikia sužinoti? Koks būtų pirmas žingsnis?“ Pasiūlykite nupiešti monetas ar laikrodį arba atverti užuominą. Priminkite, kad atsakymą verta patikrinti dar kartą. Jei daugumai trūksta laiko, galite jį pratęsti.",
      after:
        "Susėskite ratu ir paprašykite vienos komandos parodyti, kaip ji sprendė paskutinį uždavinį. Aptarkite dažnas klaidas: laikas 15:70 neįmanomas, nes valanda turi 60 minučių. Skaičiuojant grąžą patogu eurus pirmiausia paversti centais. Paklauskite, kur mokiniai patys skaičiuoja pinigus ar laiką. Pagirkite komandas, kurios tikrino atsakymus ir klausėsi viena kitos.",
    },
    reflection_questions: [
      "Kaip jautėtės, kai pavyko išspręsti sunkų uždavinį?",
      "Kaip pasidalijote darbus komandoje?",
      "Kuris uždavinys buvo sunkiausias ir kas padėjo jį įveikti?",
      "Kur šią savaitę jums pravers mokėjimas skaičiuoti pinigus ar laiką?",
    ],
    sources: [
      "Pradinio ugdymo bendrosios programos (2022): matematikos programa 1-4 klasėms.",
      "Matematikos vadovėliai 3-4 klasei: temos apie pinigus, laiko matavimą, daugybą ir veiksmus iki 1000.",
    ],
    challenges: [
      {
        title: "Eurai ir centai",
        description: "Kiek centų sudaro vieną eurą?",
        type: "multiple_choice",
        points: 100,
        correct_answer: "100 centų",
        hints: [
          "Prisiminkite monetas, kurias matote parduotuvėje.",
          "Dvi 50 centų monetos kartu vertos vieno euro.",
        ],
        options: ["10 centų", "50 centų", "100 centų", "1000 centų"],
        explanation:
          "Vienas euras yra 100 centų. Todėl dvi monetos po 50 centų yra tiek pat, kiek viena 1 euro moneta.",
        difficulty: "easy",
        cognitive_level: "remember",
      },
      {
        title: "Bilietai į muziejų",
        description:
          "Vienas bilietas į muziejų kainuoja 6 eurus. Kiek eurų kainuoja 4 tokie bilietai? Įrašykite tik skaičių.",
        type: "number",
        points: 100,
        correct_answer: "24",
        hints: [
          "Visi bilietai kainuoja vienodai.",
          "Galite sudėti vieno bilieto kainą keturis kartus.",
          "Greičiau bus, jei prisiminsite daugybos lentelę.",
        ],
        options: null,
        explanation:
          "6 × 4 = 24. Keturi bilietai po 6 eurus kainuoja 24 eurus. Tą patį gautume sudėję 6 + 6 + 6 + 6.",
        difficulty: "easy",
        cognitive_level: "apply",
      },
      {
        title: "Treniruotės pabaiga",
        description: "Treniruotė prasidėjo 15:40 ir truko 30 minučių. Kada ji baigėsi?",
        type: "multiple_choice",
        points: 150,
        correct_answer: "16:10",
        hints: [
          "Prisiminkite, kiek minučių turi viena valanda.",
          "Suskaičiuokite, kiek minučių trūksta iki kitos pilnos valandos.",
          "Tada pridėkite minutes, kurios dar liko iš treniruotės.",
        ],
        options: ["15:10", "15:70", "16:00", "16:10"],
        explanation:
          "Nuo 15:40 iki 16:00 praeina 20 minučių. Lieka dar 10 minučių, todėl treniruotė baigėsi 16:10. Laiko 15:70 nebūna, nes valanda turi 60 minučių.",
        difficulty: "medium",
        cognitive_level: "apply",
      },
      {
        title: "Grąža",
        description:
          "Tomas turi 5 eurus. Jis perka pieštukų rinkinį už 3 eurus 20 centų. Kiek centų grąžos gaus Tomas? Įrašykite tik skaičių.",
        type: "number",
        points: 150,
        correct_answer: "180",
        hints: [
          "Atsakymo prašoma centais, todėl pirmiausia eurus paverskite centais.",
          "Vienas euras turi šimtą centų.",
          "Iš Tomo turimų centų atimkite rinkinio kainą centais.",
        ],
        options: null,
        explanation:
          "5 eurai yra 500 centų, o rinkinys kainuoja 320 centų. 500 − 320 = 180. Tomas gaus 180 centų, tai yra 1 eurą 80 centų.",
        difficulty: "medium",
        cognitive_level: "apply",
      },
      {
        title: "Knygos bibliotekoje",
        description:
          "Mokyklos bibliotekoje yra 460 pasakų knygų ir 380 knygų apie gamtą. Šiandien mokiniai pasiskolino 40 knygų. Kiek knygų liko bibliotekoje? Įrašykite tik skaičių.",
        type: "number",
        points: 200,
        correct_answer: "800",
        hints: [
          "Šiam uždaviniui reikia dviejų veiksmų.",
          "Pirmiausia sužinokite, kiek knygų bibliotekoje buvo iš viso.",
          "Tada atimkite knygas, kurias mokiniai pasiskolino.",
        ],
        options: null,
        explanation:
          "Iš viso knygų buvo 460 + 380 = 840. Mokiniai pasiskolino 40, todėl liko 840 − 40 = 800 knygų.",
        difficulty: "hard",
        cognitive_level: "analyse",
      },
    ],
  },
  {
    slug: "pradinis-vanduo-aplink-mus",
    title: "Vanduo aplink mus: STEAM tyrimas",
    description:
      "Komandos tyrinėja vandenį kaip gamtininkai, kalbininkai ir matematikai: kur jis dingsta, kaip jį matuoti ir taupyti. Skirta 3-4 klasių mokiniams.",
    subject: "Pradinis ugdymas",
    grade_band: "1-4 kl.",
    duration_minutes: 25,
    curriculum:
      "Pradinio ugdymo bendrosios programos (2022), integruota veikla. Gamtos mokslai: vandens būsenos, garavimas, tausus vandens naudojimas. Matematika: daugyba, talpos matavimas. Lietuvių kalba: giminiški žodžiai.",
    learning_goals: [
      "Paaiškinti, kad lietus, sniegas, rūkas ir ledas yra vanduo, ir kur dingsta išgaravęs vanduo.",
      "Atpažinti žodžiui „vanduo“ giminišką žodį.",
      "Apskaičiuoti talpą ir sutaupyto vandens kiekį, taikant daugybą.",
    ],
    teacher_notes: {
      before:
        "Veikla skirta 3-4 klasei, kai mokiniai jau skaito sklandžiai. Suskirstykite mokinius į komandas po 2-3, kiekvienai komandai užtenka vieno telefono ar planšetės. Duokite lapą skaičiavimams. Susitarkite, kas skaito užduotį garsiai ir kas įrašo atsakymą, vaidmenis keiskite. Jei galite, ant stalo pastatykite stiklinę ir litro ąsotį su vandeniu: tai padės ketvirtoje užduotyje.",
      during:
        "Klausykite, kaip komandos tariasi, ir pagirkite tas, kuriose kalba visi. Jei komanda užstrigo, neatsakykite už ją. Paprašykite dar kartą garsiai perskaityti užduotį ir paklauskite: „Ką jau žinote? Ko klausiama?“ Pasiūlykite nupiešti stiklines ar dienas arba atverti užuominą. Jei daugumai trūksta laiko, galite jį pratęsti.",
      after:
        "Susėskite ratu. Aptarkite balos užduotį: vanduo nedingsta, jis išgaruoja ir pakyla į orą, o vėliau grįžta lietumi. Jei turite ąsotį, kartu perpilkite vandenį stiklinėmis ir patikrinkite atsakymą. Paklauskite, kaip mokiniai galėtų taupyti vandenį namuose ir mokykloje. Paprašykite kiekvienos komandos pasakyti vieną dalyką, kurį sužinojo, ir vieną, už kurį dėkoja komandos draugams.",
    },
    reflection_questions: [
      "Kaip jautėtės dirbdami kartu?",
      "Kuo šiandien padėjote savo komandai?",
      "Ką naujo sužinojote apie vandenį?",
      "Kaip galėtumėte taupyti vandenį jau šiandien?",
    ],
    sources: [
      "Pradinio ugdymo bendrosios programos (2022): gamtos mokslų, matematikos ir lietuvių kalbos ir literatūros programos 1-4 klasėms.",
      "Gamtos mokslų vadovėliai 3-4 klasei: temos apie vandens būsenas, vandens apytakos ratą ir vandens taupymą.",
      "Lietuvių kalbos vadovėliai 3-4 klasei: tema apie giminiškus žodžius ir žodžio šaknį.",
      "Vandens sąnaudos iš atsukto čiaupo (apie 6 litrus per minutę): vandens tiekimo įmonių patarimai gyventojams.",
    ],
    challenges: [
      {
        title: "Ta pati medžiaga",
        description:
          "Lietus, sniegas, rūkas ir ledas atrodo skirtingai. Tačiau visi jie yra ta pati medžiaga. Parašykite jos pavadinimą vienu žodžiu.",
        type: "text",
        points: 100,
        correct_answer: "vanduo",
        accepted_answers: ["vandens", "vandenį", "vandenys", "iš vandens"],
        hints: [
          "Pagalvokite, kas lieka delne, kai ištirpsta snaigė.",
          "Šią medžiagą geriame kasdien ir ja prausiamės.",
        ],
        options: null,
        explanation:
          "Lietus yra skysto vandens lašai, sniegas ir ledas yra sušalęs vanduo, o rūkas yra labai smulkūs vandens lašeliai ore. Vanduo gali atrodyti labai įvairiai.",
        difficulty: "easy",
        cognitive_level: "remember",
      },
      {
        title: "Dingusi bala",
        description:
          "Po lietaus asfaltuotame kieme liko bala. Visą dieną švietė saulė, ir vakare balos nebebuvo. Kur dingo vanduo?",
        type: "multiple_choice",
        points: 100,
        correct_answer: "Išgaravo į orą",
        hints: [
          "Pagalvokite, kas nutinka šlapiems drabužiams, kai jie džiūsta saulėje.",
          "Saulės šiluma paverčia vandenį nematomais garais.",
          "Garai yra lengvi, todėl kyla aukštyn.",
        ],
        options: [
          "Virto ledu",
          "Jį išgėrė medžiai",
          "Išgaravo į orą",
          "Nutekėjo į jūrą",
        ],
        explanation:
          "Saulė sušildė balą, ir vanduo virto nematomais garais. Garai pakilo į orą. Vėliau iš jų susidaro debesys, ir vanduo grįžta lietumi.",
        difficulty: "easy",
        cognitive_level: "understand",
      },
      {
        title: "Žodžių giminė",
        description: "Kuris žodis yra giminiškas žodžiui „vanduo“?",
        type: "multiple_choice",
        points: 150,
        correct_answer: "Vandenynas",
        hints: [
          "Giminiški žodžiai turi tą pačią šaknį ir panašią reikšmę.",
          "Žodžio „vanduo“ šaknis yra „vand“.",
          "Patikrinkite du dalykus: ar sutampa žodžio pradžia ir ar reikšmė susijusi.",
        ],
        options: ["Upė", "Valtis", "Vanagas", "Vandenynas"],
        explanation:
          "Žodžiai „vanduo“ ir „vandenynas“ turi tą pačią šaknį „vand“, o jų reikšmės susijusios. Upė ir valtis susijusios su vandeniu, bet jų šaknys kitos. Vanagas tik prasideda panašiai.",
        difficulty: "medium",
        cognitive_level: "understand",
      },
      {
        title: "Stiklinės ir ąsotis",
        description:
          "Į vieną stiklinę telpa 200 mililitrų vandens. Į ąsotį telpa 1 litras. Kiek pilnų stiklinių vandens reikia, kad pripildytumėte ąsotį? Įrašykite tik skaičių.",
        type: "number",
        points: 150,
        correct_answer: "5",
        hints: [
          "Pirmiausia litrą paverskite mililitrais.",
          "Vienas litras yra 1000 mililitrų.",
          "Skaičiuokite po vieną stiklinę: 200, 400 ir taip toliau, kol pasieksite litrą.",
        ],
        options: null,
        explanation:
          "1 litras yra 1000 mililitrų. 200 + 200 + 200 + 200 + 200 = 1000, todėl reikia 5 stiklinių.",
        difficulty: "medium",
        cognitive_level: "apply",
      },
      {
        title: "Taupome vandenį",
        description:
          "Valydamasi dantis Miglė užsuka čiaupą ir kaskart sutaupo 6 litrus vandens. Dantis ji valosi 2 kartus per dieną. Kiek litrų vandens Miglė sutaupo per 5 dienas? Įrašykite tik skaičių.",
        type: "number",
        points: 200,
        correct_answer: "60",
        hints: [
          "Šiam uždaviniui reikia dviejų veiksmų.",
          "Pirmiausia sužinokite, kiek litrų Miglė sutaupo per vieną dieną.",
          "Tada vienos dienos kiekį padauginkite iš dienų skaičiaus.",
        ],
        options: null,
        explanation:
          "Per dieną Miglė sutaupo 6 × 2 = 12 litrų. Per 5 dienas: 12 × 5 = 60 litrų. Mažas įprotis sutaupo labai daug vandens.",
        difficulty: "hard",
        cognitive_level: "analyse",
      },
    ],
  },
]
