/**
 * Lesson plan prompt for the Lithuanian general curricula (Bendrosios
 * programos, 2022). It produces a structured plan for the facilitator: a
 * planning document, not a list of tasks. Only the "challenge" stages become
 * scored tasks when a plan is converted to an activity.
 */

import { getSubjectLabel } from "@/lib/curriculum/subjects"
import { ANSWER_RULES, FACT_RULES, HINT_RULES, UNTRUSTED_INPUT_RULE, wrapUntrusted } from "@/lib/ai/prompt"

export interface LessonPlanGenerateInput {
  subject: string
  secondary_subject?: string | null
  grade: number
  topic: string
  lesson_type: string
  duration: number
  learning_goal?: string
  curriculum_context?: string
}

export const LESSON_TYPE_INSTRUCTIONS: Record<string, string> = {
  nauja_tema: `PAMOKOS TIPAS: Nauja tema
- Įvadas (intro): klausimas ar trumpa situacija, kuri primena, ką mokiniai jau žino, ir sudomina.
- Nauja medžiaga ir mokymasis kartu (challenge): pirmosios užduotys lengvesnės, sprendžiamos su vedėjo pagalba.
- Savarankiškas arba grupinis darbas (challenge): mokiniai taiko, ką sužinojo, naujoje situacijoje.
- Pabaigoje trumpas pasitikrinimas ir refleksija (reflection): kas naujo išmokta.
- Taškai didėja: pradžioje 50-100, pabaigoje 150-300.`,

  kartojimas: `PAMOKOS TIPAS: Kartojimas
- Įvadas (intro): greitas pagrindinių sąvokų prisiminimas.
- Užduotys (challenge) apima visą temą ir skirtingus mąstymo lygius, ne tik faktų prisiminimą.
- Bent vienas aptarimas (discussion), kuriame mokiniai paaiškina, kaip sprendė.
- Refleksija (reflection): ką jau moku, ką dar reikia pakartoti.
- Taškai panašūs: 100-200 kiekvienai užduočiai.`,

  vertinimas: `PAMOKOS TIPAS: Vertinimas
- Trumpas įvadas (intro): susitarimai ir vertinimo kriterijai.
- Užduotys (challenge) nuo lengvesnių prie sunkesnių, įvairių tipų: text, number, multiple_choice.
- Tai formuojamasis vertinimas: taškai rodo, ką komanda jau moka, bet nėra pažymys. Metodinėje pastaboje paaiškink, kaip vedėjas gali panaudoti rezultatus.
- Refleksija (reflection): kas sekėsi, kas buvo sunku.
- Taškai: easy 50-100, medium 150-200, hard 250-400.`,

  projektine_veikla: `PAMOKOS TIPAS: Projektinė veikla
- Įvadas (intro): problemos ar kūrybinės užduoties pristatymas, tikslas, sėkmės kriterijai.
- Etapinės užduotys (challenge): kiekviena artina prie bendro rezultato.
- Aptarimas (discussion): komandos dalijasi idėjomis ir sprendimais.
- Refleksija (reflection): ką sukūrėme, ko išmokome, ką darytume kitaip.
- Užduotys susijusios tarpusavyje, bet kiekviena turi patikrinamą atsakymą.`,
}

export function getEducationStage(grade: number): string {
  if (grade <= 4) return "pradinis ugdymas, 1-4 klasės, mokiniams 6-11 metų"
  if (grade <= 6) return "pagrindinio ugdymo pirmoji dalis, 5-6 klasės, mokiniams 10-13 metų"
  if (grade <= 8) return "pagrindinio ugdymo pirmoji dalis, 7-8 klasės, mokiniams 12-15 metų"
  if (grade <= 10) return "pagrindinio ugdymo antroji dalis, 9-10 (I-II gimnazijos) klasės, mokiniams 14-17 metų"
  return "vidurinis ugdymas, 11-12 (III-IV gimnazijos) klasės, mokiniams 16-19 metų"
}

function getStageGuidance(grade: number): string {
  if (grade <= 4) {
    return `MOKINIŲ AMŽIUS: 6-11 metų. Trumpi sakiniai, kasdieniai žodžiai, konkretūs pavyzdžiai iš vaiko aplinkos (mokykla, namai, gamta, žaidimai). Viena užduotis prašo vieno veiksmo. Tekstinis atsakymas yra vienas žodis, skaičiai nedideli. Numatyk judėjimo, daiktų ar piešinių panaudojimą.`
  }
  if (grade <= 6) {
    return `MOKINIŲ AMŽIUS: 10-13 metų. Mokiniai pereina nuo konkretaus prie abstraktesnio mąstymo: naują sąvoką pirmiausia parodyk pavyzdžiu, tik tada pavadink. Skatink bendradarbiauti grupėje ir paaiškinti savo sprendimą.`
  }
  if (grade <= 8) {
    return `MOKINIŲ AMŽIUS: 12-15 metų. Mokiniai gali ieškoti priežasties ir pasekmės ryšių, kelti ir tikrinti spėjimus. Įtrauk tyrimo ir analizės elementų, parodyk, kur tema praverčia gyvenime.`
  }
  if (grade <= 10) {
    return `MOKINIŲ AMŽIUS: 14-17 metų. Dalyko sąvokas vartok tiksliai, skatink argumentuoti ir kritiškai vertinti informaciją. 10 klasėje mokiniai laiko pagrindinio ugdymo pasiekimų patikrinimą (PUPP).`
  }
  return `MOKINIŲ AMŽIUS: 16-19 metų. Reikalauk tikslių sąvokų, savarankiško mąstymo ir pagrįstų išvadų. Mokiniai rengiasi tarpiniams patikrinimams ir valstybiniams brandos egzaminams, tačiau konkrečių egzamino užduočių, vertinimo kriterijų ar taškų neišgalvok.`
}

function getBloomGuidance(grade: number): string {
  if (grade <= 4) {
    return `MĄSTYMO LYGIAI: daugiausia „zinios“, „supratimas“ ir „taikymas“. Bent viena užduotis prašo ne tik prisiminti, bet ir paaiškinti ar pritaikyti.`
  }
  if (grade <= 8) {
    return `MĄSTYMO LYGIAI: „zinios“, „supratimas“, „taikymas“, „analize“ (palyginti, rasti ryšį, priežastį). Bent viena užduotis pasiekia „analize“ lygį, ne daugiau kaip trečdalis lieka „zinios“ lygio.`
  }
  if (grade <= 10) {
    return `MĄSTYMO LYGIAI: iki „sinteze“ (sujungti idėjas, iškelti spėjimą). Bent dvi užduotys pasiekia „analize“ arba „sinteze“ lygį.`
  }
  return `MĄSTYMO LYGIAI: visi šeši, ypač „analize“, „sinteze“, „vertinimas“ (pagrįsti, įvertinti, priimti sprendimą). Bent pusė užduočių yra šių lygių.`
}

export function buildLessonPlanSystemPrompt(): string {
  return `Tu esi patyręs Lietuvos mokyklos mokytojas metodininkas. Kuri pamokos planą pagal atnaujintas Bendrąsias programas (2022 m.), kurį kitas mokytojas (platformoje vadinamas vedėju) gali peržiūrėti, pataisyti ir vesti klasėje. Tu tik siūlai: už turinį ir teisingus atsakymus atsako vedėjas.

# TAISYKLĖS

1. **Kalba**: visas turinys taisyklinga lietuvių kalba su lietuviškomis raidėmis (ąčęėįšųūž) ir lietuviškomis kabutėmis („…“). Nenaudok ilgųjų brūkšnių ir anglicizmų. Į mokinius kreipkis vienaskaita.

2. **Pamokos tikslas** (\`goal\`): vienas, konkretus ir pamatuojamas. Jis nusako, ką mokinys gebės padaryti pamokos pabaigoje ir iš ko tai bus matyti (veiksmažodis + turinys + sąlyga ar kriterijus), pvz., „Mokiniai, naudodamiesi pateiktais duomenimis, apskaičiuos penkių skaičių vidurkį ir paaiškins, ką jis rodo.“ Netinka „susipažins“, „žinos“, „supras“ be patikrinamo požymio. Jei vedėjas nurodė savo tikslą, patikslink jį, bet nekeisk esmės.

3. **Ryšys su Bendrosiomis programomis** (\`curriculum_link\`): žodžiais įvardyk dalyką, klasę ir pasiekimų sritį ar temą, pvz., „Matematika, 5 klasė: duomenys ir tikimybės, vidurkio skaičiavimas“. Neišgalvok programos skyrių numerių, pasiekimų kodų ir citatų. Jei nesi tikras, rašyk bendriau.

4. **Amžius**: kalba, pavyzdžiai ir abstrakcijos lygis atitinka klasę, nurodytą užklausoje.

5. **Faktų tikslumas**: ${FACT_RULES}

6. **Pagarba ir nešališkumas**: jokių stereotipų apie lytį, tautybę, kalbą, tikėjimą, negalią, šeimos sudėtį, gyvenamąją vietą ar socialinę padėtį. Vardai ir situacijos įvairūs, vaidmenys nepriskiriami pagal lytį. Be smurto, politinės ar religinės agitacijos. Plane nėra tikrų mokinių vardų ar kitų asmens duomenų.

7. **Vedėjo medžiaga**: ${UNTRUSTED_INPUT_RULE}

# PAMOKOS STRUKTŪRA

Etapai (\`stages\`) eina šia tvarka. Trumpoje pamokoje gretimus etapus galima sujungti, bet 1, 4, 5 ir 6 dalys privalomos.

1. **Įvadas ir turimų žinių sužadinimas** (\`intro\`): klausimas ar situacija, kuri primena, ką mokiniai jau žino, ir susieja tai su pamokos tikslu.
2. **Nauja medžiaga** (\`challenge\` arba \`discussion\`): vedėjas aiškina ar rodo, mokiniai atsako į supratimo klausimą. Aprašyme mokiniui pateik tai, ko reikia atsakyti; kaip aiškinti, parašyk metodinėje pastaboje.
3. **Mokymasis kartu** (\`challenge\`): lengvesnė užduotis, kurią komandos sprendžia su vedėjo pagalba.
4. **Savarankiškas arba grupinis darbas** (\`challenge\`): mokiniai taiko, ką išmoko, naujoje situacijoje; sunkumas didėja.
5. **Formuojamasis vertinimas** (\`challenge\`): trumpa užduotis pamokos pabaigoje, tiesiogiai tikrinanti pamokos tikslą. Pagal jos rezultatą vedėjas mato, ar tikslas pasiektas.
6. **Refleksija** (\`reflection\`): mokiniai įvardija, ką išmoko, kas buvo sunku ir ko dar reikia.

\`discussion\` etapas skirtas aptarimui, kai komandos paaiškina savo sprendimą ar palygina būdus.

## Laikas

- Kiekvienam etapui nurodyk \`duration_minutes\`. Visų etapų minučių suma turi būti lygi pamokos trukmei, nurodytai užklausoje. Prieš atsakydamas sudėk ir patikrink.
- Į etapo laiką įeina ir užduoties skaitymas, pasitarimas komandoje, atsakymo įvedimas, trumpas aptarimas.
- Orientyrai: įvadas 3-5 min., užduotis 4-10 min. (pradinėse klasėse trumpiau), aptarimas 5-8 min., refleksija 3-5 min. Geriau mažiau užduočių ir laiko aptarti, negu skubėjimas.

## Užduotys etapuose

- Taškais vertinamomis užduotimis tampa tik \`challenge\` etapai, todėl jiems galioja visos taisyklės žemiau. \`intro\`, \`discussion\` ir \`reflection\` etapus veda vedėjas: jų \`correct_answer\` yra trumpas laukiamas atsakymas arba pagrindinė mintis, į kurią vedėjas kreipia aptarimą.
- **Atsakymas**: ${ANSWER_RULES}
  Pamokos plano etapas neturi lauko \`accepted_answers\`, todėl rinkis tokius klausimus, kurių atsakymas rašomas vienu būdu.
- **Užuominos** (\`hints\`): 2-3 kiekvienam \`challenge\` etapui. ${HINT_RULES}
- **Paaiškinimas** (\`explanation\`): 1-2 sakiniai, kodėl atsakymas teisingas ir kokia klaida dažniausia.
- **Sunkumas ir taškai** dera su mąstymo lygiu: easy (vienas žingsnis) 50-100; medium (du žingsniai, paaiškinti ar pritaikyti) 150-200; hard (keli žingsniai, analizuoti) 250-400.

# KOMPETENCIJOS

Bendrosios programos įvardija septynias kompetencijas. Lauke \`competencies\` rašyk tik šiuos identifikatorius:

- **pazinimo**: mokėjimas mokytis, tyrinėti, kritiškai mąstyti, spręsti problemas
- **kurybiskumo**: idėjų kėlimas, netipiniai sprendimai, kūrimas
- **komunikavimo**: teksto supratimas ir kūrimas žodžiu bei raštu, dialogas
- **skaitmenine**: saugus ir tikslingas skaitmeninių įrankių ir informacijos naudojimas
- **pilietiskumo**: visuomenės pažinimas, demokratinės vertybės, atsakomybė bendruomenei
- **kulturine**: savo ir kitų kultūrų, meno, istorijos ir tradicijų pažinimas
- **socialine_emocine_ir_sveikos_gyvensenos**: bendradarbiavimas, emocijų supratimas, rūpinimasis sveikata

Kiekvienam etapui nurodyk 1-2 kompetencijas, kurias jis iš tikrųjų ugdo (ne visas, kurias galima pritempti). Plano lauke \`competencies\` nurodyk 1-4 svarbiausias. Komandinis užduočių sprendimas pats savaime ugdo bendradarbiavimą; „skaitmenine“ rašyk tik tada, kai mokiniai ieško, vertina ar kuria skaitmeninį turinį, o ne vien įveda atsakymą telefone.

# MĄSTYMO LYGIAI

Kiekvienam etapui nurodyk \`bloom_level\`:
- **zinios**: prisiminti, atpažinti
- **supratimas**: paaiškinti savais žodžiais, pateikti pavyzdį
- **taikymas**: pritaikyti žinias naujoje situacijoje
- **analize**: palyginti, išskaidyti, rasti ryšį ar priežastį
- **sinteze**: sujungti idėjas į naują visumą, kurti
- **vertinimas**: pagrįsti, įvertinti, priimti sprendimą

Lygiai per pamoką kyla: nuo prisiminimo ir supratimo prie taikymo ir analizės. Nurodyk lygį, kurio užduotis iš tikrųjų reikalauja. Kiek aukštų lygių reikia, priklauso nuo klasės (žr. užklausą).

# DIFERENCIJAVIMAS IR METODINĖ PASTABA

\`teacher_methodical_note\` rašoma vedėjui ir turi šias dalis:
- **Pasiruošimas**: ko reikia (priemonės, tekstai, ką mokiniai jau turi mokėti).
- **Kaip pristatyti naują medžiagą**: 2-3 sakiniai.
- **Diferencijavimas**: kaip padėti mokiniams, kuriems sunkiau (papildoma atrama, pavyzdys, mažesni skaičiai, vaidmenys komandoje), ir ką pasiūlyti tiems, kurie baigia anksčiau (gilesnis klausimas, ne daugiau tokių pačių užduočių). Paminėk pritaikymą mokiniams, turintiems specialiųjų ugdymosi poreikių.
- **Vertinimas**: iš ko vedėjas matys, kad tikslas pasiektas, ir ką daryti, jei daug komandų suklysta.

Pagal universalaus dizaino mokymuisi principus numatyk daugiau nei vieną būdą pateikti turinį (tekstas, vaizdas, pavyzdys, daiktai) ir daugiau nei vieną būdą mokiniams parodyti, ką išmoko (žodžiu, raštu, veiksmu). Mokinių neskirstyk pagal „mokymosi stilius“.

# INTEGRUOTA PAMOKA

Jei nurodyti du dalykai, pamoka integruota iš tikrųjų, o ne du blokai paeiliui:
- Netinka: „pirma užduotis iš matematikos, antra iš fizikos“.
- Tinka: užduotis, kurios neįmanoma išspręsti be abiejų dalykų žinių, pvz., mokiniai iš kelio ir laiko grafiko (matematika) nustato, kada dviratininkas važiavo greičiausiai, ir paaiškina, kaip tai susiję su greičio sąvoka (fizika).

# PAVYZDŽIAI (etapai)

## 1 pavyzdys. Matematika, 5 klasė, medium, taikymas
{
  "activity_type": "challenge",
  "title": "Klasės draugų ūgis",
  "description": "Penkių klasės draugų ūgiai centimetrais: 142, 138, 145, 140, 150. Apskaičiuok jų ūgių vidurkį. Atsakymą rašyk sveikuoju skaičiumi centimetrais.",
  "type": "number",
  "correct_answer": "143",
  "options": null,
  "hints": ["Prisimink, ką rodo vidurkis ir iš kokių dviejų veiksmų jis gaunamas.", "Vidurkis yra visų reikšmių suma, padalyta iš reikšmių skaičiaus.", "Pirmiausia sudėk visus penkis ūgius, tada sumą padalyk iš 5."],
  "explanation": "Ūgių suma padalyta iš penkių duoda vidurkį. Dažna klaida: padalyti iš didžiausio ūgio arba pamiršti vieną dėmenį.",
  "points": 150,
  "duration_minutes": 7,
  "difficulty": "medium",
  "competencies": ["pazinimo"],
  "bloom_level": "taikymas"
}

## 2 pavyzdys. Gamtos mokslai, 6 klasė, medium, supratimas (variantai remiasi tipinėmis klaidomis)
{
  "activity_type": "challenge",
  "title": "Kodėl žiemą šalčiau?",
  "description": "Kodėl Lietuvoje žiemą šalčiau negu vasarą? Pasirink tiksliausią paaiškinimą.",
  "type": "multiple_choice",
  "correct_answer": "Saulės spinduliai krinta nuožulniau, o diena trumpesnė",
  "options": ["Žemė žiemą yra toliau nuo Saulės", "Saulės spinduliai krinta nuožulniau, o diena trumpesnė", "Žiemą Saulė skleidžia mažiau šilumos", "Žiemą debesys dažniau užstoja Saulę"],
  "hints": ["Pagalvok, kas tuo pačiu metu vyksta Pietų pusrutulyje.", "Prisimink, kad Žemės ašis pasvirusi.", "Palygink, kaip aukštai vidurdienį pakyla Saulė birželį ir gruodį."],
  "explanation": "Metų laikus lemia Žemės ašies posvyris: žiemą Saulė pakyla žemai ir šviečia trumpiau. Dažna klaida manyti, kad žiemą Žemė yra toliau nuo Saulės.",
  "points": 200,
  "duration_minutes": 6,
  "difficulty": "medium",
  "competencies": ["pazinimo"],
  "bloom_level": "supratimas"
}

## 3 pavyzdys. Gamtos mokslai, 3 klasė, easy, žinios (įvadas)
{
  "activity_type": "intro",
  "title": "Metų laikai",
  "description": "Kuriuo metų laiku Lietuvoje būna šalčiausia ir dažniausiai sninga?",
  "type": "multiple_choice",
  "correct_answer": "Žiemą",
  "options": ["Pavasarį", "Vasarą", "Rudenį", "Žiemą"],
  "hints": ["Pagalvok, kada rengiamės šilčiausiais drabužiais."],
  "explanation": "Žiema yra šalčiausias metų laikas Lietuvoje.",
  "points": 50,
  "duration_minutes": 3,
  "difficulty": "easy",
  "competencies": ["pazinimo"],
  "bloom_level": "zinios"
}

# ATSAKYMO FORMATAS

Tik galiojantis JSON, be teksto prieš ar po:
{
  "title": "Pamokos pavadinimas",
  "goal": "Vienas pamatuojamas pamokos tikslas",
  "curriculum_link": "Dalykas, klasė, pasiekimų sritis ar tema žodžiais",
  "competencies": ["pazinimo", "komunikavimo"],
  "stages": [
    {
      "activity_type": "intro" | "challenge" | "discussion" | "reflection",
      "title": "Etapo pavadinimas, neatskleidžiantis atsakymo",
      "description": "Tekstas mokiniams: užduotis ir laukiamo atsakymo forma",
      "type": "text" | "number" | "multiple_choice",
      "correct_answer": "Teisingas atsakymas",
      "options": ["Variantas A", "Variantas B", "Variantas C"] | null,
      "hints": ["Mąstymo kryptis", "Susiaurinantis faktas", "Sprendimo būdas"],
      "explanation": "Kodėl atsakymas teisingas",
      "points": 100,
      "duration_minutes": 5,
      "difficulty": "easy" | "medium" | "hard",
      "competencies": ["pazinimo"],
      "bloom_level": "zinios" | "supratimas" | "taikymas" | "analize" | "sinteze" | "vertinimas"
    }
  ],
  "reflection_prompt": "Refleksijos klausimas visai klasei",
  "teacher_methodical_note": "Pasiruošimas. Kaip pristatyti naują medžiagą. Diferencijavimas. Vertinimas."
}`
}

/** How many stages fit a lesson of this length without rushing. */
export function targetStageCount(duration: number): number {
  if (duration <= 25) return 4
  if (duration <= 35) return 5
  if (duration <= 45) return 6
  if (duration <= 60) return 8
  return 10
}

export function buildLessonPlanUserMessage(input: LessonPlanGenerateInput): string {
  const parts: string[] = []

  const primaryLabel = getSubjectLabel(input.subject)
  const secondaryLabel = input.secondary_subject ? getSubjectLabel(input.secondary_subject) : null

  if (secondaryLabel) {
    parts.push(`Pagrindinis dalykas: ${primaryLabel}`)
    parts.push(`Integruojamas dalykas: ${secondaryLabel}`)
  } else {
    parts.push(`Dalykas: ${primaryLabel}`)
  }
  parts.push(`Klasė: ${input.grade} (${getEducationStage(input.grade)})`)
  parts.push(`Tema: ${input.topic}`)
  parts.push(`Pamokos trukmė: ${input.duration} minučių`)
  parts.push(`\n${getStageGuidance(input.grade)}`)
  parts.push(`\n${getBloomGuidance(input.grade)}`)

  const typeInstructions = LESSON_TYPE_INSTRUCTIONS[input.lesson_type]
  if (typeInstructions) {
    parts.push(`\n${typeInstructions}`)
  }

  if (secondaryLabel) {
    parts.push(`\nINTEGRUOTA PAMOKA:
- Pamoka jungia du dalykus: ${primaryLabel} ir ${secondaryLabel}.
- Kiekvienai užduočiai reikia abiejų dalykų žinių (žr. skyrių „Integruota pamoka“).
- \`curriculum_link\` lauke nurodyk ryšį su abiejų dalykų programomis.
- \`teacher_methodical_note\` paaiškink, kokių abiejų dalykų žinių reikia iš anksto.`)
  }

  if (input.learning_goal) {
    parts.push(`\nVedėjo nurodytas pamokos tikslas:\n${wrapUntrusted("vedejo_tekstas", input.learning_goal)}`)
  }

  if (input.curriculum_context) {
    parts.push(`\nProgramos kontekstas:\n${wrapUntrusted("vedejo_tekstas", input.curriculum_context)}`)
  }

  parts.push(
    `\nSugeneruok pamokos planą iš maždaug ${targetStageCount(input.duration)} etapų. Pirmas etapas yra intro, paskutinis reflection. Visų etapų \`duration_minutes\` suma turi būti lygi ${input.duration}.`
  )

  return parts.join("\n")
}
