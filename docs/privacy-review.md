# Privatumo pranešimo projektas (CLS-013)

Puslapis `app/privatumas/page.tsx` (`/privatumas`). Kol `lib/privacy.ts` būsena `draft`, puslapyje rodoma „Projektas“ ir atviri klausimai. Produkcijoje skelbiama tik Vyčiui Radvilai patvirtinus turinį.

Faktai patikrinti 2026-11-07, patikslinti 2026-11-08 po Vyčio nepriklausomos peržiūros. Žemiau nurodyta, iš kur paimtas kiekvienas teiginys. Ko patikrinti nepavyko, puslapyje pateikta kaip klausimas, o ne kaip faktas.

Susiję dokumentai:

- `docs/data-retention.md`: saugojimas ir ištrynimas pagal duomenų kategorijas (CLS-014).
- `docs/library-access.md`: patvirtintos bibliotekos prieinamumas per Supabase Data API (CLS-015).

## Patikrinti faktai

| Teiginys puslapyje | Šaltinis |
| --- | --- |
| Valdytojas VšĮ „Klaipėdos universitetas“, kodas 211951150 | KU „Asmens duomenų saugumo pažeidimų reagavimo tvarkos aprašas“ (rektoriaus 2021-12-15 įsakymas Nr. 1-044), 2.1 p., ku.lt |
| Duomenų apsaugos pareigūnas Marius Kadelskas, dpo@ku.lt | Vytis Radvila 2026-11-08 pateikė iš https://www.ku.lt/privatumo-politika. Claude Code šio puslapio automatiškai perskaityti negali (ku.lt neleidžia automatinio skaitymo). **Prieš galutinį paskelbimą kontaktą patvirtinti** |
| Kontaktas steam@ku.lt | Platformos laiškų atsakymo adresas (`lib/email/send.ts`), puslapiai `/laukia`, prisijungimo forma |
| Vedėjų duomenys | `profiles` stulpeliai (schema po visų migracijų), profilio forma, `lib/access/profile-fields.ts` |
| Sutikimo tekstas | `CONSENT_TEXT` (`lib/access/profile-fields.ts`), rodomas prašymo ir profilio formose; data `profiles.consent_at` |
| Paskyros prašymo duomenys | `access_requests` stulpeliai |
| Dalyvių duomenys | `teams`, `submissions`, `hint_reveals`, `achievements`, `reflections`; paskyrų nėra |
| DI naudojimo įrašas be turinio | `ai_usage`: naudotojas, funkcija, modelis, žetonai, kaina, laikas |
| Administratorių veiksmų žurnalas, jame el. paštai | `admin_audit_log`; `logAdminAction` kvietimai `app/api/admin/**` į `details` įrašo el. pašto adresą |
| IP adresas: tik bandymų ribojimui, į platformos DB neįrašomas | Žr. skyrių „IP adresas ir identifikatorius“ |
| Anthropic gauna tik vedėjo turinį | Anthropic kviečia tik `app/api/di/generate`, `app/api/di/verify`, `app/api/import/process`, `app/api/lesson-plans/[planId]/convert` |
| Supabase projekto regionas Frankfurtas | Supabase projekto nustatymai: „Central EU (Frankfurt)“ |
| Vercel serverio funkcijų regionas Frankfurtas | `vercel.json` `regions: ["fra1"]`. Tai funkcijų regionas. Kuriame tinklo taške Vercel priima užklausą, šis nustatymas nenurodo |
| Resend siunčia laiškus | Supabase Auth SMTP `smtp.resend.com`; platformos laiškai per Resend API (`lib/email/send.ts`). Resend regionas **nepatikrintas** (Resend paskyroje netikrinta), todėl puslapyje nenurodomas |
| Google prisijungimas | Prisijungimo forma (`app/auth/login/login-form.tsx`) |
| Ištrynimas kaskadomis | Veiklos trynimas (`app/api/games/[gameId]`), komandos šalinimas; `on delete cascade` migracijose `00001`, `00004`, `00011`, `00012`, `00024` |
| Ištrynus paskyrą: veiklos ir planai trinami, kita lieka | `profiles.id` → `auth.users` `on delete cascade`; `games.teacher_id`, `lesson_plans.teacher_id` `on delete cascade`; `library_items.published_by`, `access_requests.user_id`, `ai_usage.user_id`, `admin_audit_log.actor_id` `on delete set null` |
| Paskyros platformoje ištrinti negalima | UI ir API turi tik blokavimą (`app/api/admin/users/[id]/status`); `auth.admin.deleteUser` kode nenaudojamas |
| Paveikslėliai ir dokumentai neištrinami | Kode nėra nė vieno `storage.remove` kvietimo |
| Naktinis užbaigimas be trynimo | `app/api/cron/finish-stale-activities` keičia tik būseną |
| Kasdienės atsarginės kopijos | Supabase → Database → Backups: kasdienės fizinės kopijos. Saugojimo trukmė pagal Supabase planą nepatikrinta |
| Paveikslėliai pagal nuorodą | Saugykla `challenge-images` vieša (`00003_challenge_media.sql`) |
| Patvirtinti bibliotekos įrašai pasiekiami be prisijungimo | `docs/library-access.md` |
| Dalyvio naršyklėje saugomas žetonas | `lib/game/session.ts`: `ctf_session_<kodas>` (tikrinama 24 val. riba), `ctf_start_<kodas>`, `ctf_reflection_<kodas>` |
| Analitikos ir reklamos slapukų nėra | Priklausomybėse nėra analitikos ar reklamos paketų |

## IP adresas ir identifikatorius

Kaip veikia (`lib/client-address.ts`, `lib/ai/rate-limit.ts`):

- IP adresas naudojamas trims ribojimams: komandos kūrimui (`/api/teams`), grįžimui į komandą (`/api/play/rejoin`) ir paskyros prašymui (`/api/access-requests`).
- Serveris iš adreso apskaičiuoja HMAC-SHA256 reikšmę. Raktas yra serverio paslaptis (`SUPABASE_SERVICE_ROLE_KEY`), reikšmė sutrumpinta iki 32 šešioliktainių ženklų.
- Reikšmė laikoma tik serverio egzemplioriaus atmintyje (`Map`), nes Upstash nekonfigūruotas: Vercel `ctf-builder` nėra `KV_REST_API_*` kintamųjų. Pasibaigusios ribos įrašai neišvalomi, kol egzempliorius veikia. Į platformos DB nei adresas, nei reikšmė neįrašomi.

Ko neteigiame:

- Tai **nėra šifravimas**: reikšmės negalima „iššifruoti“, bet tas pats adresas su tuo pačiu raktu visada duoda tą pačią reikšmę. Turint raktą, reikšmę galima susieti su adresu perrenkant adresus.
- Netvirtiname, kad reikšmė yra anoniminė ar nėra asmens duomenys. Tai teisinis vertinimas, ne techninis faktas.
- Netvirtiname, kad IP adreso niekur nėra. Vercel ir Supabase savo žurnaluose gali įrašyti IP adresą. Supabase Auth gali įrašyti vedėjų prisijungimo įvykius su IP adresu lentelėje `auth.audit_log_entries`. Produkcijoje tai nepatikrinta (žr. „Nepatikrinta produkcijoje“).

## Ko puslapyje neteigiame

- Resend, Anthropic ir Google duomenų tvarkymo vietos.
- Vercel tinklo taško, kuriame priimama užklausa, vietos.
- Kur paslaugų teikėjai saugo savo žurnalus ir kiek laiko.
- Ar duomenys perduodami už EEE ribų. Ankstesnė frazė „bendrovės registruotos JAV“ išimta: šiame darbe ji nepatikrinta ir pati savaime neatsako, ar vyksta perdavimas.

## Nepatikrinta produkcijoje

2026-11-08 Chrome buvo nepasiekiamas, todėl produkcijos SQL Editor užklausos nevykdytos. Jas galima paleisti vėliau (tik SELECT, asmens duomenų nerodo):

```sql
-- Ar Supabase Auth įrašo prisijungimo įvykius su IP adresu
select count(*) as rows,
       count(*) filter (where coalesce(ip_address, '') <> '') as with_ip,
       min(created_at)::date as oldest
from auth.audit_log_entries;

-- Kiek failų laiko saugyklos
select bucket_id, count(*) as files, min(created_at)::date as oldest
from storage.objects group by 1 order by 1;

-- Kiek įrašų kaupiasi be termino
select 'access_requests' as t, count(*), min(created_at)::date from public.access_requests
union all select 'ai_usage', count(*), min(created_at)::date from public.ai_usage
union all select 'admin_audit_log', count(*), min(created_at)::date from public.admin_audit_log;
```

Atsarginių kopijų saugojimo trukmę rodo Supabase → Database → Backups.

## Klausimai KU duomenų apsaugos pareigūnui

1. Patvirtinti puslapyje nurodytą kontaktą: Marius Kadelskas, dpo@ku.lt.
2. Teisinis pagrindas. Formose dabar prašoma sutikimo. Ar tinka sutikimas, ar KU naudoja kitą pagrindą (pvz., viešąjį interesą ar teisėtą interesą)? Jei sutikimas, kaip jis atšaukiamas.
3. Saugojimo terminai kiekvienai `docs/data-retention.md` kategorijai.
4. Duomenų tvarkytojai ir perdavimai:
   - ar su Supabase, Vercel, Anthropic, Resend ir Google sudarytos ar priimtos duomenų tvarkymo sutartys (DPA) ir kas jas sudaro KU vardu;
   - kur duomenis tvarko Resend, Anthropic ir Google, kur paslaugų teikėjai saugo žurnalus;
   - ar duomenys perduodami už EEE ribų ir kokiu pagrindu (pvz., sprendimas dėl tinkamumo ar standartinės sutarčių sąlygos).
5. Kas priima duomenų subjektų prašymus: STEAM centras (steam@ku.lt) ar duomenų apsaugos pareigūnas.
6. Ar reikia atskiros informacijos tėvams, kai dalyviai yra nepilnamečiai (dalyviai be paskyrų, bet laisvame tekste gali įrašyti vardus).
7. Ar pranešime reikia nurodyti, kad paslaugų teikėjų žurnaluose ir vedėjų prisijungimo žurnale gali būti IP adresas, ir kokiu tikslumu.

## Kaip paskelbti

1. Vytis patvirtina turinį ir atsiunčia DAP pareigūno atsakymus.
2. Claude Code pakeičia kiekvieną `<Question>` patvirtintu tekstu, `lib/privacy.ts` būseną pakeičia į `approved`, atnaujina datą.
3. `tests/privacy-notice.test.ts` neleidžia `approved` būsenos su likusiais klausimais.
4. CI, Vercel peržiūra, sujungimas, produkcijos patikra.
