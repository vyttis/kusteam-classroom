# Demo Runbook — Švietimo ministerijos vizitas

> Vidinis dokumentas. Žingsnis po žingsnio veiksmų seka prieš demo ir per demo.
> Skirtas vartotojui (KU STEAM komandai), ne mokytojui.

---

## T-24 val. (vakare prieš)

### Migracijų sanity check
Supabase SQL Editor → New query → paleisti:

```sql
SELECT
  EXISTS(SELECT 1 FROM pg_proc WHERE proname='get_player_game_state') AS rpc_state_ok,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname='evaluate_achievements') AS rpc_ach_ok,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='competencies') AS col_ok,
  EXISTS(SELECT 1 FROM storage.buckets WHERE id='documents') AS bucket_ok;
```

Visi 4 turi grąžinti `true`. Jei kuris nors `false`:
- Paleisti `supabase/migrations/00018_audit_hardening.sql` (jei `rpc_state_ok` ar `col_ok` `false`)
- Paleisti `supabase/migrations/00019_achievements_rpc.sql` (jei `rpc_ach_ok` `false`)

### Vercel KV setup
1. Vercel Dashboard → Project → Storage → Create Database → KV
2. Pasirinkti EU region (ar artimiausią Lietuvai)
3. Vercel automatiškai įdiegs `KV_REST_API_URL` + `KV_REST_API_TOKEN` env vars į prod
4. Po setup'o — trigger redeploy (Vercel Dashboard → Deployments → Redeploy latest)
5. Verify: `curl https://app.kusteam.app/api/health` turi grąžinti 200

> Jei KV setup nepavyko — rate limiter automatiškai krenta į in-memory fallback'ą.
> Mažas rizikos (vienas demo mokytojas) yra OK.

### QR / play flow patikra
1. Vercel env vars patikrinti: `NEXT_PUBLIC_PLAY_URL=https://play.kusteam.app`
2. Atidaryti vieną demo žaidimą mokytojo aplinkoje
3. Žaidimo QR kortelėje URL turi prasidėti `https://play.kusteam.app/play/…`
4. Mobile iPhone Safari — nuskaityti QR → patekti į join page (NE login)

### Pre-generated demo lesson plans
Sukurti **3 pamokos planus prod'e**:

| # | Dalykas | Klasė | Tema | Trukmė |
|---|---|---|---|---|
| 1 | Matematika + Fizika (STEAM) | 7 | „Greitis ir pagreitis" | 45 min |
| 2 | Lietuvių kalba ir literatūra | 9 | „Maironio kūryba" | 45 min |
| 3 | Pasaulio pažinimas | 3 | „Gyvūnų prisitaikymas prie aplinkos" | 35 min |

Kiekvieną — peržiūrėti, kad matoma:
- Top-level „Ugdomos kompetencijos" kortelė su badges'ais
- Per-stage Bloom level badge (pvz., „Mąstymo lygis: Analizė")
- Per-stage competency badges
- `curriculum_link` su konkrečiu BUP ryšiu

### Pre-generated demo žaidimas
Sukurti vieną žaidimą iš lesson plan'o #1:
- Konvertuoti per „Konvertuoti į veiklą mokiniams"
- Pradėti žaidimą (status = active)
- Įsiminti žaidimo kodą (pvz., DEMO7K)
- Patikrinti, kad QR puslapis veikia

### Backup screenshots
Padaryti 5-6 screenshots:
1. Lesson plan generavimo progress UI (su progress bar)
2. Sugeneruotas planas su kompetencijomis ir Bloom badges
3. Mokytojo žaidimo dashboard'as
4. Mokinio prisijungimas mobile telefone
5. Klausimo sprendimas (su feedback)
6. Leaderboard'as su komandomis

Įdėti į vieną PDF ar slides. Backup demo metu, jei live demo strigtų.

---

## T-30 min (prieš demo)

### Pre-warm Vercel functions
Paleisti tris kartus su 5s pauze:

```bash
curl https://app.kusteam.app/api/health
curl https://play.kusteam.app/api/health
```

Tikslas — kad Vercel funkcijos būtų „šiltos" kai mokytojas paspaus „Generuoti".

### Patikrinti Anthropic API status
- https://status.anthropic.com — turi būti viskas žalia
- Anthropic Console → Usage → patikrinti, kad balansas yra (kreditas neišnaudotas)

### Patikrinti Supabase status
- https://status.supabase.com — viskas žalia
- Supabase Dashboard → Project → Settings → ar visi connection metrics OK

### Atidaryti darbinius tab'us
1. https://app.kusteam.app/dashboard (mokytojo aplinka, prisijungta)
2. https://app.kusteam.app/lesson-plans (su 3 paruoštais planais)
3. https://app.kusteam.app/games/<DEMO_GAME_ID> (paruoštas demo žaidimas)
4. https://play.kusteam.app/play/<DEMO_CODE> (mobile telefone)

### iPhone parengtas
- Demo telefone atjungti pranešimus
- WiFi prijungtas, signalas geras
- Kamera išvalyta (QR scan greitumui)

---

## Demo metu — eilė

1. **Pristatyti landing'ą** — `https://kusteam.app` viešas puslapis
   - Hero su interactive demo klausimu (simbiozė) — paprašyti atstovo paspausti
   - Trumpai paaiškinti „§1 Eiga", „§3 Galimybės"

2. **Mokytojo prisijungimas** — `https://app.kusteam.app/auth/login`
   - Google OAuth, demo paskyra

3. **Pamokos plano kūrimas (LIVE)**
   - „Naujas pamokos planas"
   - Dalykas: Matematika 7 kl. + STEAM Fizika
   - Tema: „Greitis ir pagreitis"
   - Trukmė: 45 min, „Nauja tema"
   - Generuoti → laukti 25-40s (matomas progress bar)
   - **Backup**: jei strigsta — atidaryti vieną iš paruoštų #1 plano

4. **Pamokos plano peržiūra**
   - Atkreipti dėmesį į kompetencijų badges'us
   - Bloom lygius
   - `curriculum_link` su BUP nuoroda
   - Pasakyti: „Šis planas atitinka Lietuvos BUP — galite peržiūrėti `curriculum_link` lauką"

5. **Konvertuoti į veiklą mokiniams** → QR puslapis
   - „Rodyti ekrane" — projektoriui
   - Klausimas: „Ar QR siunčia į play.kusteam.app?" → taip

6. **Mokinio prisijungimas (mobile)**
   - Nuskaityti QR iPhone'u
   - Komandos vardas: „Audito komanda"
   - Pradėti žaidimą

7. **2 atsakymai**
   - Vienas teisingas → matosi feedback + achievement
   - Vienas neteisingas → matosi feedback + galimybė bandyti dar

8. **Leaderboard'as** — realiu laiku atnaujinasi

9. **Mokytojo dashboard'as su rezultatais**
   - Atidaryti demo žaidimo detail puslapį
   - „Klasės rezultatų suvestinė" kortelė → KPI, sudėtingiausios užduotys
   - Pasakyti: „Mokytojas mato pedagoginį pjūvį, ne tik balus"

10. **BUP / GDPR klausimai** — žr. `docs/audit-talking-points.md`

---

## Failure modes — backup

| Kas strigtų | Backup |
|---|---|
| Anthropic API down | Atidaryti vieną iš 3 paruoštų lesson plans, paaiškinti, kad generavimas ką tik baigtas |
| `/lesson-plans/generate` timeout (>60s) | Tas pats |
| QR scan ne į play.* | Įvesti kodą ranka per https://play.kusteam.app |
| `/api/play/state` 500 | Vercel logs → patikrinti RPC. Backup — screenshot demo žaidimo |
| Realtime atsiliko | Atstovas pamato pauzę — paaiškinti, kad Supabase Realtime turi „best effort" SLA |
| Mobile Safari quirks | Atstovas naudoja savo telefoną — turi backup laptopas su `play.kusteam.app/play/<code>` |

---

## Po demo

- Padėkoti, fiksuoti pastabas
- Per 24 val. — atsakyti į follow-up klausimus el. paštu
- Per 1 sav. — pasiūlymas auditoriui parodyti C grupės (engineering hardening) progresą
