import type { StarterActivityInput } from "./schema"

// Ready-made activities for Lithuanian language, geography, history and
// civics. Facts are limited to what the Constitution, the two independence
// acts and school textbooks state plainly; see `sources` in each activity.

export const KALBOS_SOCIALINIAI: StarterActivityInput[] = [
  {
    slug: "lietuviu-kalbos-ir-sakinio-dalys-5-6",
    title: "Žodis sakinyje: kalbos dalys ir sakinio dalys",
    description:
      "Komandos nagrinėja trumpus sakinius: atpažįsta kalbos dalis, randa veiksnį ir papildinį, aiškinasi, ar sakinio dalis priklauso nuo žodžių tvarkos.",
    subject: "Lietuvių kalba ir literatūra",
    grade_band: "5-6 kl.",
    duration_minutes: 25,
    curriculum:
      "Lietuvių kalba ir literatūra, 5-6 klasės, kalbos pažinimas: kalbos dalys (daiktavardis, būdvardis, veiksmažodis, prieveiksmis) ir sakinio dalys (veiksnys, tarinys, papildinys), jų atpažinimas sakinyje.",
    learning_goals: [
      "Atpažinti sakinyje daiktavardį, veiksmažodį ir prieveiksmį, pagrįsti pasirinkimą klausimu.",
      "Rasti sakinio veiksnį ir papildinį, keliant klausimus nuo tarinio.",
      "Paaiškinti, kodėl sakinio dalis lemia žodžio forma ir klausimas, o ne vieta sakinyje.",
    ],
    teacher_notes: {
      before:
        "Suskirstykite klasę į komandas po 2-4 mokinius, kiekvienai komandai reikia vieno telefono ar planšetės. Lentoje palikite priminimą: kalbos dalių ir sakinio dalių klausimai (kas? ką veikia? koks? kaip? ką? kam?). Susitarkite, kad atsakymą komanda įrašo tik tada, kai visi nariai sutinka. Priminkite, kad žodį reikia rašyti taip, kaip jis parašytas sakinyje.",
      during:
        "Stebėkite, ar mokiniai kelia klausimus, ar spėlioja. Jei komanda stringa, paprašykite pirmiausia rasti tarinį ir nuo jo kelti klausimą. Atkreipkite dėmesį, kurios komandos painioja kalbos dalį su sakinio dalimi: tai aptarsite pabaigoje. Užuominos mažina taškus, todėl paskatinkite pirmiausia pasitarti.",
      after:
        "Aptarkite tris dažniausias painiavas. Pirma: prieveiksmis „greitai“ painiojamas su būdvardžiu, nes padarytas iš žodžio „greitas“. Paprašykite iškelti klausimą: kaip skrenda? Antra: veiksniu palaikomas pirmasis sakinio daiktavardis. Lentoje užrašykite sakinį apie malūną ir kartu raskite tarinį, tada klauskite: kas renkasi? Trečia: manoma, kad pakeitus žodžių tvarką pasikeičia sakinio dalys. Palyginkite abu sakinius apie Joną ir parodykite, kad linksnis lieka tas pats.",
    },
    reflection_questions: [
      "Kuri užduotis sukėlė daugiausia ginčų jūsų komandoje ir kaip susitarėte dėl atsakymo?",
      "Kaip atskiriate kalbos dalį nuo sakinio dalies? Paaiškinkite savo žodžiais.",
      "Kokį klausimą kėlėte dažniausiai ir kodėl jis padėjo?",
    ],
    sources: [
      "Lietuvių kalbos instituto „Dabartinės lietuvių kalbos gramatika“: morfologijos ir sintaksės skyriai.",
      "Lietuvių kalbos instituto „Dabartinės lietuvių kalbos žodynas“: žodžių kalbos dalies nuorodos.",
      "5-6 klasės lietuvių kalbos vadovėlių temos „Kalbos dalys“ ir „Sakinio dalys“.",
    ],
    challenges: [
      {
        title: "Kas ką veikia?",
        description:
          "Perskaitykite sakinį: „Maža mergaitė atidžiai skaito knygą.“ Kuris žodis yra veiksmažodis? Įrašykite vieną žodį taip, kaip jis parašytas sakinyje.",
        type: "text",
        points: 100,
        correct_answer: "skaito",
        hints: [
          "Veiksmažodis reiškia veiksmą.",
          "Iškelkite klausimą: ką veikia mergaitė?",
        ],
        options: null,
        explanation:
          "Žodis „skaito“ reiškia veiksmą ir atsako į klausimą „ką veikia?“, todėl tai veiksmažodis. Žodis „atidžiai“ nusako, kaip skaitoma, bet pats veiksmo nereiškia.",
        difficulty: "easy",
        cognitive_level: "remember",
      },
      {
        title: "Suskaičiuokite daiktavardžius",
        description:
          "Perskaitykite sakinį: „Senelis su anūke sode skina raudonus obuolius ir geltonas kriaušes.“ Kiek daiktavardžių yra šiame sakinyje? Įrašykite skaičių.",
        type: "number",
        points: 100,
        correct_answer: "5",
        hints: [
          "Daiktavardis įvardija asmenį, daiktą ar vietą ir atsako į klausimą „kas?“.",
          "Žodžiai „raudonus“ ir „geltonas“ nusako ypatybę, todėl jie nėra daiktavardžiai.",
          "Kiekvieną žodį pasakykite vardininko linksniu ir patikrinkite, ar jis atsako į klausimą „kas tai?“.",
        ],
        options: null,
        explanation:
          "Daiktavardžiai yra penki: „senelis“, „anūke“, „sode“, „obuolius“, „kriaušes“. Žodžiai „raudonus“ ir „geltonas“ yra būdvardžiai, „skina“ yra veiksmažodis. Daiktavardis lieka daiktavardžiu, kad ir kokiu linksniu būtų pavartotas.",
        difficulty: "easy",
        cognitive_level: "understand",
      },
      {
        title: "Kaip skrenda kregždės?",
        description:
          "Perskaitykite sakinį: „Kregždės greitai skrenda.“ Kuri kalbos dalis yra žodis „greitai“?",
        type: "multiple_choice",
        points: 150,
        correct_answer: "Prieveiksmis",
        hints: [
          "Pagalvokite, į kokį klausimą atsako šis žodis.",
          "Šis žodis susijęs su veiksmažodžiu „skrenda“, o ne su daiktavardžiu „kregždės“.",
          "Pabandykite žodį išlinksniuoti. Ar pavyksta?",
        ],
        options: ["Prieveiksmis", "Būdvardis", "Veiksmažodis", "Daiktavardis"],
        explanation:
          "Žodis „greitai“ atsako į klausimą „kaip?“ ir nusako veiksmo ypatybę, todėl tai prieveiksmis. Jis padarytas iš būdvardžio „greitas“, bet būdvardis nusako daikto ypatybę ir yra linksniuojamas, o prieveiksmis nekaitomas.",
        difficulty: "medium",
        cognitive_level: "understand",
      },
      {
        title: "Raskite veiksnį",
        description:
          "Perskaitykite sakinį: „Prie seno malūno vakarais renkasi kaimo vaikai.“ Kuris žodis yra veiksnys? Įrašykite vieną žodį taip, kaip jis parašytas sakinyje.",
        type: "text",
        points: 150,
        correct_answer: "vaikai",
        hints: [
          "Veiksnys nebūtinai stovi sakinio pradžioje.",
          "Pirmiausia raskite tarinį: kuris žodis reiškia veiksmą?",
          "Nuo tarinio iškelkite klausimą „kas?“. Veiksnys yra vardininko linksnio.",
        ],
        options: null,
        explanation:
          "Tarinys yra „renkasi“. Į klausimą „kas renkasi?“ atsako žodis „vaikai“, jis yra vardininko linksnio, todėl tai veiksnys. Žodis „malūno“ yra kilmininko linksnio ir nurodo vietą, o žodis „kaimo“ tik patikslina, kokie vaikai.",
        difficulty: "medium",
        cognitive_level: "apply",
      },
      {
        title: "Ką seka močiutė?",
        description:
          "Perskaitykite sakinį: „Močiutė anūkams dažnai seka pasakas.“ Kuris žodis yra papildinys, atsakantis į klausimą „ką?“? Įrašykite vieną žodį taip, kaip jis parašytas sakinyje.",
        type: "text",
        points: 200,
        correct_answer: "pasakas",
        hints: [
          "Papildinys papildo tarinį ir atsako į linksnių klausimus, išskyrus vardininko.",
          "Šiame sakinyje papildiniai yra du. Jie atsako į skirtingus klausimus.",
          "Raskite tarinį ir nuo jo iškelkite klausimą „ką?“. Ieškomas žodis yra galininko linksnio.",
        ],
        options: null,
        explanation:
          "Tarinys yra „seka“. Į klausimą „ką seka?“ atsako žodis „pasakas“, jis yra galininko linksnio. Žodis „anūkams“ taip pat yra papildinys, bet atsako į klausimą „kam?“. Žodis „dažnai“ atsako į klausimą „kaip dažnai?“ ir yra aplinkybė.",
        difficulty: "hard",
        cognitive_level: "apply",
      },
      {
        title: "Du sakiniai, tie patys žodžiai",
        description:
          "Palyginkite du sakinius. Pirmas: „Jonas piešia paveikslą.“ Antras: „Paveikslą piešia Jonas.“ Kuris teiginys apie šiuos sakinius yra teisingas?",
        type: "multiple_choice",
        points: 200,
        correct_answer: "Abiejuose sakiniuose veiksnys yra „Jonas“.",
        hints: [
          "Pagalvokite, ar pasikeitė sakinio prasmė, kai žodžiai sukeisti vietomis.",
          "Palyginkite žodžių linksnius pirmame ir antrame sakinyje.",
          "Abiejuose sakiniuose nuo tarinio „piešia“ iškelkite klausimą „kas?“.",
        ],
        options: [
          "Abiejuose sakiniuose veiksnys yra „Jonas“.",
          "Pirmame sakinyje veiksnys yra „Jonas“, antrame „paveikslą“.",
          "Abiejuose sakiniuose veiksnys yra „paveikslą“.",
          "Antrame sakinyje veiksnio nėra.",
        ],
        explanation:
          "Abiejuose sakiniuose į klausimą „kas piešia?“ atsako žodis „Jonas“, jis yra vardininko linksnio. Žodis „paveikslą“ abu kartus yra galininko linksnio ir atsako į klausimą „ką?“, taigi yra papildinys. Lietuvių kalboje sakinio dalį rodo žodžio forma ir klausimas, o ne vieta sakinyje.",
        difficulty: "hard",
        cognitive_level: "analyse",
      },
    ],
  },
  {
    slug: "geografija-lietuva-zemelapyje-7-8",
    title: "Lietuva žemėlapyje: pajūris, regionai ir mastelis",
    description:
      "Komandos keliauja po Lietuvos žemėlapį: atpažįsta pajūrio objektus ir etnografinį regioną, nustato kryptį, skaičiuoja atstumą pagal mastelį ir lygina du mastelius.",
    subject: "Geografija",
    grade_band: "7-8 kl.",
    duration_minutes: 30,
    curriculum:
      "Geografija, 7-8 klasės: orientavimasis žemėlapyje (pasaulio kryptys, mastelis, atstumo skaičiavimas) ir Lietuvos geografijos pažinimas (pajūris, Kuršių nerija, etnografiniai regionai).",
    learning_goals: [
      "Apskaičiuoti tikrąjį atstumą pagal skaitmeninį žemėlapio mastelį.",
      "Nustatyti tarpinę pasaulio kryptį tarp dviejų Lietuvos miestų.",
      "Atpažinti Lietuvos pajūrio objektus ir etnografinį regioną pagal aprašymą.",
    ],
    teacher_notes: {
      before:
        "Suskirstykite klasę į komandas po 2-4 mokinius. Kiekvienai komandai duokite Lietuvos žemėlapį arba atlasą, lapą skaičiavimams ir vieną telefoną ar planšetę. Skaičiuotuvo nereikia. Priminkite, kad 1 km yra 100 000 cm. Susitarkite, kad atsakymą komanda įrašo tik pasitarusi.",
      during:
        "Stebėkite, ar komandos naudojasi žemėlapiu, ar atsako iš atminties. Mastelio užduotyje žiūrėkite, ar mokiniai užsirašo matavimo vienetus: dažniausia klaida yra pamiršti centimetrus paversti kilometrais. Jei komanda stringa prie krypties, paprašykite žemėlapyje pirštu parodyti abu miestus.",
      after:
        "Aptarkite dvi dažniausias painiavas. Pirma: manoma, kad mastelis 1 : 100 000 yra stambesnis už 1 : 25 000, nes skaičius didesnis. Lentoje apskaičiuokite, kiek centimetrų abiejuose žemėlapiuose užimtų 1 km, ir palyginkite. Antra: Alytus painiojamas su Marijampole. Žemėlapyje parodykite Dzūkiją ir Suvalkiją, paprašykite mokinių pasakyti, kuri upė teka per kiekvieną miestą. Paklauskite, kaip komandos nustatė kryptį iš Vilniaus į Klaipėdą, ir palyginkite būdus.",
    },
    reflection_questions: [
      "Kurioje užduotyje žemėlapis padėjo labiausiai ir kaip juo naudojotės?",
      "Kaip savo žodžiais paaiškintumėte draugui, ką reiškia mastelis 1 : 50 000?",
      "Kur jūsų komandoje nuomonės išsiskyrė ir kas padėjo apsispręsti?",
      "Kada gyvenime jums praverstų mokėjimas apskaičiuoti atstumą pagal žemėlapį?",
    ],
    sources: [
      "Mokyklinis geografijos atlasas: Lietuvos fizinis ir administracinis žemėlapiai.",
      "Etninės kultūros globos taryba: Lietuvos etnografinių regionų žemėlapis.",
      "UNESCO pasaulio paveldo sąrašas ir Kuršių nerijos nacionalinio parko direkcijos informacija apie Kuršių neriją.",
      "7-8 klasės geografijos vadovėlių temos „Žemėlapis ir mastelis“ ir „Lietuvos geografija“.",
    ],
    challenges: [
      {
        title: "Lietuvos pajūris",
        description:
          "Klaipėda, Palanga ir Šventoji yra Lietuvos pajūrio vietovės. Prie kurios jūros jos įsikūrusios? Įrašykite jūros pavadinimą.",
        type: "text",
        points: 100,
        correct_answer: "Baltijos jūra",
        accepted_answers: ["Baltijos", "Baltija", "Baltijos jūros", "prie Baltijos jūros"],
        hints: [
          "Ta pati jūra skalauja Latvijos, Estijos, Lenkijos ir Švedijos krantus.",
          "Lietuva, Latvija ir Estija dažnai vadinamos šios jūros vardu.",
        ],
        options: null,
        explanation:
          "Lietuvos pajūris yra prie Baltijos jūros. Ji skalauja vakarinį šalies pakraštį. Kuršių marios nėra jūra: tai atskira lagūna, kurią nuo jūros skiria Kuršių nerija.",
        difficulty: "easy",
        cognitive_level: "remember",
      },
      {
        title: "Atpažinkite vietą",
        description:
          "Perskaitykite aprašymą: „Tai siauras ir ilgas smėlio pusiasalis. Vienoje jo pusėje ošia jūra, kitoje tyvuliuoja marios. Čia stūkso aukštos kopos, o visa vietovė įrašyta į UNESCO pasaulio paveldo sąrašą.“ Kaip vadinamas šis pusiasalis? Įrašykite pavadinimą.",
        type: "text",
        points: 100,
        correct_answer: "Kuršių nerija",
        accepted_answers: ["Kuršių nerijos", "Kuršių nerijoje", "nerija"],
        hints: [
          "Ieškokite Lietuvos žemėlapio vakaruose, prie pat jūros.",
          "Į šį pusiasalį iš Klaipėdos keliamasi keltu. Jame yra Nida ir Juodkrantė.",
        ],
        options: null,
        explanation:
          "Aprašyta Kuršių nerija: siauras smėlio pusiasalis tarp Baltijos jūros ir Kuršių marių. Ji garsėja kopomis ir yra įrašyta į UNESCO pasaulio paveldo sąrašą. Nepainiokite: Neringa yra savivaldybės pavadinimas, o pusiasalis vadinamas Kuršių nerija.",
        difficulty: "easy",
        cognitive_level: "understand",
      },
      {
        title: "Dzūkijos miestas",
        description:
          "Lietuvoje skiriami penki etnografiniai regionai: Aukštaitija, Žemaitija, Dzūkija, Suvalkija ir Mažoji Lietuva. Kuris iš šių miestų yra Dzūkijoje?",
        type: "multiple_choice",
        points: 150,
        correct_answer: "Alytus",
        hints: [
          "Dzūkija yra Lietuvos pietuose. Ji garsėja pušynais ir smėlingomis dirvomis.",
          "Telšiai yra Žemaitijos miestas.",
        ],
        options: ["Alytus", "Marijampolė", "Telšiai", "Utena"],
        explanation:
          "Alytus yra Lietuvos pietuose, prie Nemuno, ir dažnai vadinamas Dzūkijos sostine. Marijampolė dažnai painiojama su Alytumi, bet ji yra Suvalkijos miestas. Telšiai yra Žemaitijoje, Utena yra Aukštaitijoje.",
        difficulty: "medium",
        cognitive_level: "understand",
      },
      {
        title: "Kelionė prie jūros",
        description:
          "Klasė iš Vilniaus vyksta į ekskursiją prie jūros, į Klaipėdą. Pasižiūrėkite į Lietuvos žemėlapį. Kuria pasaulio kryptimi nuo Vilniaus yra Klaipėda?",
        type: "multiple_choice",
        points: 150,
        correct_answer: "Į šiaurės vakarus",
        hints: [
          "Prisiminkite, kurioje žemėlapio pusėje yra rytai, o kurioje vakarai.",
          "Klaipėda yra šiek tiek šiauriau už Vilnių.",
          "Nustatykite dvi pagrindines kryptis atskirai, tada sujunkite jas į vieną tarpinę kryptį.",
        ],
        options: ["Į šiaurės vakarus", "Į šiaurės rytus", "Į pietvakarius", "Į pietryčius"],
        explanation:
          "Vilnius yra Lietuvos pietryčiuose, o Klaipėda vakaruose, prie jūros, ir kiek šiauriau. Todėl nuo Vilniaus Klaipėda yra šiaurės vakarų kryptimi. Žemėlapyje šiaurė yra viršuje, vakarai kairėje.",
        difficulty: "medium",
        cognitive_level: "apply",
      },
      {
        title: "Atstumas tarp piliakalnių",
        description:
          "Žemėlapio mastelis yra 1 : 50 000. Atstumas tarp dviejų piliakalnių šiame žemėlapyje lygus 6 cm. Koks tikrasis atstumas tarp piliakalnių? Atsakymą įrašykite kilometrais, tik skaičių.",
        type: "number",
        points: 200,
        correct_answer: "3",
        hints: [
          "Mastelis rodo, kad 1 cm žemėlapyje atitinka 50 000 cm vietovėje.",
          "50 000 cm yra 500 m, arba 0,5 km.",
          "Žemėlapyje išmatuotą atstumą padauginkite iš to, kiek kilometrų atitinka 1 cm.",
        ],
        options: null,
        explanation:
          "Mastelis 1 : 50 000 reiškia, kad 1 cm žemėlapyje atitinka 50 000 cm, tai yra 0,5 km, vietovėje. 6 cm × 0,5 km = 3 km. Dažna klaida: padauginus gauti 300 000 ir pamiršti, kad tai centimetrai, kuriuos dar reikia paversti kilometrais.",
        difficulty: "hard",
        cognitive_level: "apply",
      },
      {
        title: "Du žemėlapiai, vienas ežeras",
        description:
          "Tas pats ežeras pavaizduotas dviejuose žemėlapiuose. Žemėlapio A mastelis yra 1 : 25 000, žemėlapio B mastelis yra 1 : 100 000. Kuriame žemėlapyje ežeras atrodys didesnis ir kodėl?",
        type: "multiple_choice",
        points: 200,
        correct_answer: "Žemėlapyje A, nes jo mastelis stambesnis.",
        hints: [
          "Mastelis rodo, kiek kartų vaizdas žemėlapyje sumažintas.",
          "Kuo didesnis skaičius po dvitaškio, tuo labiau vaizdas sumažintas.",
          "Apskaičiuokite, kiek centimetrų kiekviename žemėlapyje užimtų 1 km.",
        ],
        options: [
          "Žemėlapyje A, nes jo mastelis stambesnis.",
          "Žemėlapyje A, nes jo mastelis smulkesnis.",
          "Žemėlapyje B, nes skaičius 100 000 didesnis.",
          "Abiejuose vienodai, nes ežeras tas pats.",
        ],
        explanation:
          "Žemėlapyje A vaizdas sumažintas 25 000 kartų, o žemėlapyje B net 100 000 kartų, todėl žemėlapyje A ežeras atrodo didesnis. 1 km žemėlapyje A užima 4 cm, žemėlapyje B tik 1 cm. Mastelis, kurio skaičius po dvitaškio mažesnis, vadinamas stambesniu: jame matyti daugiau smulkmenų.",
        difficulty: "hard",
        cognitive_level: "analyse",
      },
    ],
  },
  {
    slug: "istorija-valstybes-atkurimas-1918-1990",
    title: "Du aktai, viena valstybė: 1918 m. ir 1990 m.",
    description:
      "Komandos prisimena pagrindines Lietuvos valstybės atkūrimo datas ir institucijas, rikiuoja 1988-1991 m. įvykius ir lygina Vasario 16-osios ir Kovo 11-osios aktų ištraukas.",
    subject: "Istorija",
    grade_band: "9-10 kl.",
    duration_minutes: 30,
    curriculum:
      "Istorija, 9-10 klasės: Lietuvos valstybingumo raida XX a., valstybės atkūrimas 1918 m. ir nepriklausomybės atkūrimas 1990 m.; įvykių chronologija ir darbas su istorijos šaltiniais.",
    learning_goals: [
      "Nurodyti Vasario 16-osios ir Kovo 11-osios aktų datas ir juos priėmusias institucijas.",
      "Chronologiškai išdėstyti svarbiausius 1988-1991 m. Lietuvos įvykius.",
      "Palyginti dviejų aktų ištraukas ir įvardyti, kas jas sieja.",
    ],
    teacher_notes: {
      before:
        "Suskirstykite klasę į komandas po 3-4 mokinius, kiekvienai komandai reikia vieno telefono ar planšetės. Jei turite, pasidėkite abiejų aktų tekstus arba jų atvaizdus, kad galėtumėte parodyti aptarimo metu. Susitarkite, kad šaltinių ištraukas komanda perskaito garsiai ir atsakymą įrašo tik pasitarusi.",
      during:
        "Stebėkite, ar komandos skiria 1918 m. Lietuvos Tarybą nuo 1990 m. Aukščiausiosios Tarybos: pavadinimai panašūs, todėl painiojami dažnai. Chronologijos užduotyje paprašykite komandų pagrįsti seką priežasties ir pasekmės ryšiu, o ne spėti. Paskutinėje užduotyje paraginkite ištraukose pabraukti pasikartojančius žodžius.",
      after:
        "Aptarkite tris dalykus. Pirma: Vasario 16-oji minima kaip Lietuvos valstybės atkūrimo diena, Kovo 11-oji kaip Lietuvos nepriklausomybės atkūrimo diena. Paklauskite, kodėl abiejų švenčių pavadinimuose yra žodis „atkūrimas“. Antra: laiko juostoje lentoje kartu sužymėkite 1988-1991 m. įvykius ir aptarkite, kaip vienas įvykis vedė prie kito. Trečia: grįžkite prie ištraukų ir paprašykite komandų parodyti žodžius, kuriais rėmėsi atsakydamos.",
    },
    reflection_questions: [
      "Kaip jūsų komanda nustatė įvykių seką: iš atminties ar samprotaudama? Kuris būdas buvo patikimesnis?",
      "Ką lyginant dvi ištraukas pastebėjote tik perskaitę antrą kartą?",
      "Kodėl, jūsų nuomone, abiejuose aktuose kalbama apie valstybės atstatymą, o ne apie naujos valstybės kūrimą?",
    ],
    sources: [
      "Lietuvos Tarybos 1918 m. vasario 16 d. nutarimas (Lietuvos Nepriklausomybės Aktas): tekstas ir signatarų sąrašas, Lietuvos nacionalinis muziejus, Signatarų namai.",
      "Lietuvos Respublikos Aukščiausiosios Tarybos 1990 m. kovo 11 d. aktas „Dėl Lietuvos nepriklausomos valstybės atstatymo“: Teisės aktų registras, Lietuvos Respublikos Seimo kanceliarijos leidiniai.",
      "Lietuvos Respublikos Seimo skelbiama informacija apie valstybės šventes ir atmintinas dienas: Vasario 16-oji, Kovo 11-oji, Sausio 13-oji, Rugpjūčio 23-ioji.",
      "9-10 klasės istorijos vadovėlių temos „Lietuvos valstybės atkūrimas 1918 m.“ ir „Sąjūdis ir nepriklausomybės atkūrimas“.",
    ],
    challenges: [
      {
        title: "Nepriklausomybės Akto diena",
        description:
          "Kurią dieną Lietuvos Taryba Vilniuje pasirašė Lietuvos Nepriklausomybės Aktą?",
        type: "multiple_choice",
        points: 100,
        correct_answer: "1918 m. vasario 16 d.",
        hints: [
          "Ši diena kasmet minima kaip valstybinė šventė: Lietuvos valstybės atkūrimo diena.",
          "Kovo 11-ąją minimas kitas, vėlesnis įvykis.",
        ],
        options: [
          "1918 m. vasario 16 d.",
          "1918 m. lapkričio 11 d.",
          "1920 m. gegužės 15 d.",
          "1990 m. kovo 11 d.",
        ],
        explanation:
          "Lietuvos Taryba Nepriklausomybės Aktą pasirašė 1918 m. vasario 16 d. Vilniuje. 1990 m. kovo 11 d. priimtas kitas dokumentas: Aktas dėl Lietuvos nepriklausomos valstybės atstatymo. 1920 m. gegužės 15 d. susirinko Steigiamasis Seimas.",
        difficulty: "easy",
        cognitive_level: "remember",
      },
      {
        title: "Signatarai",
        description:
          "Vasario 16-osios Aktą pasirašė visi Lietuvos Tarybos nariai. Jie vadinami signatarais. Kiek signatarų pasirašė šį Aktą? Įrašykite skaičių.",
        type: "number",
        points: 100,
        correct_answer: "20",
        hints: [
          "Lietuvos Tarybą 1917 m. rugsėjo mėnesį išrinko Vilniuje vykusi lietuvių konferencija.",
          "Skaičius yra dviženklis ir lyginis.",
        ],
        options: null,
        explanation:
          "Vasario 16-osios Aktą pasirašė 20 Lietuvos Tarybos narių. Tarp jų buvo Jonas Basanavičius ir Antanas Smetona. Žodis „signataras“ reiškia asmenį, pasirašiusį svarbų dokumentą.",
        difficulty: "easy",
        cognitive_level: "remember",
      },
      {
        title: "Gyvoji grandinė",
        description:
          "1989 m. rugpjūčio 23 d. Lietuvos, Latvijos ir Estijos žmonės susikibo rankomis į gyvą grandinę nuo Vilniaus per Rygą iki Talino. Taip jie taikiai pareiškė siekį būti laisvi. Kaip vadinama ši akcija? Įrašykite pavadinimą.",
        type: "text",
        points: 150,
        correct_answer: "Baltijos kelias",
        accepted_answers: ["Baltijos kelio", "Baltijos kelio akcija"],
        hints: [
          "Akcija surengta minint Molotovo ir Ribentropo pakto 50-ąsias metines.",
          "Pavadinimą sudaro du žodžiai: pirmasis nurodo jūrą, prie kurios gyvena visos trys tautos.",
        ],
        options: null,
        explanation:
          "Ši akcija vadinama Baltijos keliu. Ji surengta 1989 m. rugpjūčio 23 d., praėjus lygiai 50 metų nuo Molotovo ir Ribentropo pakto pasirašymo. Gyva žmonių grandinė sujungė trijų valstybių sostines ir parodė pasauliui, kad šios tautos laisvės siekia taikiai ir kartu.",
        difficulty: "medium",
        cognitive_level: "understand",
      },
      {
        title: "Kas priėmė Kovo 11-osios Aktą?",
        description:
          "1990 m. kovo 11 d. priimtas Aktas dėl Lietuvos nepriklausomos valstybės atstatymo. Kuri institucija jį priėmė?",
        type: "multiple_choice",
        points: 150,
        correct_answer: "Lietuvos Respublikos Aukščiausioji Taryba",
        hints: [
          "Šios institucijos nariai, deputatai, buvo išrinkti 1990 m. vasario mėnesio rinkimuose.",
          "1918 m. Aktą pasirašiusi institucija 1990 m. jau seniai nebeveikė.",
        ],
        options: [
          "Lietuvos Respublikos Aukščiausioji Taryba",
          "Lietuvos Taryba",
          "Steigiamasis Seimas",
          "Lietuvos Persitvarkymo Sąjūdis",
        ],
        explanation:
          "Kovo 11-osios Aktą priėmė Lietuvos Respublikos Aukščiausioji Taryba, išrinkta 1990 m. vasario mėnesį. Vėliau ji pavadinta Atkuriamuoju Seimu. Lietuvos Taryba pasirašė 1918 m. Aktą, o Sąjūdis buvo visuomeninis judėjimas, ne valdžios institucija.",
        difficulty: "medium",
        cognitive_level: "understand",
      },
      {
        title: "Įvykių seka",
        description:
          "Išdėstykite įvykius nuo ankstyviausio iki vėliausio. A: Baltijos kelias. B: Sausio 13-osios įvykiai, kai žmonės Vilniuje gynė Televizijos bokštą ir kitus pastatus. C: Lietuvos Persitvarkymo Sąjūdžio iniciatyvinės grupės sudarymas. D: Kovo 11-osios Aktas. Kuri seka teisinga?",
        type: "multiple_choice",
        points: 200,
        correct_answer: "C, A, D, B",
        hints: [
          "Pagalvokite, kas subūrė žmones, vėliau rengusius didžiąsias taikias akcijas.",
          "Nepriklausomybę teko ginti jau po to, kai ji buvo paskelbta.",
        ],
        options: ["C, A, D, B", "A, C, D, B", "C, D, A, B", "C, A, B, D"],
        explanation:
          "Sąjūdžio iniciatyvinė grupė sudaryta 1988 m. birželio 3 d. Baltijos kelias įvyko 1989 m. rugpjūčio 23 d. Kovo 11-osios Aktas priimtas 1990 m., o Sausio 13-osios įvykiai vyko 1991 m. Seka rodo ir priežastis: Sąjūdis subūrė žmones, akcijos sustiprino ryžtą, o paskelbtą nepriklausomybę teko apginti.",
        difficulty: "hard",
        cognitive_level: "apply",
      },
      {
        title: "Dvi ištraukos",
        description:
          "Perskaitykite dvi ištraukas. 1918 m. Aktas: „Lietuvos Taryba [...] skelbia atstatanti nepriklausomą demokratiniais pamatais sutvarkytą Lietuvos valstybę su sostine Vilniuje [...].“ 1990 m. Aktas: „[...] yra atstatomas 1940 metais svetimos jėgos panaikintas Lietuvos valstybės suvereninių galių vykdymas, ir nuo šiol Lietuva vėl yra nepriklausoma valstybė.“ Kuris teiginys tinka abiem ištraukoms?",
        type: "multiple_choice",
        points: 200,
        correct_answer: "Abiejose kalbama apie valstybės atstatymą, o ne apie naujos valstybės kūrimą.",
        hints: [
          "Ieškokite žodžių, kurie kartojasi abiejose ištraukose.",
          "Patikrinkite kiekvieną teiginį: ar tai, kas jame sakoma, tikrai yra ir pirmoje, ir antroje ištraukoje?",
        ],
        options: [
          "Abiejose kalbama apie valstybės atstatymą, o ne apie naujos valstybės kūrimą.",
          "Abiejose nurodyta, kad valstybės sostinė yra Vilnius.",
          "Abiejose minimi 1940 metai.",
          "Abiejose nurodyta ta pati aktą priėmusi institucija.",
        ],
        explanation:
          "Abiejose ištraukose vartojamas tas pats žodis: 1918 m. Taryba skelbia „atstatanti“ valstybę, 1990 m. „atstatomas“ jos suvereninių galių vykdymas. Vadinasi, abu kartus valstybė ne kuriama iš naujo, o tęsiama anksčiau buvusi. Sostinė minima tik pirmoje ištraukoje, 1940 metai tik antroje.",
        difficulty: "hard",
        cognitive_level: "analyse",
      },
    ],
  },
  {
    slug: "pilietiskumas-valdzios-institucijos-9-10",
    title: "Kas ką veikia valstybėje: valdžios institucijos",
    description:
      "Komandos aiškinasi, kaip Konstitucija paskirsto valdžią Seimui, Respublikos Prezidentui, Vyriausybei ir teismams, ir pritaiko tai trumpoms situacijoms.",
    subject: "Pilietiškumas",
    grade_band: "9-10 kl.",
    duration_minutes: 30,
    curriculum:
      "Pilietiškumo pagrindai, 9-10 klasės: demokratinės valstybės sąranga, valdžių padalijimas, Lietuvos Respublikos valdžios institucijos ir jų funkcijos pagal Konstituciją.",
    learning_goals: [
      "Įvardyti Lietuvos Respublikos valdžios institucijas ir pagrindinę kiekvienos funkciją.",
      "Priskirti konkrečią situaciją įstatymų leidžiamajai, vykdomajai arba teisminei valdžiai.",
      "Paaiškinti, remiantis Konstitucijos tekstu, kodėl valdžios galios yra ribojamos.",
    ],
    teacher_notes: {
      before:
        "Suskirstykite klasę į komandas po 3-4 mokinius, kiekvienai komandai reikia vieno telefono ar planšetės. Pasidėkite Konstitucijos tekstą: pravers aptariant. Lentoje nubraižykite tuščią schemą su trimis stulpeliais: įstatymų leidžiamoji, vykdomoji ir teisminė valdžia. Ją pildysite veiklos pabaigoje.",
      during:
        "Stebėkite, ar komandos skiria Vyriausybę nuo Seimo: mokiniai dažnai mano, kad įstatymus leidžia Vyriausybė. Situacijų užduotyje paprašykite pagrįsti kiekvieną priskyrimą atskirai. Paskutinėje užduotyje paraginkite teiginius tikrinti pagal pateiktą tekstą, o ne pagal savo nuomonę.",
      after:
        "Kartu užpildykite schemą lentoje: kuri institucija kuriai valdžiai priklauso ir ką ji daro. Aptarkite tris painiavas. Pirma: įstatymus priima Seimas, o Vyriausybė juos vykdo ir priima nutarimus. Antra: Konstitucinis Teismas nenagrinėja įprastų bylų, jis tikrina, ar teisės aktai neprieštarauja Konstitucijai. Trečia: valstybės vadovas nėra aukščiausia valdžia, nes visų institucijų galias riboja Konstitucija. Perskaitykite Konstitucijos 5 straipsnį ir paklauskite, ką reiškia žodžiai „valdžios įstaigos tarnauja žmonėms“.",
    },
    reflection_questions: [
      "Kurią instituciją jūsų komandai buvo sunkiausia atskirti nuo kitų ir kodėl?",
      "Kaip savo žodžiais paaiškintumėte, kam reikalingas valdžių padalijimas?",
      "Kuo skyrėsi jūsų darbas, kai atsakymo ieškojote tekste, ir kai rėmėtės tuo, ką jau žinojote?",
      "Su kuria iš šių institucijų žmogus gali susidurti kasdieniame gyvenime? Pateikite pavyzdį.",
    ],
    sources: [
      "Lietuvos Respublikos Konstitucija, pirmasis skirsnis „Lietuvos valstybė“: 5 straipsnis.",
      "Lietuvos Respublikos Konstitucija, penktasis skirsnis „Seimas“ ir šeštasis skirsnis „Respublikos Prezidentas“.",
      "Lietuvos Respublikos Konstitucija, septintasis skirsnis „Lietuvos Respublikos Vyriausybė“, aštuntasis skirsnis „Konstitucinis Teismas“ ir devintasis skirsnis „Teismas“.",
      "9-10 klasės pilietiškumo pagrindų vadovėlių tema „Valdžių padalijimas ir valdžios institucijos“.",
    ],
    challenges: [
      {
        title: "Kas leidžia įstatymus?",
        description: "Kuri Lietuvos Respublikos institucija leidžia įstatymus?",
        type: "multiple_choice",
        points: 100,
        correct_answer: "Seimas",
        hints: [
          "Šios institucijos narius tiesiogiai renka piliečiai. Ji atstovauja Tautai.",
          "Kitose šalyse tokia institucija dažnai vadinama parlamentu.",
        ],
        options: ["Seimas", "Vyriausybė", "Respublikos Prezidentas", "Konstitucinis Teismas"],
        explanation:
          "Įstatymus leidžia Seimas: tai Tautos atstovybė, kurią renka piliečiai. Vyriausybė įstatymų nepriima, ji juos vykdo. Respublikos Prezidentas Seimo priimtus įstatymus pasirašo ir oficialiai paskelbia.",
        difficulty: "easy",
        cognitive_level: "remember",
      },
      {
        title: "Seimo narių skaičius",
        description: "Kiek narių pagal Konstituciją sudaro Seimą? Įrašykite skaičių.",
        type: "number",
        points: 100,
        correct_answer: "141",
        hints: [
          "Narių yra daugiau nei 100, bet mažiau nei 150.",
          "Skaičius yra triženklis ir nelyginis.",
        ],
        options: null,
        explanation:
          "Konstitucijoje nustatyta, kad Seimą sudaro 141 Seimo narys. Jie renkami ketveriems metams. Nepainiokite su Respublikos Prezidento kadencija: ji trunka penkerius metus.",
        difficulty: "easy",
        cognitive_level: "remember",
      },
      {
        title: "Konstitucijos sargas",
        description:
          "Kuri institucija sprendžia, ar įstatymai ir kiti Seimo aktai neprieštarauja Konstitucijai?",
        type: "multiple_choice",
        points: 150,
        correct_answer: "Konstitucinis Teismas",
        hints: [
          "Tai teismas, bet jis nenagrinėja įprastų ginčų tarp žmonių ar įmonių.",
          "Šį teismą sudaro devyni teisėjai.",
        ],
        options: [
          "Konstitucinis Teismas",
          "Lietuvos Aukščiausiasis Teismas",
          "Seimas",
          "Respublikos Prezidentas",
        ],
        explanation:
          "Ar įstatymai neprieštarauja Konstitucijai, sprendžia Konstitucinis Teismas. Jį sudaro devyni teisėjai. Lietuvos Aukščiausiasis Teismas yra kita institucija: jis nagrinėja civilines ir baudžiamąsias bylas, bet įstatymų atitikties Konstitucijai nevertina.",
        difficulty: "medium",
        cognitive_level: "understand",
      },
      {
        title: "Vyriausybės vadovas",
        description:
          "Vyriausybę sudaro jos vadovas ir ministrai. Kaip Konstitucijoje vadinamos Vyriausybės vadovo pareigos? Įrašykite pareigų pavadinimą.",
        type: "text",
        points: 150,
        correct_answer: "Ministras Pirmininkas",
        accepted_answers: ["Ministrė Pirmininkė", "premjeras", "premjerė", "Ministro Pirmininko"],
        hints: [
          "Tai ne valstybės vadovas: valstybės vadovas yra Respublikos Prezidentas.",
          "Pavadinimą sudaro du žodžiai. Vienas iš jų tinka ir kitiems Vyriausybės nariams.",
        ],
        options: null,
        explanation:
          "Vyriausybei vadovauja Ministras Pirmininkas: jis atstovauja Vyriausybei ir vadovauja jos veiklai. Kasdienėje kalboje jis dažnai vadinamas premjeru. Nepainiokite su Respublikos Prezidentu: Prezidentas yra valstybės vadovas, bet Vyriausybei nevadovauja.",
        difficulty: "medium",
        cognitive_level: "understand",
      },
      {
        title: "Trys situacijos",
        description:
          "Perskaitykite tris situacijas. A: svarstomas ir balsuojant priimamas naujas Atliekų tvarkymo įstatymas. B: ministrai posėdyje priima nutarimą, kaip šį įstatymą įgyvendinti. C: teisėjas nagrinėja bylą ir sprendžia, ar įmonė pažeidė šį įstatymą. Kuri institucija veikia kiekvienoje situacijoje?",
        type: "multiple_choice",
        points: 200,
        correct_answer: "A: Seimas, B: Vyriausybė, C: teismas",
        hints: [
          "Kiekvienoje situacijoje veikia vis kita valdžia: įstatymų leidžiamoji, vykdomoji arba teisminė.",
          "Ministrai yra Vyriausybės nariai.",
          "Kiekvieną situaciją priskirkite atskirai ir tik tada ieškokite tinkamo atsakymo.",
        ],
        options: [
          "A: Seimas, B: Vyriausybė, C: teismas",
          "A: Vyriausybė, B: Seimas, C: teismas",
          "A: Seimas, B: teismas, C: Vyriausybė",
          "A: Respublikos Prezidentas, B: Vyriausybė, C: Seimas",
        ],
        explanation:
          "Įstatymus svarsto ir priima Seimas, tai įstatymų leidžiamoji valdžia. Vyriausybė, kurią sudaro Ministras Pirmininkas ir ministrai, įstatymus vykdo ir priima nutarimus. Bylas nagrinėja ir teisingumą vykdo tik teismai. Taip valdžios padalijamos, kad nė viena institucija neturėtų visų galių.",
        difficulty: "hard",
        cognitive_level: "apply",
      },
      {
        title: "Ką sako 5 straipsnis?",
        description:
          "Perskaitykite Konstitucijos 5 straipsnį: „Valstybės valdžią Lietuvoje vykdo Seimas, Respublikos Prezidentas ir Vyriausybė, Teismas. Valdžios galias riboja Konstitucija. Valdžios įstaigos tarnauja žmonėms.“ Kuris teiginys išplaukia iš šio teksto?",
        type: "multiple_choice",
        points: 200,
        correct_answer: "Nė viena institucija neturi neribotos valdžios.",
        hints: [
          "Atsakymo ieškokite pateiktame tekste, ne savo nuomonėje.",
          "Dar kartą perskaitykite antrąjį straipsnio sakinį.",
          "Kiekvieną teiginį palyginkite su tekstu: ar tekste tai pasakyta, ar tik atrodo tikėtina?",
        ],
        options: [
          "Nė viena institucija neturi neribotos valdžios.",
          "Aukščiausia valdžia priklauso Respublikos Prezidentui.",
          "Seimas gali keisti kitų institucijų galias be jokių apribojimų.",
          "Teismas vykdo Vyriausybės nurodymus.",
        ],
        explanation:
          "Straipsnyje valdžią vykdo kelios institucijos, o jų galias riboja Konstitucija. Vadinasi, nė viena iš jų neturi neribotos valdžios. Tekste nesakoma, kad kuri nors institucija yra aukščiausia ar pavaldi kitai. Respublikos Prezidentas yra valstybės vadovas, bet ir jo galias nustato Konstitucija.",
        difficulty: "hard",
        cognitive_level: "analyse",
      },
    ],
  },
]
