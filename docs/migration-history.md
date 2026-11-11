# Migracijų istorija ir perėjimas prie Supabase CLI

## Dabartinė būklė (patikrinta 2026-11-07, tik skaitymas)

Migracijos produkcijoje taikomos rankiniu būdu per Supabase SQL Editor. CLI istorijos lentelė yra, bet tuščia:

```sql
select count(*) from supabase_migrations.schema_migrations;  -- 0
```

Produkcija veikia Postgres 17.6. Repozitorijoje 35 migracijų failai. Iki 2026-11-07 buvo 34 skirtingos versijos, nes `00007` kartojosi; dabar 35 (žr. žemiau).

Produkcijos schema palyginta su tuščia Postgres, kurioje pritaikyti visi 35 failai. Palyginimo užklausa: `supabase/tests/schema-fingerprint.sql` (žr. „Schemos atspaudas“).

| Sritis | Objektų | Rezultatas |
| --- | --- | --- |
| Lentelės ir sekos | 18 | sutampa |
| Stulpeliai | 186 | sutampa |
| Apribojimai | 85 | sutampa |
| Indeksai | 32 | sutampa |
| RLS politikos (`public` ir `storage.objects`) | 57 | sutampa |
| Trigeriai | 11 | sutampa |
| Realtime lentelės | 5 | sutampa |
| Stulpelių teisės | 50 | sutampa |
| Funkcijų vykdymo teisės | 53 | sutampa |
| Lentelių teisės | 42 | sutampa. Lyginant su Postgres 16 skyrėsi tik Postgres 17 teisė `MAINTAIN`; su Postgres 17 (CLS-012) sutampa visiškai |
| Funkcijos | 26 | 25 sutampa, `handle_new_user()` skiriasi |

`handle_new_user()` produkcijoje pakeista ranka, ne migracija:

- Produkcijoje naujam naudotojui su Vyčio asmeniniu Gmail adresu iškart įrašomas vaidmuo `super_admin`, kitiems `teacher`. Vardas imamas iš `full_name` arba `name`.
- Failuose (`00002`) vaidmuo neįrašomas (lieka stulpelio numatytasis `teacher`). Vardas imamas iš `full_name` arba lieka tuščia eilutė.
- Nuo `20261106130000` naujos paskyros gauna `pending`, o `get_my_role()` neaktyviai paskyrai grąžina `teacher`. Todėl automatinis `super_admin` neveikia, kol paskyros nepatvirtina administratorius.

Kurią versiją palikti, sprendžia Vytis. Pasiūlymas ir testai: skyrius „CLS-011“ žemiau. Istorijos sutvarkymui tai netrukdo: visi failai produkcijoje pritaikyti, funkcija pakeista vėliau.

Išvada: produkcijos schema atitinka visas 35 migracijas, bet CLI to nežino. Todėl:

- **Nenaudoti `supabase db push`, kol neatlikta žemiau aprašyta procedūra.** Jis bandytų taikyti visą seką iš naujo.
- **Niekada nenaudoti `db push --include-all`.** Jis iš naujo vykdytų jau pritaikytus failus.
- Naujos migracijos taikomos rankiniu būdu, kaip iki šiol (`BEGIN; … COMMIT;` per SQL Editor).

## Dubliuota versija `00007` (sutvarkyta repozitorijoje)

Iki 2026-11-07 du failai turėjo tą pačią versiją:

| Failas | Ką daro | Priklausomybės |
| --- | --- | --- |
| `00007_bcrypt_answer_hash.sql`, dabar `000071_bcrypt_answer_hash.sql` | įjungia `pgcrypto`, perrašo `check_answer` | `00018` naudoja `gen_salt()` ir `crypt()` iš `pgcrypto`. `00025` prisega `search_path` visoms tuo metu esamoms funkcijoms |
| `00007_di_verification_columns.sql` | prideda `generated_by_di` ir `verification_*` stulpelius | turi būti prieš `00018` (CHECK ant `verification_confidence`) |

Supabase CLI versiją laiko `schema_migrations` pirminiu raktu ir versijas lygina kaip tekstą. Su dviem `00007` failais CLI 3.0.0 vietinėje kopijoje elgėsi taip:

- `migration repair --status applied` įrašė 34 eilutes, ne 35.
- `migration list` vieną `00007` paliko be atitikmens.
- `db push --dry-run` sustojo: „Found local migration files to be inserted before the last migration on remote database“ ir pasiūlė `--include-all`.

Pervadinti į `00026` netiko: tuščioje DB `00018` lūžta (`function gen_salt(unknown, integer) does not exist`), o `check_answer` netenka `search_path`, nes `CREATE OR REPLACE` po `00025` jį nuima.

Failas pervadintas į `000071_bcrypt_answer_hash.sql`, turinys nepakeistas. Pagal failo vardą ir pagal CLI versijų tvarką jis lieka tarp `00006` ir `00008`. `test:db` su Postgres 17 duoda tą patį schemos atspaudą kaip prieš pervadinimą, `check_answer` išlaiko `search_path`. `test:db` dabar rikiuoja failus baitų tvarka (`LC_COLLATE=C`), kaip CLI. `tests/migration-versions.test.ts` neleidžia pasikartojančių versijų.

Produkcijos tai nekeičia: istorija tuščia, o failo turinys jau pritaikytas.

## Sutvarkymo procedūra

Repozitorijos dalis atlikta (žr. žemiau, 1 žingsnis). Į produkcijos `supabase_migrations.schema_migrations` rašoma tik su atskiru Vyčio patvirtinimu, ir rašo pats Vytis. Claude Code produkcijoje vykdo tik skaitymo patikras.

### Ką rašymas keičia ir ko nekeičia

- Keičia: į `supabase_migrations.schema_migrations` įrašomos 37 eilutės (versija, vardas, failo sakiniai; 2026-11-07 buvo 35, vėliau pridėtos `20261108120000` ir `20261109111400`). Lentelė jau yra ir dabar tuščia.
- Nekeičia: `public`, `auth`, `storage` schemų, duomenų, teisių, funkcijų. Jokia migracija nevykdoma.
- Grąžinimas: lentelė vėl ištuštinama (žr. „Grąžinimas“). Kadangi prieš rašymą ji tuščia, tai tiksli ankstesnė būsena.

### Repetuota 2026-11-07

Vietinė Postgres 17.6 su produkcijos schemos kopija (visų failų replay ir `handle_new_user()` produkcijos versija su netikru el. pašto adresu), tuščia istorija, šios repozitorijos `supabase/config.toml`, CLI 3.0.0 su `--remote=<vietinės DB adresas>`:

| Žingsnis | Rezultatas |
| --- | --- |
| `migration list` | 35 vietinės eilutės, nuotolinių 0 |
| `migration repair --status applied` (be versijų) | 35 eilutės, 35 skirtingos versijos |
| `migration list` | visos 35 sutampa |
| `db push --dry-run` | „Remote database is up to date.“ |
| Schemos atspaudas | toks pat kaip prieš rašymą |
| `migration repair --status reverted` (be versijų) | 0 eilučių |
| Tas pats su 35 aiškiai nurodytomis versijomis | tas pats rezultatas |

Nerepetuota, nes reikia Vyčio prisijungimo: `supabase login`, `supabase link` ir `--remote` be adreso, nukreiptas į tikrą projektą.

### CLI 3.0.0 pagalba (patikrinta 2026-11-07)

- `npm view supabase dist-tags`: `latest` 3.0.0. Procedūroje versija prisegta: `npx supabase@3.0.0`.
- `migration list`, `migration repair`, `db push`: „Local by default. Pass --remote for the linked project, or --remote=<ref|branch|url>.“ Be `--remote` komanda dirba su vietine DB.
- `migration repair [<version...>]`, `--status applied|reverted`, `--password`. Be versijų keičia visą istoriją.
- `db push --dry-run`: tik parodo, ką taikytų. `--include-all` nenaudoti.
- `link [<ref-or-branch>]`: „Remote only“.

Prieš vykdymą dar kartą paleisti `npx supabase@3.0.0 migration repair --help` ir palyginti su šiuo sąrašu. Jei skiriasi, sustoti.

### 1. Repozitorija (atlikta, produkcijos nekeičia)

- `00007_bcrypt_answer_hash.sql` → `000071_bcrypt_answer_hash.sql`.
- `supabase/config.toml`: `[inbucket]` → `[local_smtp]`. Su senu vardu CLI 3.0.0 nepasileidžia („[inbucket] in supabase/config.toml is no longer supported“).
- `tests/migration-versions.test.ts`: jokių pasikartojančių versijų.

### 2. Patikra prieš rašymą (tik skaitymas, SQL Editor)

```sql
select count(*) from supabase_migrations.schema_migrations;               -- 0
select count(*) from public.games where status in ('active', 'paused');  -- 0
```

Paleisti `supabase/tests/schema-fingerprint.sql`. Produkcijos rezultatas turi sutapti su `supabase/tests/schema-fingerprint.expected` visose srityse, išskyrus `function` (CLS-011). Jei nesutampa, sustoti.

### 3. Įrašyti istoriją (vykdo Vytis savo kompiuteryje)

Repozitorijos šaknyje, `main` šakoje. `link` paprašys DB slaptažodžio arba jį galima nurodyti `--password`.

```bash
npx supabase@3.0.0 login
npx supabase@3.0.0 link --project-ref menmndjyfeuwfweubwnl
npx supabase@3.0.0 migration repair --help        # palyginti su skyriumi „CLI 3.0.0 pagalba“
npx supabase@3.0.0 migration list --remote        # Remote stulpelis tuščias, 37 Local eilutės
npx supabase@3.0.0 migration repair --status applied --remote
```

CLI parodys planą („Replace the migration history table with 37 local migrations“) ir paprašys patvirtinti. Jei skaičius ne 37 (arba ne tiek, kiek tuo metu yra `supabase/migrations/` failų), atsisakyti. Versijas galima nurodyti ir aiškiai:

```bash
npx supabase@3.0.0 migration repair --status applied --remote \
  00001 00002 00003 00004 00005 00006 00007 000071 00008 00009 00010 \
  00011 00012 00013 00014 00015 00016 00017 00018 00019 00020 \
  00021 00022 00023 00024 00025 \
  20261106120000 20261106130000 20261106140000 20261106145000 \
  20261106150000 20261106160000 20261106170000 20261107100000 20261107120000 \
  20261108120000 20261109111400
```

### 4. Patikra po rašymo

```bash
npx supabase@3.0.0 migration list --remote          # Local ir Remote sutampa visose 37 eilutėse
npx supabase@3.0.0 db push --dry-run --remote       # „Remote database is up to date.“
```

SQL Editor: `select count(*) from supabase_migrations.schema_migrations;` turi grąžinti 37. Schemos atspaudas nepasikeitęs. Claude Code gali patikrinti tik skaitydamas.

### Grąžinimas

Prieš rašymą lentelė tuščia, todėl grąžinimas ją vėl ištuština. Schema nuo to nesikeičia.

```bash
npx supabase@3.0.0 migration repair --status reverted --remote   # be versijų išvalo visą istoriją
```

Arba SQL Editor: `delete from supabase_migrations.schema_migrations;`.

### Po sutvarkymo

Naują migraciją galima taikyti dviem būdais, abu tik su Vyčio patvirtinimu:

- kaip iki šiol per SQL Editor, o tada `migration repair --status applied --remote <versija>`;
- `db push --dry-run --remote`, tada `db push --remote`.

Kol istorija nesutvarkyta, taikyti tik rankiniu būdu.

## CLS-011: `handle_new_user()` be vaidmens pagal el. paštą (pasiūlymas, laukia sprendimo)

Produkcijos funkcija kol kas nekeičiama. Pasiūlymas yra `supabase/proposals/cls-011-handle-new-user/`: `up.sql`, `down.sql`, `test.sql`. Supabase CLI šio katalogo nemato, į produkciją jis nepatenka.

### Skirtumas

| | Produkcija (pakeista ranka) | Failai (`00002`) | Pasiūlymas |
| --- | --- | --- | --- |
| Vaidmuo | `super_admin` vienam Vyčio asmeniniam Gmail adresui, kitiems `teacher` | neįrašomas, stulpelio numatytasis `teacher` | neįrašomas, numatytasis `teacher` |
| Būsena | stulpelio numatytoji `pending` | `pending` | `pending` |
| Vardas | `full_name`, tada `name`, kitaip NULL | `full_name`, kitaip tuščia eilutė | `full_name`, tada `name`, kitaip tuščia eilutė |
| `search_path`, SECURITY DEFINER, teisės | prisegtas, taip, nekeistos | tas pats | tas pats, `search_path` nurodytas pačiame apibrėžime |

### Kodėl atsisakyti el. pašto taisyklės

- Vaidmuo suteikiamas aplenkiant administravimo skydelį. `admin_audit_log` apie tai neįrašo nieko.
- Laukiančią paskyrą patvirtinus (`/admin/prasymai` arba paskyros būsenos keitimas), ji tampa aktyvi jau su `super_admin`. Tvirtinantis administratorius vaidmens nesuteikia ir gali to nepastebėti.
- Teisė priklauso nuo vieno išorinio el. pašto adreso. Asmeninis adresas įrašytas į DB funkciją, o repozitorijoje jo nėra, todėl funkcija ir failai išsiskiria.
- Esami profiliai nesikeičia: taisyklė veikia tik kuriant naują `auth.users` įrašą.

### Aiškus teisių suteikimo procesas (jau veikia programoje)

1. Žmogus prisijungia arba pateikia paskyros prašymą. Profilis gauna `teacher` ir `pending`.
2. `super_admin` patvirtina prašymą (`access_request.approve`) arba pakviečia (`account.invite`, `account.activate`). Abu įrašomi į `admin_audit_log`.
3. Vaidmenį keičia tik `super_admin` per `/admin/users` (`PATCH /api/admin/users`). Savo vaidmens keisti negalima. Kiekvienas pakeitimas įrašomas kaip `profile.role_change` su ankstesniu ir nauju vaidmeniu.
4. Avarinis būdas, tik jei neliktų nė vieno aktyvaus `super_admin`. Savininkas SQL Editor vienoje transakcijoje pakeičia vaidmenį ir įrašo, kas padaryta:

```sql
begin;
update public.profiles set role = 'super_admin', status = 'active' where id = '<profilio id>';
insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
values ('<profilio id>', 'profile.role_change', 'profile', '<profilio id>', '{"to": "super_admin", "via": "sql-editor"}');
commit;
```

### Ką daro pasiūlymas

- `up.sql` pirmiausia išsaugo dabartinį funkcijos apibrėžimą į `backup_cls011.handle_new_user`. Jei kopija jau yra, `up.sql` nepavyksta ir nieko nekeičia. Tada funkcija perrašoma pagal lentelę viršuje.
- `down.sql` grąžina išsaugotą apibrėžimą. Produkcijoje tai būtų ranka pakeista versija, tiksliai tokia, kokia buvo. El. pašto adresas į repozitoriją nepatenka.
- `test.sql` tikrina: SECURITY DEFINER ir prisegtą `search_path`; funkcijoje nėra el. pašto adresų ir administratoriaus vaidmenų; naujas vartotojas su savininko tipo adresu gauna `teacher` ir `pending`; `full_name` pirmenybę prieš `name`; be vardų lieka tuščia eilutė.

### Patikrinta lokaliai (Postgres 17.6)

| Patikra | Rezultatas |
| --- | --- |
| `test:db`: migracijos, `up.sql`, `test.sql`, `down.sql` | praeina; po `down.sql` funkcija tokia pati kaip prieš `up.sql` |
| `test.sql` produkcijos kopijoje prieš `up.sql` | krenta: „handle_new_user must not grant roles by email address“ |
| `test.sql` dabartinėje failų versijoje | krenta: nėra `name` atsarginio varianto |
| `up.sql`, `test.sql`, `down.sql` produkcijos kopijoje | praeina; `down.sql` grąžina tiksliai tą patį apibrėžimą (md5 sutampa), teisės nepakitę |
| Pakartotinis `up.sql` | nepavyksta (`backup_cls011.handle_new_user` jau yra), funkcija nekeičiama |
| Atspaudas po `up.sql` | failų replay ir produkcijos kopija sutampa: `function` 26 `9d3d3d665d481c8ed0139cf81b8bd8f1`, `grant.function` nepakitęs |

Produkcijos kopija čia reiškia failų replay su ranka pakeista funkcija, kurioje vietoj tikro adreso įrašytas netikras.

### Prieš sprendimą: produkcijos patikra (tik skaitymas)

Užklausa neįrašo adreso, ji paima jį iš pačios funkcijos:

```sql
with f as (
  select substring(prosrc from $re$NEW.email = '([^']+)'$re$) as e
  from pg_proc where proname = 'handle_new_user' and pronamespace = 'public'::regnamespace
)
select
  (select count(*) from public.profiles where role = 'super_admin' and status = 'active') as active_super_admins,
  (select string_agg(p.role || '/' || p.status, ',') from public.profiles p, f where lower(p.email) = lower(f.e)) as email_profile,
  (select count(*) from auth.users u, f where lower(u.email) = lower(f.e)) as email_auth_users,
  (select count(*) from public.admin_audit_log where action = 'profile.role_change') as role_changes_logged;
```

Laukiama: `active_super_admins` bent 1. Jei adreso paskyra jau yra, taisyklė jai nebeturi įtakos, o pasiūlymas jos vaidmens nekeičia.

### Taikymo planas, kai Vytis patvirtins

1. PR: `up.sql` → `supabase/migrations/<laikas>_handle_new_user_without_email_role.sql`, `down.sql` → `supabase/rollback/<tas pats>.sql`, `test.sql` → `supabase/tests/`, paleidžiamas `test:db`. `schema-fingerprint.expected` eilutė `function` → `29|5ca910befaa9bd9e02e87cc93e03d058` (failų replay su TEAM-001 ir šiuo pasiūlymu; iki TEAM-001 buvo `26|9d3d3d665d481c8ed0139cf81b8bd8f1`). Proposal etapas iš `test-db.sh` pašalinamas.
2. Prieš taikymą (tik skaitymas): aukščiau esanti užklausa, 0 vykstančių veiklų.
3. Taikymas produkcijoje: SQL Editor, visas failas, arba `db push --remote` po CLS-005. Jei per SQL Editor ir CLS-005 jau atliktas: `migration repair --status applied --remote <laikas>`.
4. Po taikymo: atspaudas `function` 29 `5ca910befaa9bd9e02e87cc93e03d058`, kitos sritys nepakitusios; `select count(*) from backup_cls011.handle_new_user` lygu 1.
5. Grąžinimas: rollback failas (tas pats kaip `down.sql`).

## TEAM-006: KU STEAM TEAM prisijungimas veiklose (taikyta produkcijoje 2026-11-09, failai dar pasiūlymo kataloge)

Failai `supabase/proposals/team-006-sso/`: `up.sql`, `test.sql`, `down.sql`. Sprendimas ir sutartis: `kusteam-ai-lab` `docs/ADR-001-TEAM-SSO.md`, `docs/TEAM-SSO-INTEGRATION-CONTRACT.md` (v1). Produkcijoje taikomas tik su Vyčio patvirtinimu, nevykstant veikloms, su kasdiene kopija; po to tampa migracija ir atnaujinamas `schema-fingerprint.expected`.

Ką prideda:

- `team_sso_codes`, `team_sso_sessions`: vienkartiniai kodai (tik sha256, 60 s, susieti su klientu, nariu, TEAM sesija ir PKCE) ir jais atidarytos veiklų sesijos. Klientų rolės jų nemato; rašo ir skaito tik service role.
- Funkcijos (tik `service_role`): `team_sso_access`, `team_sso_issue_code` (iki 20 kodų per minutę nariui), `team_sso_redeem_code` (kodas sudeginamas prieš bet kokią kitą patikrą, pakartotinis panaudojimas užbaigia pirmąją sesiją), `team_sso_session_status` (kiekvieną kartą skaičiuojama iš gyvų duomenų: narys, teisė, TEAM sesija `auth.sessions`, galiojimas, atšaukimas), `team_sso_link_client_session`, `team_sso_revoke`.
- `profiles.role` reikšmė `staff`: KU STEAM darbuotojas CLASSROOM aplinkoje, kuriamas tik TEAM prisijungimo metu. Ją nustatyti ar nuimti gali tik service role (trigeris `protect_staff_role`). `skip_profile_for_team_users()` praleidžia `staff` profilį, automatinis `teacher` profilis TEAM naudotojui vis dar nekuriamas.
- `team_staff_access_ok()` ir RESTRICTIVE politika „TEAM staff only through an active TEAM sign-in“ visoms CLASSROOM lentelėms su RLS (išskyrus `profiles` ir `team_*`) ir `storage.objects`: `staff` užklausa atmetama, jei jos Supabase sesija nesusieta su aktyvia SSO sesija. Kitiems (mokytojams, administratoriams) funkcija grąžina `true`, todėl jiems nieko nesikeičia.

- `team_sessions` ir `team_register_session`: TEAM registruoja tik savo slaptažodžiu sukurtas sesijas. Kitur sukurta to paties žmogaus sesija (pvz. CLASSROOM, kurią CLASSROOM sukuria darbuotojui) niekada nėra TEAM sesija ir veiklų neatidaro (nepriklausomos peržiūros P1).
- Trigeriai `team_sso_revoke_on_grant_removal` ir `team_sso_revoke_on_block`: teisės atėmimas ir blokavimas užbaigia veiklų sesijas toje pačioje transakcijoje. Atšaukiant CLASSROOM SSO sesiją ištrinama ir jos CLASSROOM Supabase sesija (kartu su atnaujinimo žetonais).
- `is_active_account()` ir `can_read_game()` papildytos ta pačia `staff` taisykle: SECURITY DEFINER funkcijos (`get_game_stats`, `get_game_reflections`, `moderate_team`), kurios apeina RLS, neleidžia atšaukto darbuotojo (nepriklausomos peržiūros P0). Testas tikrina, kad kiekviena `authenticated` kviečiama SECURITY DEFINER funkcija turi šią taisyklę arba yra sąmoningai išimtis.
- Kodų riba: 20 per minutę nariui ir veiklai.

Ko nekeičia: Supabase Auth nustatymų, `handle_new_user()` (CLS-011 atskiras sprendimas), mokytojų duomenų.

Patikrinta (`npm run test:db`): klientų rolės SSO lentelių ir funkcijų nepasiekia; kodų išdavimas pagal teisę, blokavimą, narystę, TEAM sesiją ir ribą; neteisingas PKCE, svetimas, pasibaigęs ir pakartotinis kodas atmetami; sesijos būsena seka teisę, blokavimą, TEAM atsijungimą, galiojimą ir atšaukimą; mokytojas negali tapti `staff`, `staff` negali pakeisti savo vaidmens; `staff` mato tik savo veiklas ir tik per susietą sesiją; atėmus teisę ar baigus TEAM sesiją duomenys iš karto neprieinami; kiekviena lentelė su RLS turi taisyklę arba yra sąmoningai išskirta. `down.sql` grąžina visą schemos atspaudą į buvusį.

Grąžinimas (`down.sql`): pirmiausia ištrinamos per TEAM sukurtos CLASSROOM sesijos, `is_active_account()` ir `can_read_game()` grąžinamos į ankstesnes, SSO lentelės ir funkcijos pašalinamos, `staff` profiliai tampa užblokuotais `teacher` profiliais (jų veiklos lieka, niekas jomis nesinaudoja, kol administratorius nenuspręs).

### Produkcinis taikymas (procedūra; atlikta 2026-11-09, žr. žemiau)

Tik su atskiru Vyčio leidimu. Visa paleidimo seka kartu su jungikliais ir ribotu bandymu: `kusteam-ai-lab` `docs/TEAM-SSO-LAUNCH.md`.

Failai SQL Editor (kiekvienas paleidžiamas visas):

- `up.sql` (SHA-256 `275048f94f9de990e8582b6021e653f47c8448cf0e31deff6337c45f8d32ccd8`): pats pakeitimas, viena transakcija. `SET LOCAL lock_timeout = '5s'`: jei kurios nors lentelės užrakto nepavyksta gauti per 5 s, visas pakeitimas nutraukiamas ir atšaukiamas (klaida 55P03, „canceling statement due to lock timeout“). Kol jis laukia, jau užrakintos lentelės (pvz. `games`, `teams`, `submissions`) irgi laukia, todėl užklausos gali stabtelėti iki 5 s, ne ilgiau.
- `apply-check.sql`: vykdo lygiai tas pačias `up.sql` eilutes viename bloke ir patikrina rezultatą, tada vykdo lygiai tas pačias `down.sql` eilutes ir patikrina ir tą būseną, todėl grąžinimas įrodomas dar prieš taikymą. Baigiasi klaida specialiai, Postgres viską atšaukia. Laukiama klaida: `TEAM-006 apply dry run OK: applied [tables 3, functions 11, exposed 0, staff rule 2, policies 16, uncovered 0, storage t, triggers 3, role check t, staff profiles 0, auth sessions t, function bodies t, teacher N/N active]; rolled back [tables 0, functions 0, staff rule 0, policies 0, triggers 0, role check t, staff profiles 0, TEAM-001 t, profile guard t, function bodies t, teacher N/N active]`.
- `verify.sql`: tos pačios patikros jau pritaikius `up.sql`. Laukiama `TEAM-006 verify OK: ...` su tais pačiais skaičiais kaip `applied [...]`.
- `rollback-check.sql`: vykdo `down.sql` eilutes ir viską atšaukia. Laukiama `TEAM-006 rollback dry run OK: ...` kaip `rolled back [...]`.
- `fingerprint-after.expected`: schemos atspaudas po `up.sql`.

Ką tikrina patikros: lenteles ir RLS, funkcijas ir kad klientų rolės jų nekviečia (išskyrus `team_staff_access_ok()` mokytojams), `staff` taisyklę `is_active_account()` ir `can_read_game()`, kad kiekviena lentelė su RLS turi naują politiką (`storage.objects` taip pat), trigerius, `profiles_role_check`, kad `postgres` gali skaityti ir trinti `auth.sessions`, kad visų sukurtų ir pakeistų funkcijų tekstas tiksliai toks, kaip peržiūrėtas (md5, `checks/*.md5`), ir kad tikras šios bazės mokytojas per RLS mato visas savo veiklas ir yra aktyvus. `teacher none` reiškia, kad nėra su kuo palyginti: produkcijoje tai sustojimo sąlyga.

Patikros failus sukuria `scripts/team-006-checks.sh` iš `up.sql` ir `down.sql`; jis atsisako, jei tose eilutėse yra `COMMIT`, `ROLLBACK` ar kita transakcijos komanda. `npm run test:db` patikras perkuria ir lygina, paleidžia kiekvieną, tikrina, kad schema nepasikeitė, o Postgres 17 lygina atspaudą po `up.sql` su `fingerprint-after.expected`. Patikros pagauna dingusią politiką, klientų rolei atvertą funkciją ir mokytoją, nebematantį savo veiklų (išbandyta vietoje). Nepriklausoma peržiūra 2026-11-09: P0 nėra; P1 ir P2 pastabos pataisytos šiame PR.

Eiga:

1. Sąlygos: Vyčio leidimas šiam žingsniui; jungikliai išjungti (`TEAM_SSO_CLIENTS` TEAM, `TEAM_SSO_ENABLED` CLASSROOM ir WATER LAB); Database > Backups: paskutinė kasdienė kopija ne senesnė nei 24 h; nevyksta veiklos: `select count(*) from public.games where status in ('active', 'paused');` grąžina 0.
2. `supabase/tests/schema-fingerprint.sql`: visos sritys kaip `schema-fingerprint.expected`, o `function` `29|d454994ddc3688e3d4e60dcd90e49082` (žinomas skirtumas, CLS-011). Kitaip sustoti.
3. `apply-check.sql`: laukiama `... apply dry run OK ...`. `FAILED`, `teacher none` ar kita klaida: sustoti, niekas nepakito.
4. `up.sql`: „Success. No rows returned“. Klaida reiškia, kad niekas nepritaikyta. Jei SQL Editor po klaidos rašo „current transaction is aborted“, pirmiausia paleisti `ROLLBACK;`. Dėl 55P03 (užraktas) galima vieną kartą pakartoti po 10 min.; antrą kartą sustoti.
5. `verify.sql`: `... verify OK ...`. Atspaudas: visos sritys kaip `fingerprint-after.expected`, o `function` turi būti `40|...` (md5 kitoks dėl CLS-011; funkcijų tekstus patikrino `verify.sql`).
6. `rollback-check.sql`: `... rollback dry run OK ...`.
7. CLASSROOM `E2E smoke (production)` paleistas rankiniu būdu žalias, Vercel runtime klaidų nėra, Vytis prisijungia kaip mokytojas ir mato savo veiklas.
8. Jei 5–7 nepavyksta: grąžinimas (žemiau; jis jau įrodytas 3 žingsnyje) ir sustoti.
9. Pasiūlymas tampa migracija `<taikymo laikas>_team_sso.sql`, `down.sql` tampa `supabase/rollback/` failu, `schema-fingerprint.expected` atnaujinamas pagal `fingerprint-after.expected`, įrašas čia.

Jungikliai po šio žingsnio dar išjungti: elgsena visiems lieka tokia pati (patikrinta: mokytojai, veiklos, dalyviai, TEAM). Nuo šio momento TEAM registruoja naujai prisijungusių darbuotojų sesijas.

Grąžinimas produkcijoje: pirmiausia išjungiami jungikliai (`TEAM-SSO-LAUNCH.md` 4 skyrius), tada `rollback-check.sql`, `down.sql` ir atspaudas: visos sritys kaip `schema-fingerprint.expected`, `function` `29|d454994ddc3688e3d4e60dcd90e49082`. `down.sql` ištrina visas darbuotojų (`staff`) Supabase sesijas, taip pat ir jų TEAM sesijas, todėl jie prie TEAM prisijungia iš naujo; `staff` profiliai tampa užblokuotais `teacher`. Mokytojai, veiklos ir dalyviai nepaliečiami (patikrinta kryžminiame bandyme).

Skubiai nutraukti visas darbuotojų veiklų sesijas be grąžinimo. Paleisti, **kol jungikliai dar įjungti**: CLASSROOM sesijos baigiasi iš karto, WATER LAB pultas per 45 s (jis sužino iš TEAM). Jei TEAM jau išjungtas veiklai, WATER LAB to nesužinos; tada WATER LAB prieigą iš karto baigia WATER LAB `TEAM_SSO_ENABLED` išjungimas.

```sql
SELECT sum(public.team_sso_revoke(user_id, 'logged_out'))
FROM (SELECT DISTINCT user_id FROM public.team_sso_sessions WHERE revoked_at IS NULL) s;
```

### Taikyta produkcijoje 2026-11-09

Vyčio sąlyginis leidimas tik A etapui (DB): taikyti, jei visos patikros žalios ir nevyksta veiklos. Jungikliai neįjungti. Vykdė Claude Code, SQL Editor, `postgres`. Kiekvieno paleisto failo SHA-256 redaktoriuje sutapo su `main` (`4d41564`).

| Žingsnis | Laikas (UTC) | Rezultatas |
| --- | --- | --- |
| Veiklos ir atspaudas, 1 kartas | 21:00 | aktyvių ar pristabdytų 0; atspaudas kaip `schema-fingerprint.expected`, `function` `29\|d454994ddc3688e3d4e60dcd90e49082` (CLS-011) |
| `apply-check.sql`, 1 kartas | ~21:03 | `FAILED` tik dėl `teacher none` abiejose dalyse, kitos reikšmės laukiamos. Visos 34 veiklos priklausė vienai `super_admin` paskyrai, mokytojai veiklų neturėjo. Sustota; patikrinta, kad DB nepakito |
| Bandomoji veikla | 21:13 | Vyčio sprendimu (patikra nekeičiama) jo testinei mokytojo paskyrai įrašytas juodraštis „TEAM-006 patikra“, kodas `TEAM06`, id `eca62401-d924-48f8-bddd-bf660bbc6e74`. Įrašyta SQL užklausa, nes agentas į paskyras neprisijungia |
| Atsarginė kopija | 21:13 | paskutinė kasdienė (PHYSICAL) 2026-11-08 23:41, 21 h 32 min, atkūrimas galimas |
| Veiklos ir atspaudas, 2 kartas | 21:14, 21:16 | aktyvių ar pristabdytų 0 (paskutinis dalyvio veiksmas 2026-11-08 13:09); atspaudas toks pat kaip 1 kartą |
| `apply-check.sql`, 2 kartas | 21:15 | `OK`, abiejose dalyse `teacher 1/1 active` |
| `up.sql` | ~21:17 | `Success. No rows returned` |
| `verify.sql` | ~21:17 | `TEAM-006 verify OK`, `teacher 1/1 active` |
| Atspaudas po | ~21:18 | kaip `fingerprint-after.expected`, `function` `40\|1f98d3c00fb11c1193271d57751b066d` (md5 kitoks dėl CLS-011) |
| `rollback-check.sql` | ~21:18 | `TEAM-006 rollback dry run OK`, `teacher 1/1 active`; po jo TEAM-006 vis dar pritaikytas |
| Visos aktyvios paskyros per RLS | 21:19 | `super_admin` 34/34, mokytojai 0/0 ir 1/1; visos aktyvios, `can_read_game` savoms veikloms tiesa |
| `E2E smoke (production)` | 21:20 | run `42701394552`: 22 passed |
| Vercel runtime klaidos | ~21:21 | `ctf-builder` ir `kusteam-team` per paskutinę valandą: nėra |
| Vedėjo pultas | ~21:22 | jau prisijungusio Vyčio sesija `pamokos.kusteam.app/dashboard`: rodomos visos 34 veiklos |

Liko:

- Vytis prisijungė testine mokytojo paskyra ir matė juodraštį (2026-11-10). Juodraštis „TEAM-006 patikra“ ištrintas 2026-11-11, po B1 bandymų produkcijoje (`kusteam-ai-lab` `docs/STATUS.md`).
- 9 žingsnis (pasiūlymas tampa migracija `20261109211700_team_sso.sql`, `kusteam-ai-lab` BACKLOG TEAM-009) daromas kartu su TEAM: TEAM darbas `SSO E2E (TEAM -> CLASSROOM)` paleidžia CLASSROOM migracijas ir ant jų taiko savo TEAM-006 kopiją, todėl perkėlus failą reikia pakeisti ir jį. Iki tol produkcija lyginama su `fingerprint-after.expected` (`function` `40\|1f98d3c00fb11c1193271d57751b066d`), ne su `schema-fingerprint.expected`.
- B1 (CLASSROOM jungikliai) įjungta 2026-11-10 ir priimta produkcijoje 2026-11-11. B2 (WATER LAB) tik su atskiru Vyčio leidimu.

## Schemos atspaudas

`supabase/tests/schema-fingerprint.sql` tik skaito sistemos katalogus. Jis apima tai, ką kuria migracijos: `public` lenteles, stulpelius, apribojimus, indeksus, RLS, politikas (`public` ir `storage.objects`), funkcijas, trigerius, realtime lenteles ir `anon`, `authenticated`, `service_role`, `PUBLIC` teises. Plėtinių objektai ir teisių suteikėjas neįtraukiami. Užklausą galima paleisti produkcijos SQL Editor ir lokaliai po migracijų. Vienos srities objektus su jų md5 grąžina detalus režimas (aprašytas failo pradžioje).

Produkcija 2026-11-07:

| kind | n | fp |
| --- | --- | --- |
| column | 186 | `0b8cafaadf003d01766a42a31e3894d6` |
| constraint | 85 | `32cf918681be97296aeacc014d9d87fd` |
| function | 26 | `af321e0f4f59a6180d4df6c55e72273b` |
| grant.column | 50 | `95c8dcc0fa52abb386b95f8942e022de` |
| grant.function | 53 | `b8d852bac14f7a308e4da3d12aa72452` |
| grant.table | 42 | `0d0aa2b35c41cf90611319b7668164bb` |
| index | 32 | `818d85ecdd15e093a85f3bb52280f8e1` |
| policy | 57 | `a7a2bd206c5f2f9c6ee93fb69d6bc475` |
| realtime | 5 | `d718741a8a346c9aa2c306739d3fada4` |
| table | 18 | `4456d03e6c5fa3e0ee1b8a1835df268d` |
| trigger | 11 | `6b0e207b15b5ecf28ecd7e75c9c4dbb6` |

Tuščia Postgres 17.6 po visų migracijų duoda tuos pačius atspaudus, išskyrus `function` (`1951b8acc9fc0ea793fc0f2f4f5235fd`, dėl `handle_new_user`, CLS-011). Šie laukiami atspaudai yra `supabase/tests/schema-fingerprint.expected`, ir `npm run test:db` su Postgres 17 juos tikrina. Migracija, kuri keičia schemą, tame pačiame PR atnaujina ir šį failą. Vėliau jį atnaujino CLS-015 (`grant.table`, `policy`) ir TEAM-001 (9 sritys): dabartinės reikšmės yra pačiame faile, pasikeitimai nurodyti tų migracijų įrašuose. Su Postgres 16 palyginimas praleidžiamas, nes ten nėra teisės `MAINTAIN`.

## 2026-11-06: atsakymų, rolių ir statistikos spragos

Failas `supabase/migrations/20261106120000_close_answer_and_role_gaps.sql`
(pavadintas pagal CLI konvenciją). Grąžinimas: `supabase/rollback/20261106120000_close_answer_and_role_gaps.sql`.
Abu failai tikrinami `npm run test:db` (visos migracijos tuščioje Postgres,
saugumo patikros, grąžinimas ir pakartotinis pritaikymas) ir CI darbe „Database".

Taikymas produkcijoje: SQL Editor, visas failas (jame yra `BEGIN; … COMMIT;`).
Duomenys nekeičiami, keičiami tik leidimai, viena politika ir trys funkcijos.
Prieš ir po taikymo paleisti šią patikrą:

```sql
select
  has_column_privilege('authenticated','public.submissions','answer','SELECT') as auth_answer,
  has_column_privilege('authenticated','public.challenges','answer_hash','SELECT') as auth_hash,
  has_column_privilege('authenticated','public.profiles','role','UPDATE') as auth_role,
  has_function_privilege('anon','public.get_game_reflections(uuid)','EXECUTE') as anon_reflections,
  has_function_privilege('anon','public.get_game_stats(uuid)','EXECUTE') as anon_stats,
  has_function_privilege('anon','public.get_platform_stats()','EXECUTE') as anon_platform;
```

Prieš taikymą (2026-11-06): visi `true`. Po taikymo visi turi būti `false`.

Pritaikyta produkcijoje 2026-11-06 apie 12:58 (prieš tai atsarginė kopija
`backup_20261106` ir PR #48, kuris pakeitė `challenges(count)` į
`challenges(id)`). Po taikymo: visi šeši `false`; `authenticated` mato
`challenges.title`, gali keisti `profiles.full_name`, vykdyti
`get_game_stats`; atvira užduočių politika tik `anon`. Eigos patikra su
veikla PN3BJ5: kūrimas, užduotys, pradžia, prisijungimas, atsakymai, klasės
ekranas (realtime), analitika, administravimo statistika, pabaiga.

Svarbu toliau: naujiems `challenges` ir `submissions` stulpeliams `SELECT`
reikia suteikti atskirai abiem rolėms (`anon` ir `authenticated`), kitaip
puslapiai jų nematys. `teams`, `challenges` ir `submissions` lentelėms
naudotojo sesija negali naudoti `(count)` ar `(*)` įterpimų (PostgREST
atsako „permission denied“); tai tikrina `tests/column-grants.test.ts`.

## 2026-11-06: uždara registracija ir DI apskaita

Failas `supabase/migrations/20261106130000_access_requests_and_ai_usage.sql`,
grąžinimas `supabase/rollback/20261106130000_access_requests_and_ai_usage.sql`.
Tik prideda: `profiles` stulpelius (`status`, vardas, pavardė, mokyklos
kodas, savivaldybė, dalykai, klasės, sutikimas, patvirtinimas, DI limitas),
lenteles `request_links`, `access_requests`, `admin_audit_log`, `ai_usage`,
`platform_settings` (tik serveriui), griežtinančias politikas (rašyti
veiklas, užduotis, pranešimus, pamokų planus, bibliotekos įrašus ir failus
saugykloje gali tik `status = 'active'` paskyros), `games.finished_at` su
trigeriu ir nuorodų limito trigerį (`KS410`). Esamos paskyros gauna `active`, naujos
`pending`.

Patikra po taikymo:

```sql
select
  (select count(*) from public.profiles where status <> 'active') as not_active,
  (select count(*) from public.platform_settings) as settings_rows,
  has_table_privilege('authenticated','public.access_requests','SELECT') as auth_requests,
  has_column_privilege('authenticated','public.profiles','status','UPDATE') as auth_status,
  (select count(*) from pg_policies where policyname like 'Only active accounts%') as active_policies,
  (select count(*) from pg_trigger where tgname in ('games_finished_at', 'access_requests_link_open')) as triggers,
  (select count(*) from public.games where status = 'finished' and finished_at is null) as finished_without_time;
```

Tikimasi: `not_active` 0, `settings_rows` 1, abu leidimai `false`,
`active_policies` 18 (15 lentelėms, 3 `storage.objects`), `triggers` 2,
`finished_without_time` 0.

Pritaikyta produkcijoje 2026-11-06 apie 13:35 (patvirtino Vytis, prieš tai
atsarginė kopija `backup_20261106.profiles_before_0613`). Po taikymo patikra:
`not_active` 0, `settings_rows` 1, abu leidimai `false`, `active_policies` 18,
`triggers` 2, `finished_without_time` 0, `profiles.status` numatytasis
`pending`.

## 2026-11-06: neaktyvios paskyros be administratoriaus teisių

Failas `supabase/migrations/20261106140000_inactive_accounts_lose_privileges.sql`,
grąžinimas `supabase/rollback/20261106140000_inactive_accounts_lose_privileges.sql`.
`get_my_role()` grąžina `teacher`, jei paskyra ne `active`; pamokų planų ir
refleksijų administratorių politikos naudoja `get_my_role()`; neaktyvi
paskyra negali keisti `profiles`. Duomenys nekeičiami.

Patikra po taikymo:

```sql
select
  pg_get_functiondef('public.get_my_role()'::regprocedure) like '%status = ''active''%' as role_checks_status,
  (select count(*) from pg_policies where policyname = 'Only active accounts update profiles') as profile_policy,
  (select count(*) from pg_policies where tablename in ('lesson_plans', 'reflections')
     and policyname like 'Admins%' and qual like '%get_my_role%') as admin_policies;
```

Tikimasi: `role_checks_status` `true`, `profile_policy` 1, `admin_policies` 4.

Pritaikyta produkcijoje 2026-11-06 apie 13:57 (SQL Editor, visas failas). Patikra po taikymo: `true`, 1, 4; neaktyvių paskyrų 0.

## 2026-11-06: DI rezervacijos ir biudžeto įspėjimų užraktas

Failas `supabase/migrations/20261106145000_ai_reservations_and_alert_claims.sql`,
grąžinimas `supabase/rollback/20261106145000_ai_reservations_and_alert_claims.sql`.
`reserve_ai_action()` suskaičiuoja mėnesio veiksmus ir įrašo rezervaciją
vienu kvietimu, laikydama asmens užraktą (`pg_advisory_xact_lock`), todėl
paskutinės laisvos vietos negali užimti dvi užklausos. Mėnuo (UTC) ir
vykdomų veiksmų langas skaičiuojami nuo to paties laiko, kurį gauna
rezervacijos eilutė. Unikalus indeksas
leidžia vieną biudžeto įspėjimą per mėnesį ir lygį. Indeksas `ai_usage(request_id)`
pagreitina skaičiavimą. Duomenys nekeičiami; funkciją gali kviesti tik
`service_role`.

Taikymo tvarka: pirma migracija, tada kodas (PR #50).

Patikra po taikymo:

```sql
select
  has_function_privilege('service_role', 'public.reserve_ai_action(uuid,uuid,text,integer,integer)', 'EXECUTE') as service_fn,
  has_function_privilege('authenticated', 'public.reserve_ai_action(uuid,uuid,text,integer,integer)', 'EXECUTE') as auth_fn,
  (select count(*) from pg_indexes where indexname in ('ai_usage_request', 'admin_audit_log_ai_budget_alert_once')) as indexes;
```

Tikimasi: `service_fn` `true`, `auth_fn` `false`, `indexes` 2.

Pritaikyta produkcijoje 2026-11-06 13:54 UTC (SQL Editor, visas failas, kontrolinė suma sutapo). Patikra po taikymo: `service_fn` `true`, `auth_fn` `false`, `anon` taip pat `false`, `indexes` 2.

## 2026-11-06: pauzė sustabdo laiką, būsenų taisyklės

Failas `supabase/migrations/20261106150000_pause_clock_and_status_rules.sql`,
grąžinimas `supabase/rollback/20261106150000_pause_clock_and_status_rules.sql`.
Prideda `games.paused_at`, `games.paused_ms`, `games.resumed_at`,
`teams.pause_offset_ms`, trigerį `games_status_rules` (prisijungę klientai
kuria tik juodraščius, būsena keičiasi tik pirmyn bet kuriam rašytojui,
pauzės laiką skaičiuoja tik jis, veikla su užduotimi be atsakymo nepradedama),
trigerį `challenges_live_rules` (vykstančiai veiklai negalima pridėti
užduoties be atsakymo, o jos užduočių negalima ištrinti ar perkelti į kitą
veiklą; trinant visą veiklą užduotys trinamos kaip anksčiau; veikla be
užduočių nepradedama) ir funkcijas `set_game_status()`,
`extend_game_time()` (minutės pridedamos vienu sakiniu; veiklai be laiko
limito atsisakoma) ir `update_game_settings()` (nustatymai kartu su pavadinimu ir aprašymu
išsaugomi vienu sakiniu; vykstančios veiklos limitas keičiamas tik pratęsiant).
Baigtos veiklos atnaujinti nebegalima ir tiesiai SQL. Vykstančios veiklos laiko limitą keičia tik `extend_game_time()`: kitas nustatymų įrašas (senas skirtukas, tiesioginė API užklausa) limitą palieka. Trigeris
`teams_pause_offset` komandos pauzės poslinkį įrašo pats, kai komanda
pradeda (ir tada, kai dar veikia senas kodas). Taikymo metu pristabdytoms
veikloms nustatomas `paused_at = now()`: jų pauzė skaičiuojama nuo taikymo.
Esami duomenys nekeičiami. Visos trys funkcijos vykdomos kviečiančiojo teisėmis,
todėl RLS taisyklės (savininkas, aktyvi paskyra) galioja kaip anksčiau.
Neaktyvi paskyra gauna klaidą `42501` (sąsajoje 403), o ne nepakeistą eilutę
kaip sėkmę.

Taikymo tvarka: pirma migracija, tada kodas. Senas kodas su nauja schema
veikia (nauji stulpeliai turi numatytąsias reikšmes, funkcijų jis nekviečia),
bet pauzė jame laiko nestabdo, kaip ir iki migracijos, o „Pratęsti“ limito
nepakeičia. Todėl taikyti, kai nevyksta veiklos, ir kodą diegti iškart po to.

Patikra po taikymo:

```sql
select
  (select count(*) from information_schema.columns where table_schema = 'public'
     and table_name = 'games' and column_name in ('paused_at', 'paused_ms', 'resumed_at')) as game_cols,
  (select count(*) from information_schema.columns where table_schema = 'public'
     and table_name = 'teams' and column_name = 'pause_offset_ms') as team_cols,
  has_function_privilege('authenticated', 'public.set_game_status(uuid,text)', 'EXECUTE') as auth_status_fn,
  has_function_privilege('anon', 'public.set_game_status(uuid,text)', 'EXECUTE') as anon_status_fn,
  has_function_privilege('anon', 'public.extend_game_time(uuid,integer)', 'EXECUTE') as anon_extend_fn,
  has_function_privilege('authenticated', 'public.update_game_settings(uuid,jsonb,jsonb)', 'EXECUTE') as auth_settings_fn,
  (select count(*) from pg_trigger where tgname in ('games_status_rules', 'teams_pause_offset', 'challenges_live_rules')) as triggers,
  (select count(*) from public.games where status = 'paused' and paused_at is null) as paused_without_clock;
```

Tikimasi: `game_cols` 3, `team_cols` 1, `auth_status_fn` `true`, `anon_status_fn` `false`, `anon_extend_fn` `false`, `auth_settings_fn` `true`, `triggers` 3, `paused_without_clock` 0.

Pritaikyta produkcijoje 2026-11-06 14:13 UTC (SQL Editor, visas failas, kontrolinė suma sutapo; prieš tai 0 vykstančių veiklų, atsarginės kopijos `backup_20261106.games_before_150000`, `teams_before_150000`, `challenges_before_150000`). Patikra po taikymo: 3, 1, `true`, `false`, `false`, `true`, 3, 0; veiklų, komandų ir užduočių skaičius nepasikeitė (27, 30, 111). Kodas (PR #52) įdiegtas 14:45 UTC.

## 2026-11-06: komandų tvarkymas viena užklausa

Failas `supabase/migrations/20261106160000_team_moderation.sql`,
grąžinimas `supabase/rollback/20261106160000_team_moderation.sql`.
Funkcija `moderate_team()` pervadina arba pašalina savos vykstančios
(ar pristabdytos) veiklos komandą vienoje transakcijoje su patikromis:
paskyra aktyvi (be programos 30 s talpyklos), veikla priklauso kviečiančiajam
ir dar vyksta (veiklos eilutė užrakinama, todėl tuo pat metu baigiama veikla
pakeitimo nepraleidžia). Baigta veikla savo komandas ir atsakymus išlaiko.
Funkcija vykdoma savininko teisėmis po šių patikrų, kviesti gali tik
prisijungę vartotojai. Duomenys nekeičiami.

Taikymo tvarka: kodas gali būti pirmas (be funkcijos jis tikrina tą patį
pats, tik ne vienoje transakcijoje), migracija bet kada po to.

Patikra po taikymo:

```sql
select
  has_function_privilege('authenticated', 'public.moderate_team(uuid,uuid,text,boolean)', 'EXECUTE') as auth_fn,
  has_function_privilege('anon', 'public.moderate_team(uuid,uuid,text,boolean)', 'EXECUTE') as anon_fn,
  (select prosecdef from pg_proc where proname = 'moderate_team') as definer;
```

Tikimasi: `auth_fn` `true`, `anon_fn` `false`, `definer` `true`.

Pritaikyta produkcijoje 2026-11-06 16:35 UTC (patvirtino Vytis; SQL Editor, visas failas, kontrolinė suma sutapo; prieš tai funkcijos nebuvo, 0 vykstančių veiklų). Patikra po taikymo: `auth_fn` `true`, `anon_fn` `false`, `definer` `true`, `search_path=public, pg_temp`. Kodas (PR #54) sujungtas po to.

### 20261106170000_close_participant_hint_reads

Failas `supabase/migrations/20261106170000_close_participant_hint_reads.sql`,
grąžinimas `supabase/rollback/20261106170000_close_participant_hint_reads.sql`.
Su viešu anon raktu buvo galima tiesiogiai skaityti visų vykstančių,
pristabdytų ir baigtų veiklų užuominas (taip apeinama užuominų bauda) ir DI
patikros pastabas (jose gali būti atsakymas), o `get_player_game_state()`
galėjo kviesti anon ir prisijungę vartotojai. Migracija atima anon teisę
skaityti `hints` ir `verification_*` stulpelius ir funkciją palieka tik
serveriui (service role). Programa šiuos duomenis skaito tik serveriu,
vedėjai savo užduotis mato kaip anksčiau. Duomenys nekeičiami.

Taikymo tvarka: bet kada, kodo keisti nereikia.

Patikra po taikymo:

```sql
select
  has_column_privilege('anon', 'public.challenges', 'hints', 'SELECT') as anon_hints,
  has_column_privilege('anon', 'public.challenges', 'verification_issues', 'SELECT') as anon_notes,
  has_column_privilege('anon', 'public.challenges', 'title', 'SELECT') as anon_title,
  has_column_privilege('authenticated', 'public.challenges', 'hints', 'SELECT') as auth_hints,
  has_function_privilege('anon', 'public.get_player_game_state(text,text)', 'EXECUTE') as anon_state,
  has_function_privilege('authenticated', 'public.get_player_game_state(text,text)', 'EXECUTE') as auth_state,
  has_function_privilege('service_role', 'public.get_player_game_state(text,text)', 'EXECUTE') as service_state;
```

Tikimasi: `anon_hints` `false`, `anon_notes` `false`, `anon_title` `true`,
`auth_hints` `true`, `anon_state` `false`, `auth_state` `false`,
`service_state` `true`.

Produkcijoje prieš taikymą (2026-11-06, tik skaitymo užklausa): `anon_hints`
`true`, `anon_notes` jau `false`, `anon_title` `true`, `auth_hints` `true`,
`anon_state` `true`, `auth_state` `true`, 0 vykstančių veiklų; funkcijos
teisės `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`
(vykdyti galėjo ir PUBLIC). Grąžinimas atkuria būtent tai: `hints` ir
funkcijos teises, įskaitant PUBLIC.

Pritaikyta produkcijoje 2026-11-06 18:13 UTC (patvirtino Vytis; SQL Editor, visas failas, kontrolinė suma sutapo; prieš tai 0 vykstančių veiklų). Patikra po taikymo: `anon_hints` `false`, `anon_notes` `false`, `anon_title` `true`, `auth_hints` `true`, `anon_state` `false`, `auth_state` `false`, `service_state` `true`; funkcijos teisės `{postgres=X/postgres,service_role=X/postgres}`.

## 2026-11-07: keli priimami atsakymai

Failas `supabase/migrations/20261107100000_accepted_answers.sql`,
grąžinimas `supabase/rollback/20261107100000_accepted_answers.sql`.
Prideda `challenges.accepted_answer_hashes` (iki 5 papildomų atsakymų,
saugomi kaip bcrypt maišos, `anon` ir `authenticated` jų neskaito) ir
sugeneruotą `challenges.accepted_answer_count`, kurį skaito tik
`authenticated` (vedėjas mato, kiek jų yra). Esamos užduotys gauna tuščią
sąrašą, kiti duomenys nekeičiami. Sugeneruotas stulpelis perrašo lentelę
`challenges` (keli tūkstančiai eilučių, trumpas išskirtinis užraktas), todėl
taikyti, kai nevyksta veiklos.

Taikymo tvarka: pirma migracija, tada kodas (PR su funkcija). Kodas veikia ir
su sena schema: atsakymai tikrinami kaip anksčiau, o papildomų atsakymų
išsaugoti neleidžiama (503).

Atsarginė kopija: duomenys nekeičiami, tik pridedami stulpeliai, todėl
atskira kopija nebūtina; grąžinimas pašalina abu stulpelius ir apribojimą.

Patikra po taikymo:

```sql
select
  (select count(*) from information_schema.columns where table_schema = 'public'
     and table_name = 'challenges' and column_name in ('accepted_answer_hashes', 'accepted_answer_count')) as cols,
  has_column_privilege('anon', 'public.challenges', 'accepted_answer_hashes', 'SELECT') as anon_hashes,
  has_column_privilege('authenticated', 'public.challenges', 'accepted_answer_hashes', 'SELECT') as auth_hashes,
  has_column_privilege('authenticated', 'public.challenges', 'accepted_answer_count', 'SELECT') as auth_count,
  has_column_privilege('anon', 'public.challenges', 'accepted_answer_count', 'SELECT') as anon_count,
  (select count(*) from public.challenges where accepted_answer_count <> 0) as with_extras;
```

Tikimasi: `cols` 2, `anon_hashes` `false`, `auth_hashes` `false`,
`auth_count` `true`, `anon_count` `false`, `with_extras` 0.

Pritaikyta produkcijoje 2026-11-07 apie 08:52 UTC (patvirtino Vytis; SQL Editor, visas failas, kontrolinė suma sutapo; prieš tai 0 vykstančių veiklų, 114 užduočių). Patikra po taikymo: `cols` 2, `anon_hashes` `false`, `auth_hashes` `false`, `auth_count` `true`, `anon_count` `false`, `with_extras` 0.

## 2026-11-07: vykstančių veiklų kodų nebegalima išvardyti

Failas `supabase/migrations/20261107120000_close_active_code_listing.sql`,
grąžinimas `supabase/rollback/20261107120000_close_active_code_listing.sql`.

Problema: su viešu `anon` raktu `SELECT game_code, title FROM games` grąžino
visas vykstančias, pristabdytas ir baigtas veiklas, o `teams`, `submissions`,
`challenges`, `announcements` ir `achievements` buvo skaitomi taip pat (jų
`game_id` vedė atgal į kodą). Tos pačios `public` politikos leido bet kuriam
prisijungusiam vedėjui matyti kitų vedėjų vykstančias veiklas. Atsakymų
stulpeliai buvo ir lieka uždaryti.

Pakeitimas: šešios atviros skaitymo politikos pašalinamos, `anon` netenka
`SELECT` teisės šiose lentelėse. Vedėjas mato savo veiklas kaip anksčiau
(savininko politikos, realaus laiko atnaujinimai), papildomai gauna savo
veiklų ženklelius. Administratoriai mato visų veiklų komandas, rezultatus,
skelbimus ir ženklelius. Dalyvio puslapiai skaito per serverį su veiklos
kodu: `/api/play/status` (būsena, laikas, užduočių žymė, naujausias
skelbimas), `/api/play/state`, `/api/play/leaderboard`.

Taikymo tvarka: pirma kodas (PR su šiuo failu), tada migracija. Naujas kodas
anon raktu šių lentelių nebeskaito, todėl veikia ir su sena, ir su nauja
schema. Taikyti, kai nevyksta veiklos: per diegimą atidaryti seni dalyvio
puslapiai iki perkrovimo nematytų rezultatų lentelės.

Atsarginė kopija: duomenys nekeičiami, keičiamos tik politikos ir teisės.
Prieš taikymą išsaugoti dabartines politikas ir teises (užklausa žemiau), kad
būtų galima palyginti su grąžinimo failu.

```sql
select 'pol' k, tablename||'.'||policyname n, roles::text||' '||cmd||' '||coalesce(qual,'') v
  from pg_policies where schemaname = 'public'
   and tablename in ('games','challenges','teams','submissions','announcements','achievements')
union all
select 'rel', relname, relacl::text from pg_class
 where relnamespace = 'public'::regnamespace
   and relname in ('games','challenges','teams','submissions','announcements','achievements')
union all
select 'col', c.relname||'.'||a.attname, a.attacl::text
  from pg_attribute a join pg_class c on c.oid = a.attrelid
 where c.relnamespace = 'public'::regnamespace and a.attacl::text like '%anon%'
   and c.relname in ('games','challenges','teams','submissions','announcements','achievements')
order by 1, 2;
```

Patikra po taikymo:

```sql
select
  has_table_privilege('anon', 'public.games', 'SELECT') as anon_games,
  has_column_privilege('anon', 'public.teams', 'name', 'SELECT') as anon_teams,
  has_table_privilege('anon', 'public.achievements', 'SELECT') as anon_achievements,
  (select count(*) from pg_policies where schemaname = 'public' and policyname in (
     'Anyone can read active games', 'Anyone can read challenges for active games',
     'Read teams in active games', 'Read submissions in active games',
     'Anyone can read announcements', 'Anyone can read achievements')) as open_policies,
  (select count(*) from pg_policies where schemaname = 'public' and policyname in (
     'Teachers read own game achievements', 'admins_read_all_teams', 'admins_read_all_submissions',
     'admins_read_all_achievements', 'admins_read_all_announcements')) as new_policies;
```

Tikimasi: `anon_games`, `anon_teams`, `anon_achievements` `false`,
`open_policies` 0, `new_policies` 5.

Būsena prieš taikymą (2026-11-07, tik skaitymo užklausos SQL Editor): 0
vykstančių veiklų. Produkcija skyrėsi nuo migracijų failų: `games`, `teams`,
`submissions` skaitymo politikos yra 00014 versijos (`active`, `finished`, be
`paused`; 00020 jų ten nepakeitė), o `anon` neturi teisės į
`challenges.generated_by_di`. Grąžinimo failas atkuria būtent tokią būseną.

Atspaudas (politikų apibrėžimai ir `anon` skaitymo teisės):

```sql
with t as (select oid, relname from pg_class where relnamespace='public'::regnamespace and relname in ('games','challenges','teams','submissions','announcements','achievements')),
x as (
  select 'pol' k, tablename||'.'||policyname n, md5(roles::text||' '||cmd||' '||coalesce(regexp_replace(qual,'\s+',' ','g'),'')) v from pg_policies where schemaname='public' and tablename in ('games','challenges','teams','submissions','announcements','achievements')
  union all select 'tab', relname, has_table_privilege('anon', oid, 'SELECT')::text from t
  union all select 'col', t.relname||'.'||a.attname, 'y' from pg_attribute a join t on t.oid=a.attrelid where a.attnum>0 and not a.attisdropped and has_column_privilege('anon', t.oid, a.attnum, 'SELECT')
)
select count(*) as n, md5(string_agg(k||'|'||n||'|'||v, '/' order by k, n)) as fp from x;
```

Produkcijoje prieš taikymą ir lokaliai po grąžinimo: `82 | fd39b8eca6104db93c12a722beee8a7c`.
Po migracijos laukiama: `28 | 03de43e87dedd1ca5202b57f295d6d7e`.

Pritaikyta produkcijoje 2026-11-07 apie 10:30 UTC (patvirtino Vytis; SQL
Editor, visas failas, SHA-256 sutapo; prieš tai 0 vykstančių veiklų; kodas
PR #101 jau buvo produkcijoje). Patikra po taikymo: `anon_games`,
`anon_teams`, `anon_achievements` `false`, `open_policies` 0, `new_policies`
5, atspaudas `28 | 03de43e87dedd1ca5202b57f295d6d7e` (kaip laukta). Iš
išorės viešu anon raktu `games`, `teams`, `challenges`, `submissions`,
`announcements`, `achievements` grąžina 401 (42501). Vedėjo skydelis,
vedėjo ekranas, ženklelių ir statistikos API savo veiklai veikia, dalyvio
rezultatų lentelė ir būsena per serverį veikia, Vercel klaidų nėra.
Produkcijoje nepatikrinta: naujas prisijungimas prie vykstančios veiklos ir
vedėjo realaus laiko atnaujinimai (reikia bandomosios veiklos).

## 2026-11-08: biblioteka tik aktyviems vedėjams (CLS-015)

Failas `supabase/migrations/20261108120000_library_active_facilitators_only.sql`,
grąžinimas `supabase/rollback/20261108120000_library_active_facilitators_only.sql`.
Sprendimas S12 = B (Vytis Radvila, 2026-11-08), kryptis ir techninė
peržiūra patvirtintos. Analizė: `docs/library-access.md`.

**Pritaikyta produkcijoje 2026-11-08 apie 10:50 UTC** (Vyčio leidimas
2026-11-08 12:45; SQL Editor, visas failas, SHA-256 sutapo su PR #115
failu). Prieš taikymą:

- Supabase Backups rodė kasdienes fizines kopijas (paskutinė 2026-11-07
  23:41 UTC), kiekviena su „Restore“; atkūrimas nebandytas, nes jis keičia
  produkciją.
- 0 vykstančių veiklų, `library_items` 2 įrašai (abu patvirtinti), profiliai:
  1 aktyvus mokytojas, 1 aktyvus super administratorius.
- `schema_migrations` tuščia (CLS-005 neatliktas), todėl `migration repair`
  nevykdytas.
- Atspaudas visose 11 sričių sutapo su 2026-11-07 produkcijos būsena
  (`grant.table 42 0d0aa2b3…`, `policy 57 a7a2bd20…`).

Po taikymo:

- `anon_select` `false`, `read_roles` `{authenticated}`, `active_only` `1`.
- Atspaudas: `grant.table 41 3a9a703d936e8239b365b1ec7e0f6297`, `policy 58
  2a8f82ee66475757bb54b47bb765216e`, kitos sritys nepakito (kaip laukta).
- Rolių patikra viena transakcija, kuri visada atšaukiama (`RAISE` pabaigoje):
  `anon` gauna `insufficient_privilege`, aktyvus mokytojas mato 2 iš 2
  patvirtintų, tas pats profilis su `pending` mato 0, su `blocked` mato 0.
  Po jos profilių būsenos nepakito.
- Iš išorės viešu `anon` raktu `GET /rest/v1/library_items?select=id` ir
  `POST` grąžina 401 (`42501 permission denied for table library_items`).
- Prisijungusio administratoriaus biblioteka `pamokos.kusteam.app/library`
  rodo abu šablonus.

Produkcijoje nepatikrinta tikromis paskyromis: `pending` ir `blocked` sesijos
(patikrinta tik rolių simuliacija ir CI), „Naudoti šabloną“ ir moderavimas
(liks CLS-004 registracijos testui).

Problema: `anon` turėjo visas teises į `library_items` (numatytoji Supabase
teisė), o `read_approved_library` galiojo rolei `public`. Su viešu `anon`
raktu per Data API buvo skaitomi visi patvirtinti įrašai su užuominomis,
`published_by` ir `review_notes`. Užblokuotos ir `pending` paskyros su
galiojančia sesija taip pat matė patvirtintus įrašus. Vytis 2026-11-08
produkcijoje patvirtino, kad politika taikoma rolei `public`.

Pakeitimas: `REVOKE ALL ... FROM anon`; `read_approved_library` taikoma tik
`authenticated` su ta pačia taisykle; nauja ribojanti SELECT politika
„Only active accounts read“ (`is_active_account()`). Duomenys nekeičiami.
Programos kodas nesikeičia: biblioteką ji skaito tik vedėjo sesija.

Patikrinta lokaliai (Postgres 17.6, `npm run test:db`): atspaudas po
migracijos `grant.table 41 3a9a703d936e8239b365b1ec7e0f6297`, `policy 58
2a8f82ee66475757bb54b47bb765216e`, kitos sritys nepakito. Grąžinimas
atkuria ankstesnius `grant.table 42 0d0aa2b35c41cf90611319b7668164bb` ir
`policy 57 a7a2bd206c5f2f9c6ee93fb69d6bc475`, pakartotinis taikymas vėl duoda
naujus. `security.sql` tikrina `anon`, aktyvų mokytoją, autorių, `pending`,
`blocked`, administratorių, super administratorių ir sesiją be profilio; be
migracijos šie testai krenta. CI `scripts/test-data-api.sh` tą patį tikrina
tikromis HTTP užklausomis per PostgREST (Data API serveris).

Prieš taikymą (tik skaitymas), išsaugoti rezultatą palyginimui:

```sql
select 'rel' k, relacl::text v from pg_class where oid = 'public.library_items'::regclass
union all
select 'pol:' || policyname, roles::text || ' ' || cmd || ' ' || permissive || ' ' || coalesce(qual, '')
  from pg_policies where schemaname = 'public' and tablename = 'library_items'
order by 1;
```

Taikymas: SQL Editor, visas failas (viena transakcija), kai nevyksta
veiklos. Tą pačią dieną sujungti PR, kad repozitorija atitiktų produkciją.
Jei CLS-005 jau atliktas: `migration repair --status applied --remote 20261108120000`.

Patikra po taikymo:

```sql
select
  has_table_privilege('anon', 'public.library_items', 'SELECT') as anon_select,
  (select roles::text from pg_policies where schemaname = 'public'
     and tablename = 'library_items' and policyname = 'read_approved_library') as read_roles,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'library_items'
     and policyname = 'Only active accounts read' and permissive = 'RESTRICTIVE') as active_only;
```

Laukiama: `false`, `{authenticated}`, `1`; atspaudas `grant.table 41
3a9a703d936e8239b365b1ec7e0f6297`, `policy 58 2a8f82ee66475757bb54b47bb765216e`.
Iš išorės su viešu `anon` raktu
`GET https://menmndjyfeuwfweubwnl.supabase.co/rest/v1/library_items?select=id`
(antraštė `apikey`) grąžina 401. Vedėjo biblioteka, „Naudoti šabloną“,
„Mano pateikimai“, moderavimas ir administravimo skaičius veikia
(`docs/REGISTRATION-TEST.md`, E dalis), `E2E smoke (production)` žalias.

Avarinis grąžinimas: rollback failas SQL Editor. Po jo `anon_select`
`true`, `read_roles` `{public}`, `active_only` `0`, atspaudas kaip prieš
taikymą. **Dėmesio: avarinis grąžinimas vėl atveria anksčiau buvusį
anoniminį skaitymą.** Bet kas su viešu `anon` raktu per Data API vėl mato
visus patvirtintus įrašus su užuominomis, o `pending` ir `blocked` paskyros
vėl mato patvirtintus įrašus. Naudoti tik jei migracija sugadina biblioteką
aktyviems vedėjams, ir iš karto planuoti pataisymą bei pakartotinį taikymą.

Dalinis grąžinimas, jei problema tik aktyvios paskyros patikroje (pvz.,
aktyvus vedėjas staiga nemato bibliotekos): pašalinti tik ribojančią
politiką. `anon` lieka uždarytas, skaityti gali visi prisijungę, kaip prieš
migraciją, tik ne neprisijungę.

```sql
DROP POLICY IF EXISTS "Only active accounts read" ON public.library_items;
```

Po jo `anon_select` `false`, `read_roles` `{authenticated}`, `active_only`
`0` (patikrinta lokaliai). Grąžinti į pilną migraciją: vėl pritaikyti
migracijos failą (jis pakartotinai taikomas be klaidų).

## 2026-11-09: KU STEAM TEAM darbuotojų lentelės (TEAM-001)

Failas `supabase/migrations/20261109111400_team_staff_access.sql`,
grąžinimas `supabase/rollback/20261109111400_team_staff_access.sql`. Testai ir
produkcijos skriptai `supabase/team-001/`: `test.sql`, `first-superadmin.sql`,
`first-superadmin.test.sql`, `state.sql`, `rollback-check.sql`. Iki taikymo tai
buvo pasiūlymas `supabase/proposals/team-001-staff-access/` (`up.sql`,
`down.sql` ir tie patys skriptai, PR #122 ir #123). Migracijos ir grąžinimo
turinys tiksliai toks, koks buvo pritaikytas, pakeistas tik antraštės
komentaras.

Vytis 2026-11-09 nusprendė, kad KU STEAM TEAM (`vyttis/kusteam-team`,
`komanda.kusteam.app`, veikia nuo 2026-11-09) naudos šio projekto Supabase Auth. Architektūra:
`kusteam-team/docs/ARCHITECTURE.md`.

**Pritaikyta produkcijoje 2026-11-09 apie 11:14 UTC** (Vyčio patvirtinimas;
SQL Editor, visas tuometinis `up.sql`, dabar šios migracijos failas). Eiga:

- `state.sql` prieš taikymą ir po kiekvieno žingsnio (laukiamos reikšmės:
  „Taikymo eiga“ žemiau).
- `rollback-check.sql`: grąžinimo bandymas be pakeitimų, rezultatas
  `TEAM-001 rollback dry run OK`.
- `first-superadmin.sql` su Vyčio patvirtintu ID: superadministratorius yra
  atskira, tik TEAM naudojama auth paskyra, ne Vyčio CLASSROOM paskyra.
- Po to CLASSROOM `E2E smoke (production)` žalias.

Šis PR repozitoriją suderina su produkcija: pasiūlymas tapo migracija,
`schema-fingerprint.expected` atnaujintas. Produkcijos schema atitinka visas
repozitorijos migracijas, įskaitant šią, išskyrus žinomą skirtumą: ranka
pakeistą `handle_new_user()` (CLS-011). Kai bus atliekamas CLS-005, versija
`20261109111400` įrašoma kartu su kitomis.

### Ką daro migracija

- Trys lentelės `public.team_members`, `public.team_activity_grants`, `public.team_tokens` su RLS. Prisijungęs naudotojas skaito tik savo nario eilutę ir savo veiklas; `anon` nieko; `team_tokens` neskaito jokia kliento rolė. Rašo tik TEAM serveris su service role.
- Vienas superadministratorius (dalinis unikalus indeksas). Programa vaidmens nekeičia.
- `team_issue_token()`: nuorodos išdavimas vienu žingsniu su užraktu narui (riba, senų nuorodų atšaukimas). Tik service role.
- Trigeris `skip_profile_for_team_users` prieš įrašant į `public.profiles`: auth naudotojui su `user_metadata.kusteam_app = 'team'` CLASSROOM profilis nekuriamas, todėl TEAM darbuotojas automatiškai netampa CLASSROOM vedėju. `handle_new_user()` nekeičiama (CLS-011 atskiras sprendimas). Žymė gali tik praleisti profilį, teisių nesuteikia.
- CLASSROOM lentelių, funkcijų ir teisių nekeičia.

### Patikrinta

`npm run test:db` (CI su Postgres 17, lokaliai 16) migraciją taiko kartu su kitomis, o grąžinimą ir pakartotinį taikymą tikrina bendras ciklas. Ant visiškai migruotos DB, nieko netaikydamas ir negrąžindamas, jis dar paleidžia:

- `supabase/team-001/test.sql`: TEAM naudotojas negauna profilio, CLASSROOM registracija veikia kaip anksčiau; antras superadministratorius ir nežinoma veikla atmetami; nuorodų riba ir senų atšaukimas; narys mato tik savo eilutę ir veiklas, negali keisti eilučių, suteikti sau veiklos, skaityti `team_tokens` ar kviesti `team_issue_token`; TEAM naudotojas nemato CLASSROOM duomenų ir negali kurti veiklų; `anon` nieko neskaito; ištrynus auth naudotoją dingsta ir TEAM eilutės.
- `first-superadmin.sql`: trys atsisakymai (prisijungusi paskyra, naudojamas profilis, CLASSROOM duomenys) ir sėkmingas atvejis (`first-superadmin.test.sql`).
- `rollback-check.sql`: jo `DROP` eilutės turi sutapti su grąžinimo failo eilutėmis, rezultatas `dry run OK`, TEAM eilutės lieka.

`supabase/tests/security.sql` papildomai tikrina, kad `anon` neskaito nė vienos `team_*` lentelės, prisijungęs CLASSROOM vedėjas neskaito `team_tokens` ir negali rašyti į `team_members` ar `team_activity_grants`, o service role jas skaito.

Atspaudas po migracijos (CI, Postgres 17), pasikeitė 9 sritys iš 11:

| kind | n | fp |
| --- | --- | --- |
| column | 206 | `f083c38098a9f4caddbcc54aefd7e30c` |
| constraint | 101 | `0f0a734daf4e3b6fa9923aa85cfe12b0` |
| function | 29 | `f1f7967f7f9624fc61c146d2d0af4ecb` |
| grant.function | 56 | `887bf0760f4e90318eca6e027708167d` |
| grant.table | 46 | `78248d5fc8404bc36e993bcb2d7b5452` |
| index | 35 | `fdf937be806286f5b8c8ac0155e7e5bd` |
| policy | 60 | `6e34e6be978e5366a052f980ad98751f` |
| table | 21 | `017902ef4132acc93e0c97a3e8299c17` |
| trigger | 13 | `f5225223b411d95a17b3e6dc53ca8300` |

`grant.column` ir `realtime` nepakito. Lokaliai (Postgres 16) grąžinus migraciją visos sritys vėl lygios ankstesnėms (`function` 26 `1951b8ac…`, `table` 18 `4456d03e…` ir t. t.), išskyrus `grant.table`, kuris Postgres 16 skiriasi dėl `MAINTAIN`. Produkcija patikrinta 2026-11-09 apie 14:15 UTC (tik skaitymas, `schema-fingerprint.sql` SQL Editor): 10 sričių iš 11 sutampa su lentele ir `schema-fingerprint.expected`. Skiriasi tik `function`: produkcijoje 29 `d454994ddc3688e3d4e60dcd90e49082`, nes `handle_new_user()` ranka pakeista (CLS-011), kaip ir prieš TEAM-001.

### Produkcijos patikra prieš taikymą (2026-11-09, tik skaitymas)

- Postgres 17.6. TEAM objektų nėra: `team_*` lentelių, funkcijų ir trigerio `skip_profile_for_team_users` nėra.
- Schemos atspaudas (`supabase/tests/schema-fingerprint.sql`) sutampa su tuometiniu `schema-fingerprint.expected` visose 11 srityse, išskyrus `function` (`af321e0f4f59a6180d4df6c55e72273b`, toks pat kaip 2026-11-07). Vienintelis skirtumas yra ranka keista `handle_new_user()` (CLS-011).
- `auth.users` turi vieną trigerį `on_auth_user_created` (AFTER INSERT, `handle_new_user()`). Ji tik įrašo profilį ir grąžina `NEW`, todėl TEAM trigeris, praleidžiantis įrašą, jos nesugadina. `public.profiles` turi tik `set_updated_at` (BEFORE UPDATE), vardų konfliktų nėra.
- Į `profiles` rodo 11 išorinių raktų, `games` ir `lesson_plans` su `ON DELETE CASCADE`. Todėl `first-superadmin.sql` atsisako paskyros, į kurią rodo bet kuri CLASSROOM eilutė.
- SQL Editor rolė `postgres` gali skaityti ir keisti `auth.users`, trinti `profiles` ir kurti objektus `public`.
- Atsarginės kopijos: kasdienės fizinės, paskutinė 2026-11-08 23:41 UTC. PITR neįjungtas.

Repeticija vietinėje kopijoje (migracijos ir produkcijos `handle_new_user()`, funkcijų atspaudas sutapo su produkcija): `up.sql`, `test.sql`, `first-superadmin.sql`, CLS-011 ant viršaus ir TEAM testas po jo, abiejų grąžinimas atgal iki produkcijos atspaudo, pakartotinis taikymas. Viskas praėjo.

### Pirmasis superadministratorius: atskira TEAM paskyra

Vytis CLASSROOM jungiasi Google paskyra, kuri neturi slaptažodžio. Jei TEAM superadministratorius būtų ta pati paskyra, TEAM slaptažodžio nustatymas ar atkūrimas jai sukurtų slaptažodį, kuriuo būtų galima jungtis ir į CLASSROOM, o TEAM slaptažodžio keitimas baigtų CLASSROOM sesijas. Todėl superadministratorius yra atskiras auth naudotojas, naudojamas tik TEAM (rekomenduojamas `vytis.radvila@ku.lt`, kurio auth naudotojų sąraše nėra; KU pašto dėžutė saugoma KU kelių veiksnių autentifikacija).

`supabase/team-001/first-superadmin.sql` (perrašytas 2026-11-09, produkcijoje paleistas tą pačią dieną): paskyra sukuriama Authentication > Users > Add user > Create new user (laikinas slaptažodis, Auto Confirm). Skriptas vienoje transakcijoje atsisako jau naudotos paskyros (prisijungusios, su naudojamu profiliu ar CLASSROOM duomenimis), pažymi naudotoją `kusteam_app = 'team'`, ištrina tuščią automatiškai sukurtą CLASSROOM profilį ir įrašo aktyvų superadministratorių su trimis veiklomis. Antrą kartą paleistas jis nepavyksta (`team_members_one_superadmin`). `npm run test:db` tikrina visus tris atsisakymus ir sėkmingą atvejį.

### Failai produkcijai

- `supabase/team-001/state.sql`: tik skaito, rodo TEAM objektų ir narių būseną, `handle_new_user()` md5, be el. pašto adresų. Paleidžiamas prieš ir po kiekvieno žingsnio.
- `supabase/team-001/rollback-check.sql`: vykdo tas pačias `DROP` eilutes kaip `supabase/rollback/20261109111400_team_staff_access.sql` (tikrina `test:db`) ir pats viską atšaukia. Laukiamas rezultatas yra klaida `TEAM-001 rollback dry run OK: 0 TEAM relations, 0 TEAM functions, profile guard false`. Taip produkcijoje patikrinama, kad grąžinimas veiktų, nieko nekeičiant.

### Taikymo eiga (atlikta 2026-11-09)

Visa seka su Vercel, domenu ir E2E: `kusteam-team/docs/LAUNCH.md`. DB dalis:

1. Nevyksta veiklos. Paskutinė kasdienė kopija ne senesnė nei 24 h (Database > Backups). `state.sql`: TEAM objektų nėra, `handle_new_user_md5` užrašomas.
2. SQL Editor: migracijos failas (tada `up.sql`). `state.sql`: 10 `team_*` ryšių, 3 funkcijos, `profile_guard` true, `handle_new_user_md5` nepakitęs.
3. `rollback-check.sql`: laukiama klaida `... dry run OK ...`, po jos `state.sql` nepakitęs.
4. Vytis sukuria atskirą TEAM paskyrą ir patvirtina jos ID. `first-superadmin.sql` su tuo ID. `state.sql`: `team_members` `{"superadmin/active": 1}`.
5. Pasiūlymas tampa migracija `20261109111400_team_staff_access.sql`, `down.sql` tampa grąžinimo failu, atnaujinamas `schema-fingerprint.expected`, įrašas šiame faile (šis PR).

### Grąžinimas

`supabase/rollback/20261109111400_team_staff_access.sql` SQL Editor, kai nevyksta veiklos; prieš tai galima paleisti `rollback-check.sql`. TEAM eilutės, nuorodos ir trigeris dingsta, CLASSROOM profiliai nekeičiami. TEAM sukurti auth naudotojai (taip pat superadministratoriaus paskyra) lieka be CLASSROOM profilio, juos galima ištrinti Authentication > Users. Po grąžinimo `state.sql`: TEAM objektų nėra, `handle_new_user_md5` nepakitęs. Kraštutiniu atveju kasdienė fizinė kopija, bet ji grąžina visą projektą į tos nakties būseną.

## Konvencija toliau

Naujas migracijas kurti tik per CLI, kad versijos būtų unikalios ir
chronologiškos:

```bash
supabase migration new <trumpas_aprasymas>   # sukuria <timestamp>_<aprasymas>.sql
```

Kol `schema_migrations` tuščia (kol neatlikta „Sutvarkymo procedūra“), naujas
migracijas ir toliau taikyti rankiniu būdu per SQL Editor, viena transakcija.
