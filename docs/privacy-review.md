# Privatumo pranešimas: pagrindimas (CLS-013)

Viešas puslapis `app/privatumas/page.tsx` (`/privatumas`) yra trumpas ir be techninių detalių. Šis dokumentas yra vidinis: iš kur kiekvienas teiginys, kodėl pasirinktas teisinis pagrindas ir ko puslapyje sąmoningai neteigiame. Kol `lib/privacy.ts` būsena `draft`, puslapyje rodoma „Projektas“. Produkcijoje skelbiama tik Vyčiui Radvilai patvirtinus.

KU duomenų apsaugos pareigūnas (konsultacija 2026-11-08, perdavė Vytis): pranešimai trumpi ir suprantami, laikomasi gerosios praktikos, vartotojai neapkraunami. Praktinį parengimą ir vidaus sprendimus jis paliko KU STEAM centrui. Todėl ankstesni klausimai DAP nebėra išorinis blokatorius; sprendimus priima Vytis (žr. „Laukia savininko patvirtinimo“).

Susiję: `docs/data-retention.md` (saugojimo politikos projektas, CLS-014), `docs/library-access.md` (biblioteka, CLS-015).

## Sluoksniai

| Vieta | Ką mato žmogus |
| --- | --- |
| Paskyros prašymo forma | Vienas sakinys: duomenis KU naudoja tik paskyrai suteikti, prašymas saugomas 90 dienų po sprendimo; nuoroda; žymimasis langelis „Susipažinau su privatumo pranešimu.“ |
| Profilio forma (pirmas prisijungimas) | Vienas sakinys: profilio duomenys naudojami paskyrai, veikloms ir apibendrintai statistikai; nuoroda; tas pats langelis |
| Prisijungimo forma | Nuoroda į pranešimą |
| Dalyvio įėjimas (kodas, QR) | Nuoroda į pranešimą |
| Komandos vardo laukas | „Sugalvokite komandos vardą be tikrų vardų ir pavardžių. Paskyros nereikia.“ ir nuoroda |
| `/privatumas` | Visas pranešimas, apie 320 žodžių: kas tvarko, ką renka, kodėl ir kokiu pagrindu, kas mato ir kam perduodama, kiek saugoma, teisės, kur kreiptis, slapukai |

## Teisinis pagrindas

**Siūloma:** viešojo intereso užduotis, BDAR 6 straipsnio 1 dalies e punktas, visiems platformos tvarkymo tikslams (paskyra, veiklos, rezultatai, DI pagalba, saugumas, statistika, pranešimai el. paštu).

Kodėl:

- KU yra valstybinis universitetas. Platforma yra nemokama KU STEAM centro švietimo paslauga mokytojams ir jų mokiniams, ne komercinė sutartis.
- Mokslo ir studijų įstatymas (Nr. XI-242) leidžia aukštajai mokyklai pasirinkti mokslo žinių sklaidos kryptis ir formas bei teikti kitas švietimo paslaugas (8 straipsnio 2 dalis) ir įpareigoja sudaryti sąlygas mokytis visą gyvenimą (10 ir 11 straipsniai). Tikrinta pagal 2025-01-01 suvestinės redakcijos kopiją; e-seimas.lrs.lt šiai sesijai nepasiekiamas.
- Sutikimas (a punktas) netinka: vedėjas negali gauti paskyros neduodamas duomenų, todėl sutikimas nebūtų laisvas, o jo atšaukimas reikštų paskyros panaikinimą. Žymimasis langelis todėl pakeistas į „Susipažinau su privatumo pranešimu“.
- Teisėtas interesas (f punktas) valdžios institucijoms, vykdančioms savo užduotis, netaikomas.
- Sutartis (b punktas) galima vedėjų paskyroms, bet netinka dalyviams ir statistikai; vienas pagrindas paprastesnis.

Pasekmės pranešime: teisė nesutikti (21 straipsnis) nurodyta; teisė į duomenų perkeliamumą netaikoma, todėl neminima.

Ko nepatikrinau: KU statuto ir STEAM centro nuostatų, kurie konkrečiai įvardytų šią veiklą. Todėl tai sprendimo klausimas Vyčiui (žr. žemiau).

## Patikrinti faktai

Faktai patikrinti kode, schemoje ir paslaugų nustatymuose 2026-11-07 ir 2026-11-08.

| Teiginys | Šaltinis |
| --- | --- |
| Valdytojas VšĮ „Klaipėdos universitetas“, kodas 211951150 | KU „Asmens duomenų saugumo pažeidimų reagavimo tvarkos aprašas“ (rektoriaus 2021-12-15 įsakymas Nr. 1-044), 2.1 p., ku.lt |
| Duomenų apsaugos pareigūnas Marius Kadelskas, dpo@ku.lt | Oficiali KU privatumo politika https://www.ku.lt/privatumo-politika; Vytis Radvila patvirtino 2026-11-08. Claude Code šio puslapio automatiškai perskaityti negali (ku.lt neleidžia automatinio skaitymo) |
| Kontaktas steam@ku.lt | Platformos laiškų atsakymo adresas (`lib/email/send.ts`), puslapiai `/laukia`, prisijungimo forma |
| Vedėjų duomenys | `profiles` stulpeliai (schema po visų migracijų), profilio forma, `lib/access/profile-fields.ts` |
| Formose pažymima „Susipažinau su privatumo pranešimu“ | `PRIVACY_ACK_TEXT` (`lib/access/profile-fields.ts`); API laukas lieka `consent`, laikas `profiles.consent_at` ir `access_requests.consent_at`. Tai patvirtinimas, kad pranešimas parodytas, ne teisinis pagrindas |
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
| Paveikslėliai ir dokumentai dabar neištrinami | Kode nėra nė vieno `storage.remove` kvietimo. Pranešimo terminas dokumentams (7 dienos) reikalauja CLS-017 (`docs/data-retention.md`) |
| Naktinis užbaigimas be trynimo | `app/api/cron/finish-stale-activities` keičia tik būseną |
| Atsarginės kopijos daromos kasdien, saugomos ribotą laiką | Supabase → Database → Backups: kasdienės fizinės kopijos. Tikslios trukmės (pagal planą) Claude Code patikrinti negali: Supabase prieiga šiai sesijai CLASSROOM projekto nerodo. Puslapyje skaičius nenurodytas |
| Paveikslėliai pagal nuorodą | Saugykla `challenge-images` vieša (`00003_challenge_media.sql`) |
| Patvirtintus šablonus mato kiti prisijungę vedėjai | Teisinga: CLS-015 migracija pritaikyta produkcijoje 2026-11-08 (PR #115). `anon` per Data API gauna 401, `pending` ir `blocked` paskyros įrašų nemato (`docs/migration-history.md`) |
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
- Netvirtiname, kad IP adreso niekur nėra. Vercel, Supabase ir Resend savo žurnaluose gali įrašyti IP adresą. Produkcijos lentelėje `auth.audit_log_entries` 2026-11-08 buvo 0 įrašų (žr. „Produkcijos patikra“), bet tai neįrodo, kad kiti paslaugų teikėjai ar Supabase žurnalai už duomenų bazės ribų IP adresų nerenka.

## Ko puslapyje neteigiame

- Resend, Anthropic ir Google duomenų tvarkymo vietos.
- Vercel tinklo taško, kuriame priimama užklausa, vietos.
- Kur paslaugų teikėjai saugo savo žurnalus ir kiek laiko.
- Kad duomenys perduodami ar neperduodami už EEE ribų. Puslapyje yra tik sąlyginis sakinys apie apsaugos priemones, ir jis laukia Vyčio patvirtinimo apie teikėjų DPA (žr. 2 punktą žemiau).
- Vercel funkcijų regiono: jis teisingas, bet vartotojui nieko nepaaiškina, o tinklo taško vietos nežinome.
- Jokių lentelių, HMAC, RLS ar kitų techninių pavadinimų: jie lieka šiame dokumente.

## Produkcijos patikra (2026-11-08)

Vytis Radvila paleido tik SELECT užklausas Supabase SQL Editor. Agreguoti rezultatai:

| Kas | Rezultatas |
| --- | --- |
| `auth.audit_log_entries` | 0 įrašų |
| `storage.objects` | 1 failas, saugykla `challenge-images`, seniausias 2026-03-02 |
| `access_requests` | 1 įrašas, seniausias 2026-11-06 |
| `ai_usage` | 0 įrašų |
| `admin_audit_log` | 3 įrašai, seniausias 2026-11-06 |
| `library_items` politika `read_approved_library` | taikoma rolei `public` |

Ką tai reiškia ir ko ne:

- 0 `auth.audit_log_entries` įrašų neįrodo, kad IP adresų nerenka kiti paslaugų teikėjai (Vercel, Resend) ar Supabase žurnalai už duomenų bazės ribų.
- Kiekiai rodo dabartinę bandomąją apimtį, ne būsimą. Saugojimo terminai vis tiek reikalingi (`docs/data-retention.md`).

Naudotos užklausos, jei patikrą reikės kartoti:

```sql
select count(*) as rows,
       count(*) filter (where coalesce(ip_address, '') <> '') as with_ip,
       min(created_at)::date as oldest
from auth.audit_log_entries;

select bucket_id, count(*) as files, min(created_at)::date as oldest
from storage.objects group by 1 order by 1;

select 'access_requests' as t, count(*), min(created_at)::date from public.access_requests
union all select 'ai_usage', count(*), min(created_at)::date from public.ai_usage
union all select 'admin_audit_log', count(*), min(created_at)::date from public.admin_audit_log;
```

Atsarginių kopijų saugojimo trukmę rodo Supabase → Database → Backups (nepatikrinta).

## Sprendimai ir kas liko

Vytis 2026-11-08 priėmė: trumpą pranešimą kaip galutinę kryptį, BDAR 6 straipsnio 1 dalies e punktą kaip teisinį pagrindą, langelį „Susipažinau su privatumo pranešimu“ ir saugojimo terminus kaip vidaus taisyklę.

Iki paskelbimo turi atitikti realų veikimą:

1. Bibliotekos sakinys: pritaikyta CLS-015 migracija (PR #115). Atlikta 2026-11-08.
2. Saugojimo terminai: kodas produkcijoje (PR #116), bet trinama tik nustačius `RETENTION_MODE=delete`. 2026-11-08 naktinis darbas paleistas `report` režimu: klaidų nėra, vykdymas pilnas, trintinas tik 1 įrašas (1 komanda su 5 atsakymais iš 2026-03-03 veiklos „Lietuvos prezidentai (kopija)“). Kol Vytis nepatvirtina jo ištrynimo, `delete` neįjungtas, todėl teiginiai apie 6 mėn. ir importuotų dokumentų trynimą dar nevykdomi.
3. Sakinys apie perdavimą už EEE: patikrinta 2026-11-08 viešose sąlygose. Visų keturių teikėjų DPA galioja priėmus pagrindines sąlygas, atskiro pasirašymo nereikia, perdavimams už EEE taikomos ES standartinės sutarčių sąlygos: Vercel (paslaugų sąlygų 11.1 p. DPA įtraukia nuoroda, https://vercel.com/legal/dpa), Supabase (DPA yra paslaugų sąlygų dalis, https://supabase.com/legal/dpa), Resend (DPA privalomas priėmus sąlygas, taip pat ES ir JAV duomenų privatumo sistema, https://resend.com/legal/dpa), Anthropic (DPA automatiškai įtrauktas į komercines sąlygas, https://privacy.claude.com/en/articles/7996862). Sakinys teisingas. DPO klausimas: paskyros pas teikėjus yra Vyčio Radvilos paskyros, ne KU vardu sudarytos sutartys.
4. Atsarginių kopijų trukmė: nebūtina pranešime, bet patikrinama Supabase → Database → Backups.

## Kaip paskelbti

1. Vytis patvirtina tekstą ir 1–6 punktus.
2. Claude Code pataiso tekstą pagal sprendimus, `lib/privacy.ts` būseną pakeičia į `approved`, atnaujina datą.
3. CI, Vercel peržiūra, sujungimas, produkcijos patikra telefone.
