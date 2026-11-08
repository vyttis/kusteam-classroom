#!/usr/bin/env bash
# Library access through the Supabase Data API (CLS-015).
#
# Runs PostgREST, the server behind the Supabase Data API, against a database
# that scripts/test-db.sh has migrated, and sends real HTTP requests as anon
# (the public key, no JWT) and with signed JWTs for an active teacher, the
# author, pending and blocked accounts, an admin and a super admin. Expected:
# anon gets 401 for reads and writes, pending and blocked get no rows, an
# active teacher gets approved items, the author also their own, admins all.
#
# Needs DATABASE_URL (superuser), psql, curl, jq, node, and docker or a
# PostgREST binary in POSTGREST_BIN. CI runs it after test-db.sh
# (.github/workflows/db.yml). Without docker or a binary it stops with an
# error instead of passing silently.
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL to the migrated test database}"
PGRST_PASSWORD="pgrst-test"
PGRST_DB_URI="${PGRST_DB_URI:-postgres://authenticator:${PGRST_PASSWORD}@localhost:5432/postgres}"
PGRST_IMAGE="${PGRST_IMAGE:-postgrest/postgrest:v12.2.3}"
PORT="${PGRST_PORT:-3000}"
URL="http://localhost:${PORT}"
SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -X)
TMP="$(mktemp -d)"
PGRST_PID=""
CONTAINER=""

cleanup() {
  [[ -n "$PGRST_PID" ]] && kill "$PGRST_PID" 2>/dev/null || true
  [[ -n "$CONTAINER" ]] && docker stop "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

# Login role for PostgREST, test accounts and library items. Accounts get
# their profile from handle_new_user(); status and role are set here.
"${PSQL[@]}" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '${PGRST_PASSWORD}';
  END IF;
END \$\$;
GRANT anon, authenticated TO authenticator;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000002b1', 'api-author@example.lt'),
  ('00000000-0000-0000-0000-0000000002b2', 'api-teacher@example.lt'),
  ('00000000-0000-0000-0000-0000000002b3', 'api-pending@example.lt'),
  ('00000000-0000-0000-0000-0000000002b4', 'api-blocked@example.lt'),
  ('00000000-0000-0000-0000-0000000002b5', 'api-admin@example.lt'),
  ('00000000-0000-0000-0000-0000000002b6', 'api-super@example.lt')
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET status = 'active', role = 'teacher'
  WHERE id IN ('00000000-0000-0000-0000-0000000002b1', '00000000-0000-0000-0000-0000000002b2');
UPDATE public.profiles SET status = 'pending', role = 'teacher' WHERE id = '00000000-0000-0000-0000-0000000002b3';
UPDATE public.profiles SET status = 'blocked', role = 'teacher' WHERE id = '00000000-0000-0000-0000-0000000002b4';
UPDATE public.profiles SET status = 'active', role = 'admin' WHERE id = '00000000-0000-0000-0000-0000000002b5';
UPDATE public.profiles SET status = 'active', role = 'super_admin' WHERE id = '00000000-0000-0000-0000-0000000002b6';

DELETE FROM public.library_items WHERE title LIKE 'DATAAPI-%';
INSERT INTO public.library_items (title, published_by, status, challenge_data) VALUES
  ('DATAAPI-approved', '00000000-0000-0000-0000-0000000002b1', 'approved', '[{"title":"U1","hints":["užuomina"]}]'),
  ('DATAAPI-pending', '00000000-0000-0000-0000-0000000002b1', 'pending_review', '[]'),
  ('DATAAPI-rejected', '00000000-0000-0000-0000-0000000002b1', 'rejected', '[]');
SQL

if [[ -n "${POSTGREST_BIN:-}" ]]; then
  PGRST_DB_URI="$PGRST_DB_URI" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
    PGRST_JWT_SECRET="$SECRET" PGRST_SERVER_PORT="$PORT" "$POSTGREST_BIN" >"$TMP/pgrst.log" 2>&1 &
  PGRST_PID=$!
elif command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  CONTAINER="$(docker run -d --rm --network host \
    -e PGRST_DB_URI="$PGRST_DB_URI" -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
    -e PGRST_JWT_SECRET="$SECRET" -e PGRST_SERVER_PORT="$PORT" "$PGRST_IMAGE")"
else
  echo "Data API checks need docker or POSTGREST_BIN" >&2
  exit 1
fi

for _ in $(seq 1 60); do
  [[ "$(curl -s -o /dev/null -w '%{http_code}' "$URL/" || true)" == "200" ]] && break
  sleep 1
done
if [[ "$(curl -s -o /dev/null -w '%{http_code}' "$URL/" || true)" != "200" ]]; then
  echo "PostgREST did not start" >&2
  [[ -n "$CONTAINER" ]] && docker logs "$CONTAINER" >&2 || true
  [[ -f "$TMP/pgrst.log" ]] && cat "$TMP/pgrst.log" >&2 || true
  exit 1
fi

jwt() { # secret, sub
  node -e '
    const c = require("crypto")
    const [secret, sub] = process.argv.slice(1)
    const part = (o) => Buffer.from(JSON.stringify(o)).toString("base64url")
    const head = part({ alg: "HS256", typ: "JWT" })
    const body = part({ sub, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 600 })
    console.log(`${head}.${body}.${c.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`)
  ' "$1" "$2"
}

FAILED=0
LIST="/library_items?select=title&title=like.DATAAPI-*&order=title"

check() { # label, token ("" = anon), method, path, expected status, expected titles ("" = do not compare), body
  local label="$1" token="$2" method="$3" path="$4" want_status="$5" want_titles="$6" body="${7:-}"
  local args=(-s -o "$TMP/body" -w '%{http_code}' -X "$method" -H 'Content-Type: application/json')
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(-d "$body")
  local status titles=""
  status="$(curl "${args[@]}" "$URL$path")"
  if [[ -n "$want_titles" && "$status" == "200" ]]; then
    titles="$(jq -c '[.[].title]' "$TMP/body")"
  fi
  if [[ "$status" != "$want_status" || ( -n "$want_titles" && "$titles" != "$want_titles" ) ]]; then
    echo "FAIL $label: $method $path -> $status ${titles:-$(head -c 200 "$TMP/body")} (expected $want_status ${want_titles})" >&2
    FAILED=1
  else
    echo "ok   $label: $status ${titles}"
  fi
}

ALL='["DATAAPI-approved","DATAAPI-pending","DATAAPI-rejected"]'
check "anon read" "" GET "$LIST" 401 ""
check "anon read approved" "" GET "/library_items?select=title,challenge_data&status=eq.approved" 401 ""
check "anon insert" "" POST "/library_items" 401 "" '{"title":"DATAAPI-anon","status":"pending_review"}'
check "anon delete" "" DELETE "/library_items?title=like.DATAAPI-*" 401 ""
check "forged JWT" "$(jwt "not-the-secret-not-the-secret-123" 00000000-0000-0000-0000-0000000002b2)" GET "$LIST" 401 ""
check "active teacher" "$(jwt "$SECRET" 00000000-0000-0000-0000-0000000002b2)" GET "$LIST" 200 '["DATAAPI-approved"]'
check "author" "$(jwt "$SECRET" 00000000-0000-0000-0000-0000000002b1)" GET "$LIST" 200 "$ALL"
check "pending account" "$(jwt "$SECRET" 00000000-0000-0000-0000-0000000002b3)" GET "$LIST" 200 '[]'
check "blocked account" "$(jwt "$SECRET" 00000000-0000-0000-0000-0000000002b4)" GET "$LIST" 200 '[]'
check "admin" "$(jwt "$SECRET" 00000000-0000-0000-0000-0000000002b5)" GET "$LIST" 200 "$ALL"
check "super admin" "$(jwt "$SECRET" 00000000-0000-0000-0000-0000000002b6)" GET "$LIST" 200 "$ALL"

"${PSQL[@]}" -c "DELETE FROM public.library_items WHERE title LIKE 'DATAAPI-%'"

if [[ "$FAILED" != "0" ]]; then
  echo "Data API library access checks failed" >&2
  exit 1
fi
echo "Data API library access checks passed"
