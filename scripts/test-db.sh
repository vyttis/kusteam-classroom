#!/usr/bin/env bash
# Apply every migration to an empty Postgres and run the security checks.
# Production runs Postgres 17, so CI uses 17 too (CLS-012).
#
# Uses DATABASE_URL when set (CI service container). Otherwise starts a
# throwaway local cluster with the newest Postgres binaries on this machine,
# or the ones in PGBIN (for example PGBIN=/usr/lib/postgresql/17/bin).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PSQL_OPTS=(-v ON_ERROR_STOP=1 -q -X)
RUN=()

cleanup() {
  if [[ -n "${PGTMP:-}" ]]; then
    "${RUN[@]}" "$PGBIN/pg_ctl" -D "$PGTMP/data" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "$PGTMP"
  fi
}
trap cleanup EXIT

if [[ -z "${DATABASE_URL:-}" ]]; then
  PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)}"
  [[ -x "$PGBIN/initdb" ]] || { echo "No Postgres binaries found; set DATABASE_URL or PGBIN" >&2; exit 1; }
  PGTMP="$(mktemp -d)"
  PORT="${PGPORT_TEST:-55432}"
  if [[ "$(id -u)" == "0" ]]; then
    # Postgres refuses to run as root: start and stop it as nobody.
    chown -R nobody "$PGTMP"
    RUN=(runuser -u nobody --)
  fi
  "${RUN[@]}" "$PGBIN/initdb" -D "$PGTMP/data" -U postgres -A trust >/dev/null
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$PGTMP/data" -o "-p $PORT -k $PGTMP -c listen_addresses=''" -w start >/dev/null
  DATABASE_URL="postgresql://postgres@/postgres?host=$PGTMP&port=$PORT"
fi

psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$ROOT/supabase/tests/bootstrap.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate $(basename "$f")"
  psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$f" >/dev/null
done
# The read-only fingerprint compares production with the files
# (docs/migration-history.md). It runs before the security checks, which add
# their own helper functions. On Postgres 17 the migrated schema must match
# supabase/tests/schema-fingerprint.expected; a migration that changes the
# schema updates that file in the same PR. Postgres 16 has no MAINTAIN
# privilege, so table grants differ there and the comparison is skipped.
FINGERPRINT="$(psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -A -t -F'|' -f "$ROOT/supabase/tests/schema-fingerprint.sql")"
SERVER_VERSION="$(psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -A -t -c 'show server_version_num')"
if (( SERVER_VERSION >= 170000 )); then
  if ! diff <(echo "$FINGERPRINT") "$ROOT/supabase/tests/schema-fingerprint.expected"; then
    echo "schema fingerprint differs from supabase/tests/schema-fingerprint.expected" >&2
    exit 1
  fi
  echo "schema fingerprint matches"
else
  echo "schema fingerprint not compared: Postgres $SERVER_VERSION, expected values are for 17"
fi
psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$ROOT/supabase/tests/security.sql" >/dev/null
echo "security checks passed"

if [[ "${TEST_ROLLBACK:-1}" == "1" ]]; then
  # Every rollback must apply cleanly newest first (later migrations may
  # depend on earlier ones), and the migrations must apply again on top.
  mapfile -t ROLLBACKS < <(ls "$ROOT"/supabase/rollback/*.sql | sort -r)
  for f in "${ROLLBACKS[@]}"; do
    echo "rollback $(basename "$f")"
    psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$f" >/dev/null
  done
  for (( i=${#ROLLBACKS[@]}-1; i>=0; i-- )); do
    echo "re-apply $(basename "${ROLLBACKS[$i]}")"
    psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$ROOT/supabase/migrations/$(basename "${ROLLBACKS[$i]}")" >/dev/null
  done
  echo "rollback and re-apply passed"
fi
