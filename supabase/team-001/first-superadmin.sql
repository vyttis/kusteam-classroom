-- TEAM-001: the first and only TEAM superadmin, set once after migration
-- 20261109111400_team_staff_access. Run in the Supabase SQL Editor only with
-- Vytis's approval, replacing APPROVED_USER_ID with the auth user id he
-- confirmed. Superadmin rights are never derived from an email address.
-- Production: done on 2026-11-09 for the separate TEAM account
-- (docs/migration-history.md, TEAM-001); a second run fails on
-- team_members_one_superadmin. scripts/test-db.sh tests the script.
--
-- The superadmin is a separate auth user used only for TEAM (Vytis,
-- 2026-11-09), never his CLASSROOM account: a TEAM password, reset link or
-- password change must not touch CLASSROOM sign-in. Make that user first in
-- Authentication > Users > Add user > Create new user (the TEAM email
-- address, a temporary password, Auto Confirm User on). Creating it ran
-- CLASSROOM's handle_new_user(), which gave it an empty CLASSROOM profile.
--
-- This script, in one transaction:
--   1. refuses (nothing changed) an account that was ever used: it signed
--      in, its CLASSROOM profile is not the untouched default (teacher,
--      pending, not onboarded), or any CLASSROOM row refers to it;
--   2. marks the user TEAM-only (user_metadata.kusteam_app = 'team', as TEAM
--      invitations do) and removes the empty CLASSROOM profile, so the
--      account has no CLASSROOM access;
--   3. adds it as the active TEAM superadmin with all three activities.
-- It fails as well when a superadmin already exists
-- (index team_members_one_superadmin).
BEGIN;

DO $$
DECLARE
  approved uuid := 'APPROVED_USER_ID';
  account_email text;
  account_signed_in timestamptz;
  profile record;
  ref record;
  used boolean;
BEGIN
  SELECT u.email, u.last_sign_in_at INTO account_email, account_signed_in
  FROM auth.users u WHERE u.id = approved FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No auth user with id %', approved;
  END IF;
  IF account_signed_in IS NOT NULL THEN
    RAISE EXCEPTION 'Auth user % has signed in before: create a new account only for TEAM', approved;
  END IF;

  SELECT p.role, p.status, p.onboarding_completed, p.full_name INTO profile
  FROM public.profiles p WHERE p.id = approved FOR UPDATE;
  IF FOUND AND (profile.role <> 'teacher' OR profile.status <> 'pending' OR profile.onboarding_completed) THEN
    RAISE EXCEPTION 'Auth user % has a CLASSROOM profile in use: create a new account only for TEAM', approved;
  END IF;

  -- Any CLASSROOM row pointing at this profile (games and lesson plans would
  -- even be deleted with it): refuse instead.
  FOR ref IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.profiles'::regclass
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', ref.tbl, ref.col) INTO used USING approved;
    IF used THEN
      RAISE EXCEPTION 'Auth user % is referenced by %.%: create a new account only for TEAM', approved, ref.tbl, ref.col;
    END IF;
  END LOOP;

  UPDATE auth.users
  SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"kusteam_app": "team"}'::jsonb
  WHERE id = approved;
  DELETE FROM public.profiles WHERE id = approved;

  INSERT INTO public.team_members (user_id, email, full_name, role, status, activated_at)
  VALUES (approved, lower(account_email), coalesce(profile.full_name, ''), 'superadmin', 'active', now());

  INSERT INTO public.team_activity_grants (user_id, activity, granted_by)
  SELECT approved, a, approved FROM unnest(ARRAY['ai-vault', 'water-lab', 'classroom']) AS a;
END
$$;

COMMIT;
