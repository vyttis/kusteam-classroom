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

# Byte order, as in the Supabase CLI, whatever the machine locale is.
export LC_COLLATE=C

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

# CLS-011 proposal (docs/migration-history.md) is not a migration yet: apply
# it on the migrated schema, run its test, roll it back and check that the
# previous definition of handle_new_user() is back.
PROPOSAL="$ROOT/supabase/proposals/cls-011-handle-new-user"
if [[ -d "$PROPOSAL" ]]; then
  FN_DEF="select md5(pg_get_functiondef('public.handle_new_user()'::regprocedure))"
  BEFORE="$(psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -A -t -c "$FN_DEF")"
  psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$PROPOSAL/up.sql" >/dev/null
  psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$PROPOSAL/test.sql" >/dev/null
  psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$PROPOSAL/down.sql" >/dev/null
  if [[ "$(psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -A -t -c "$FN_DEF")" != "$BEFORE" ]]; then
    echo "CLS-011 down.sql did not restore handle_new_user()" >&2
    exit 1
  fi
  psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -c "DROP SCHEMA backup_cls011 CASCADE" >/dev/null
  echo "CLS-011 proposal: apply, test and rollback passed"
fi

# TEAM-001 (docs/migration-history.md): KU STEAM TEAM staff tables, migration
# 20261109111400_team_staff_access, applied in production 2026-11-09. The
# migration and its rollback run with all the others (above, and the
# rollback and re-apply cycle below). Here, on the fully migrated database:
# the TEAM test, the first-superadmin.sql refusals and success case, and the
# production rollback check, without applying or rolling back anything.
TEAM_DIR="$ROOT/supabase/team-001"
TEAM_ROLLBACK="$ROOT/supabase/rollback/20261109111400_team_staff_access.sql"
psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$TEAM_DIR/test.sql" >/dev/null
# first-superadmin.sql: used accounts are refused with nothing changed, a
# new account becomes the TEAM-only superadmin (first-superadmin.test.sql).
psql "$DATABASE_URL" "${PSQL_OPTS[@]}" >/dev/null -c "
  INSERT INTO auth.users (id, email, last_sign_in_at) VALUES
    ('00000000-0000-4000-8000-0000000000b1', 'signed-in@example.invalid', now()),
    ('00000000-0000-4000-8000-0000000000b2', 'active@example.invalid', NULL),
    ('00000000-0000-4000-8000-0000000000b3', 'owner@example.invalid', NULL),
    ('00000000-0000-4000-8000-0000000000b4', 'Team-Admin@example.invalid', NULL);
  UPDATE public.profiles SET status = 'active' WHERE id = '00000000-0000-4000-8000-0000000000b2';
  INSERT INTO public.games (teacher_id, title, game_code) VALUES ('00000000-0000-4000-8000-0000000000b3', 'x', 'TEAMB3');"
for CASE_ in "b1|has signed in before" "b2|CLASSROOM profile in use" "b3|is referenced by games.teacher_id"; do
  ID="00000000-0000-4000-8000-0000000000${CASE_%%|*}"
  if OUT="$(sed "s/APPROVED_USER_ID/$ID/" "$TEAM_DIR/first-superadmin.sql" | psql "$DATABASE_URL" "${PSQL_OPTS[@]}" 2>&1)"; then
    echo "TEAM-001 first-superadmin.sql accepted used account $ID" >&2
    exit 1
  fi
  if ! grep -q "${CASE_#*|}" <<<"$OUT"; then
    echo "TEAM-001 first-superadmin.sql refused $ID for another reason: $OUT" >&2
    exit 1
  fi
done
sed "s/APPROVED_USER_ID/00000000-0000-4000-8000-0000000000b4/" "$TEAM_DIR/first-superadmin.sql" | psql "$DATABASE_URL" "${PSQL_OPTS[@]}" >/dev/null
psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$TEAM_DIR/first-superadmin.test.sql" >/dev/null
# rollback-check.sql runs exactly the DROP lines of the rollback file,
# reports and undoes itself: the TEAM rows must still be there afterwards.
if ! diff <(grep '^DROP ' "$TEAM_ROLLBACK") <(grep '^DROP ' "$TEAM_DIR/rollback-check.sql") >/dev/null; then
  echo "TEAM-001 rollback-check.sql does not run the same DROP statements as $(basename "$TEAM_ROLLBACK")" >&2
  exit 1
fi
psql "$DATABASE_URL" "${PSQL_OPTS[@]}" >/dev/null -c "INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000c1', 'kept@example.invalid');
  INSERT INTO public.team_members (user_id, email, role, status) VALUES ('00000000-0000-4000-8000-0000000000c1', 'kept@example.invalid', 'staff', 'active');"
OUT="$(psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$TEAM_DIR/rollback-check.sql" 2>&1 || true)"
if ! grep -q "TEAM-001 rollback dry run OK: 0 TEAM relations, 0 TEAM functions, profile guard false" <<<"$OUT"; then
  echo "TEAM-001 rollback-check.sql: $OUT" >&2
  exit 1
fi
if [[ "$(psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -A -t -c "select count(*) from public.team_members")" != "1" ]]; then
  echo "TEAM-001 rollback-check.sql changed data" >&2
  exit 1
fi
psql "$DATABASE_URL" "${PSQL_OPTS[@]}" >/dev/null -c "DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-0000000000c1'"
echo "TEAM-001: test, first superadmin and rollback check passed"

# TEAM-006 proposal (docs/migration-history.md): KU STEAM TEAM sign-in for
# activities. On the migrated schema (TEAM-001 included): the production
# apply check must succeed without changing anything, up.sql must give the
# expected fingerprint (Postgres 17), the verification and the rollback
# check must succeed, the test must pass, and down.sql must bring back the
# exact fingerprint from before.
PROPOSAL="$ROOT/supabase/proposals/team-006-sso"
if [[ -d "$PROPOSAL" ]]; then
  fingerprint() { psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -A -t -F'|' -f "$ROOT/supabase/tests/schema-fingerprint.sql"; }
  # The check files run exactly the statements of up.sql and down.sql.
  CHECKS="$(mktemp -d)"
  "$ROOT/scripts/team-006-checks.sh" "$CHECKS"
  for f in apply-check.sql verify.sql rollback-check.sql; do
    if ! diff -q "$CHECKS/$f" "$PROPOSAL/$f" >/dev/null; then
      echo "TEAM-006 $f is out of date: run scripts/team-006-checks.sh" >&2
      exit 1
    fi
  done
  rm -rf "$CHECKS"
  # Each check ends with an error on purpose; its message is the result.
  expect_check() {
    local out
    out="$(psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$1" 2>&1 || true)"
    if ! grep -q "$2" <<<"$out"; then
      echo "TEAM-006 $(basename "$1"): $out" >&2
      exit 1
    fi
    grep -o 'TEAM-006 .*' <<<"$out" | head -1
  }
  # A teacher with activities, so the checks look at real rows.
  TEACHER_ID="00000000-0000-4000-8000-0000000000f1"
  psql "$DATABASE_URL" "${PSQL_OPTS[@]}" >/dev/null -c "
    INSERT INTO auth.users (id, email) VALUES ('$TEACHER_ID', 'check-teacher@example.invalid');
    UPDATE public.profiles SET status = 'active', onboarding_completed = true WHERE id = '$TEACHER_ID';
    INSERT INTO public.games (teacher_id, title, game_code) VALUES
      ('$TEACHER_ID', 'Patikra 1', 'CHKT01'), ('$TEACHER_ID', 'Patikra 2', 'CHKT02');"

  BEFORE="$(fingerprint)"
  expect_check "$PROPOSAL/apply-check.sql" "TEAM-006 apply dry run OK: .* teacher \\([0-9]*\\)/\\1 active"
  if [[ "$(fingerprint)" != "$BEFORE" ]]; then
    echo "TEAM-006 apply-check.sql changed the schema" >&2
    exit 1
  fi
  psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$PROPOSAL/up.sql" >/dev/null
  APPLIED="$(fingerprint)"
  if (( SERVER_VERSION >= 170000 )); then
    if ! diff <(echo "$APPLIED") "$PROPOSAL/fingerprint-after.expected"; then
      echo "TEAM-006 schema fingerprint after up.sql differs from fingerprint-after.expected" >&2
      exit 1
    fi
  fi
  expect_check "$PROPOSAL/verify.sql" "TEAM-006 verify OK: .* teacher \\([0-9]*\\)/\\1 active"
  expect_check "$PROPOSAL/rollback-check.sql" "TEAM-006 rollback dry run OK: .* teacher \\([0-9]*\\)/\\1 active"
  if [[ "$(fingerprint)" != "$APPLIED" ]]; then
    echo "TEAM-006 rollback-check.sql changed the schema" >&2
    exit 1
  fi
  psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$PROPOSAL/test.sql" >/dev/null
  psql "$DATABASE_URL" "${PSQL_OPTS[@]}" -f "$PROPOSAL/down.sql" >/dev/null
  AFTER="$(fingerprint)"
  if [[ "$AFTER" != "$BEFORE" ]]; then
    diff <(echo "$BEFORE") <(echo "$AFTER") >&2 || true
    echo "TEAM-006 down.sql did not restore the schema" >&2
    exit 1
  fi
  psql "$DATABASE_URL" "${PSQL_OPTS[@]}" >/dev/null -c "DELETE FROM auth.users WHERE id = '$TEACHER_ID'"
  echo "TEAM-006 proposal: apply check, apply, verification, rollback check, test and rollback passed"
fi

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
