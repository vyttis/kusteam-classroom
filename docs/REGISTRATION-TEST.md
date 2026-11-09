# Registracijos ir bibliotekos patikra produkcijoje (CLS-004)

Tikslas: produkcijoje (`https://pamokos.kusteam.app`) vieną kartą praeiti visą
kelią nuo paskyros prašymo iki bibliotekos moderavimo ir užrašyti įrodymus.
Kaip veikia prašymai ir laiškai, aprašyta `docs/access-and-email.md`.

Būsena: scenarijus paruoštas, **nevykdytas**. Vykdoma tik tada, kai Vytis
Radvila pateikia testinius el. pašto adresus ir atskirai leidžia vykdyti.

## Ribos

- Kol nėra testinių adresų ir atskiro leidimo, produkcijoje nekuriamos
  testinės paskyros ir nekeičiamos realių naudotojų teisės.
- Rolės keičiamos tik testinėms paskyroms. Vyčio paskyra nekeičiama.
- Prisijungimo kodus, slaptažodžius ir pašto dėžutes valdo tik žmonės.
  Claude Code jų neįveda ir negauna. Claude Code tikrina rezultatus duomenų
  bazėje tik skaitymo užklausomis, peržiūri puslapius ir pildo radinių
  lentelę. Super administratoriaus mygtukus Vyčio naršyklėje Claude Code
  spaudžia tik tada, jei Vytis tą dieną aiškiai leidžia.
- DI testo metu nenaudojamas: užduotys rašomos ranka, kad nebūtų išleistas
  DI biudžetas.
- Testas nevykdomas, kai vyksta tikros veiklos.

## Ko reikia iš Vyčio prieš vykdymą

| Nr. | Ką | Kodėl |
| --- | --- | --- |
| V1 | Du testiniai el. pašto adresai, kurių laiškus gali skaityti testuotojas: **T1** (būsimas mokytojas) ir **T2** (būsimas administratorius). Tinka du `+` adresai vienoje dėžutėje, jei paštas juos priima | Priėmimo kriterijus reikalauja moderuoti administratoriaus, ne super administratoriaus, paskyra. Kodas leidžia administratoriui tvirtinti savo paties šabloną, todėl su vienu adresu testas būtų silpnesnis |
| V2 | Atskiras leidimas pokalbyje, pavyzdžiui: „Leidžiu vykdyti CLS-004 produkcijoje su T1 … ir T2 …“ | Sprint 007 sąlyga |
| V3 | Kas atliks testuotojo veiksmus T1 ir T2 vardu (Vytis ar kitas žmogus) | Prisijungimo kodų Claude Code neįveda |
| V4 | Laikas, kai nevyksta veiklos (apie 45 min.) | Laiškai ir RLS tikrinami gyvai |
| V5 | Sprendimas, kas daroma su testinėmis paskyromis po testo: užblokuoti (galima grąžinti) ar ištrinti Supabase valdymo skydelyje | Platformoje paskyros ištrinti negalima, tik užblokuoti |

## Pasiruošimas (Claude Code, be rašymo produkcijoje)

1. `E2E smoke (production)` žalias, Vercel runtime klaidų nėra.
2. Pradinė būsena Supabase SQL Editor (tik skaitymas). Rezultatą užrašyti:

```sql
select role, status, count(*) from public.profiles group by 1, 2 order by 1, 2;
select coalesce(max(id), 0) as last_audit_id from public.admin_audit_log;
select status, count(*) from public.library_items group by 1 order by 1;
```

## Scenarijus

Testuotojas T1 ir T2 veiksmus atlieka privačiame naršyklės lange, kad
neliktų Vyčio sesijos. Kiekviename žingsnyje daroma ekrano nuotrauka.

### A. Paskyros prašymas

| Nr. | Kas | Veiksmas | Laukiamas rezultatas |
| --- | --- | --- | --- |
| A1 | T1 | `/auth/login` įveda T1 adresą ir prašo kodo | Rodoma „Paskyros nėra“. Laiškas neišsiunčiamas |
| A2 | Vytis | Administravimas → Prašymai → Prašymo nuorodos. „Kam skirta“: `CLS-004 testas`, „Galioja“: 7 dienos, „Daugiausia prašymų“: 3 → „Sukurti ir kopijuoti“ | Nuoroda sąraše. `admin_audit_log`: `request_link.create` |
| A3 | T1 | Atidaro nuorodą. Užpildo: vardas `Testas`, pavardė `CLS-004`, mokykla iš sąrašo, sutikimas. Pateikia | Rodomas patvirtinimas. T1 gauna laišką „Prašymas gautas“. Super administratoriai gauna „Naujas prašymas“. `access_requests`: viena eilutė, `source = link`, `status = pending` |
| A4 | T1 | Tą patį prašymą pateikia dar kartą | Tas pats patvirtinimas. Antro laiško nėra. Vis dar viena `pending` eilutė |
| A5 | T1 | Atidaro `/prasymas/` su pakeistu žetonu | 404 |

### B. Patvirtinimas

| Nr. | Kas | Veiksmas | Laukiamas rezultatas |
| --- | --- | --- | --- |
| B1 | Vytis | Prašymai → T1 eilutė → „Patvirtinti“ → patvirtina | Prašymas skiltyje „Patvirtinti“. `access_requests.status = approved`, `user_id` užpildytas. `admin_audit_log`: `access_request.approve` |
| B2 | Vytis | Vartotojai → T1 | Būsena aktyvi, rolė mokytojas |

### C. Kvietimo laiškas ir pirmas prisijungimas

| Nr. | Kas | Veiksmas | Laukiamas rezultatas |
| --- | --- | --- | --- |
| C1 | T1 | Atidaro kvietimo laišką | Siuntėjas `noreply@kusteam.app`, lietuviškos raidės teisingos, logotipas matomas. Nuoroda veda į `pamokos.kusteam.app`, ne į `*.vercel.app` ar `supabase.co` puslapį be peradresavimo |
| C2 | T1 | Pašto programoje atidaro laiško originalą (antraštes) | `Authentication-Results`: `spf=pass`, `dkim=pass` |
| C3 | T1 | Spaudžia „Prisijungti“ laiške, jungiasi per Google arba su kodu | `/vedejui` → `/onboarding`. Forma užpildoma, sutikimas pažymimas. Po išsaugojimo atsidaro vedėjo pradžia. `profiles.onboarding_completed = true` |
| C4 | T1 | Tą patį laišką atidaro kitą dieną | Nuoroda veda į `/vedejui` ir veikia: laiške nėra vienkartinės nuorodos, kuri pasibaigtų (nuo 2026-11-09) |
| C5 | T1 | Atsijungia. `/auth/login` prašo kodo, įveda jį | Kodo laiškas ateina, prisijungimas pavyksta |

### D. Administratoriaus vaidmuo

| Nr. | Kas | Veiksmas | Laukiamas rezultatas |
| --- | --- | --- | --- |
| D1 | Vytis | Vartotojai → „Sukurti paskyrą“: T2 adresas, rolė mokytojas → „Sukurti ir pakviesti“ | `admin_audit_log`: `account.invite`. T2 gauna kvietimą |
| D2 | T2 | Pirmas prisijungimas per kvietimą, profilio forma | Kaip C3 |
| D3 | Vytis | Vartotojai → T2 → Rolė: Administratorius → „Keisti“ → „Pakeisti rolę“ | `admin_audit_log`: `profile.role_change` iš `teacher` į `admin` |
| D4 | T2 | Atidaro `/admin` | Meniu: Apžvalga, Vartotojai, Veiklos, Moderavimas. „Prašymai“ ir „DI“ nėra |
| D5 | T2 | Atidaro `/admin/prasymai` | Grąžinama į `/admin` |
| D6 | T2 | Atidaro Vartotojai | Sąrašas matomas, rolės keitimo ir blokavimo valdiklių nėra |
| D7 | T1 | Atidaro `/admin` | Grąžinama į vedėjo pradžią |

### E. Bibliotekos moderavimas

| Nr. | Kas | Veiksmas | Laukiamas rezultatas |
| --- | --- | --- | --- |
| E1 | T1 | Sukuria veiklą „CLS-004 bibliotekos testas“ su 2 ranka parašytomis užduotimis (be DI) | Veikla sąraše |
| E2 | T1 | Veiklos puslapyje „Dalintis bibliotekoje“ → užpildo → pateikia | Biblioteka → „Mano pateikimai“: „Laukia peržiūros“. `library_items`: `status = pending_review`, `published_by` = T1 |
| E3 | T2 | Administravimas → Moderavimas (skaičius rodo 1) → „Laukia“ → šablonas → „Atmesti“ su pastaba `ok` | „Parašykite autoriui, ką pataisyti (bent 5 ženklai).“ Būsena nesikeičia |
| E4 | T2 | „Atmesti“ su pastaba `Trūksta užuominos antrai užduočiai` | Šablonas skiltyje „Atmesti“. `status = rejected`, `reviewed_by` = T2 |
| E5 | T1 | „Mano pateikimai“ | Atmestas, matoma T2 pastaba |
| E6 | T2 | „Atmesti“ → šablonas → „Grąžinti peržiūrai“, tada „Laukia“ → „Patvirtinti“ | `status = approved`, `reviewed_by` = T2, `reviewed_at` užpildytas |
| E7 | T1 | Biblioteka → šablonas → „Naudoti šabloną“ | Sukuriama veiklos kopija. `clone_count` padidėja 1 |

## Įrodymai

Ekrano nuotraukos: A1, A3, B1, C1, C3, C4, D3, D5, E3, E4, E6.

Duomenų bazė (tik skaitymas; `<last_audit_id>` iš pasiruošimo, adresai
įrašomi tik užklausoje, į ataskaitą ir repozitoriją nekeliami):

```sql
select id, action, target_type, details, created_at
from public.admin_audit_log where id > <last_audit_id> order by id;

select source, status, reviewed_at is not null as reviewed, user_id is not null as has_user
from public.access_requests where email = '<T1>';

select role, status, onboarding_completed from public.profiles where email in ('<T1>', '<T2>');

select l.status, l.reviewed_at, l.clone_count, pb.email = '<T1>' as by_t1, rv.email = '<T2>' as reviewed_by_t2
from public.library_items l
left join public.profiles pb on pb.id = l.published_by
left join public.profiles rv on rv.id = l.reviewed_by
where l.title = 'CLS-004 bibliotekos testas';
```

Laukiami `admin_audit_log` veiksmai eilės tvarka: `request_link.create`,
`access_request.approve`, `account.invite`, `profile.role_change`.
Bibliotekos moderavimas į šį žurnalą nerašomas, jo įrodymas yra
`library_items.reviewed_by` ir `reviewed_at`.

Laiškų pristatymą Vytis gali patikrinti Resend skydelyje (Emails), Supabase
siunčiamus kvietimus ir kodus taip pat, nes Supabase Auth siunčia per Resend
SMTP.

## Po testo

Pagal Vyčio sprendimą V5:

1. Veiklos kopiją ir bandomąją veiklą T1 ištrina savo vedėjo aplinkoje.
2. Šabloną Vytis pašalina: Administravimas → Moderavimas → „Pašalinti“
   (tik super administratorius).
3. Prašymo nuorodą Vytis atšaukia: Prašymai → Prašymo nuorodos → „Atšaukti“.
4. T1 ir T2 paskyras Vytis užblokuoja (Vartotojai → „Užblokuoti“) arba ištrina
   Supabase → Authentication → Users. Jei paskyros paliekamos regresijos
   testams, jos lieka užblokuotos.
5. Claude Code dar kartą paleidžia pradinės būsenos užklausas ir palygina:
   realių paskyrų rolės ir būsenos nepakito.
6. Rezultatas įrašomas į `STATUS.md`, radiniai į `BACKLOG.md` (CLS skyrius).

## Ko šis testas neįrodo

- Pristatymo į kitus pašto tiekėjus (Gmail, Outlook, mokyklų paštas).
  Tikrinama tik testinės dėžutės tiekėjas.
- Prašymų pro veiklos pabaigos ekraną ir veiklos QR. Šios durys tikrinamos
  piloto metu (`docs/PILOT.md`).
- Prisijungimo per Google. Naujų paskyrų per Google nėra (`disable_signup`),
  o esamos paskyros prisijungimas nuo el. pašto nepriklauso.

## Iš kodo matomi pastebėjimai

Rasti ruošiant scenarijų, įrašomi į backlogą, šiame sprinte netaisomi:

- Bibliotekos moderavimas nerašomas į `admin_audit_log`.
- Administratorius gali patvirtinti savo paties pateiktą šabloną.

## Radinių lentelė

| Nr. | Kas nutiko | Laukta | Ar blokuoja pilotą |
| --- | --- | --- | --- |
| | | | |
