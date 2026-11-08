# Suplanuoti darbai

## Paliktų vykti veiklų užbaigimas

Savininko sprendimas (2026-11-07): po pamokos palikta vykti veikla baigiama
automatiškai.

- Kada: kas naktį 02:00 UTC (04:00 Vilniaus laiku žiemą, 05:00 vasarą),
  Vercel Cron (`vercel.json`). Kartą per dieną, todėl tinka ir Hobby planui.
- Kas baigiama: vykstanti arba pristabdyta (`active`, `paused`) veikla, kuri prasidėjo prieš
  6 val. ir kurioje 2 val. nebuvo atsakymų, naujų komandų ar vedėjo veiksmų
  (pauzė, tęsimas, pratęsimas). Taisyklė ir ribos: `lib/game/stale.ts`.
- Kaip: `GET /api/cron/finish-stale-activities` keičia būseną į `finished`
  taip pat, kaip administratoriaus „Baigti“ (rezultatai lieka, pauzės laikas
  įskaitomas). Kiekvienas užbaigimas įrašomas į `admin_audit_log` kaip
  `game_auto_finish` be `actor_id`.
- Apsauga: Vercel siunčia `Authorization: Bearer $CRON_SECRET`. Be
  `CRON_SECRET` aplinkos kintamojo maršrutas grąžina 503 ir nieko nedaro.

### Sąranka (vieną kartą)

1. Vercel → ctf-builder → Settings → Environment Variables: `CRON_SECRET`,
   reikšmė atsitiktinė (pvz. `openssl rand -hex 32`), tipas Sensitive,
   aplinka Production. Reikšmės niekur nekopijuoti.
2. Perdiegti produkciją (Redeploy), kad kintamasis įsigaliotų.
3. Settings → Cron Jobs turi rodyti `/api/cron/finish-stale-activities`.
   Ten pat mygtukas „Run“ paleidžia darbą rankiniu būdu.

Rezultatas matomas Vercel žurnale: įvykis `auto_finish_done` su `checked`,
`finished` ir `failed` skaičiais. Jei darbas nespėjo per 45 s
(`stopped: "time_budget"`), likusios veiklos laukia kitos nakties. Jei
nepavyko perskaityti sąrašo (`stopped: "list_failed"`), atsakymas 500 ir
Vercel pažymi paleidimą kaip nepavykusį.

## Duomenų saugojimo valymas (CLS-017, CLS-018)

Tas pats naktinis darbas, po veiklų užbaigimo, pagal patvirtintus terminus
(Vytis Radvila, 2026-11-08; kodas `lib/retention.ts`):

- paskyrų prašymai: 90 dienų po sprendimo;
- dalyvių rezultatai (komandos su atsakymais, užuominomis, ženkleliais,
  refleksijomis): 6 mėnesiai po veiklos pabaigos; veikla ir užduotys lieka;
- DI naudojimo ir administravimo žurnalo įrašai: 12 mėnesių;
- importuoti dokumentai: ištrinami po sėkmingo apdorojimo, likę senesni nei
  7 dienos ištrinami naktį.

Režimas `RETENTION_MODE`:

- nenustatytas (numatytasis): darbas tik suskaičiuoja, kas būtų ištrinta,
  ir įrašo į Vercel žurnalą įvykį `retention_done`. Niekas netrinama;
- `delete`: trina ir į `admin_audit_log` įrašo `retention_run` tik su
  skaičiais. Tas pats kintamasis įjungia dokumento trynimą po importo.

Įjungimas: Vercel → ctf-builder → Settings → Environment Variables,
`RETENTION_MODE` = `delete`, aplinka Production, tada Redeploy. Prieš tai
peržiūrėti kelių naktų `retention_done` skaičius. Išjungti: ištrinti
kintamąjį ir perdiegti. Jei valymo žingsnis nepavyksta, atsakymas 500 ir
`retention.failed` rodo, kuris.
