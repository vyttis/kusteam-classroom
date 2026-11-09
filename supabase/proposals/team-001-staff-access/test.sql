-- TEAM-001 proposal test, run by scripts/test-db.sh after up.sql on the fully
-- migrated test database (supabase/tests/bootstrap.sql provides auth.users,
-- auth.uid() and the anon/authenticated/service_role roles). Everything runs
-- in one transaction that is rolled back.
BEGIN;

-- Fixtures, as the postgres owner.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'staff-a@example.invalid', '{"kusteam_app": "team", "full_name": "Staff A"}'),
  ('00000000-0000-4000-8000-0000000000a2', 'staff-b@example.invalid', '{"kusteam_app": "team"}'),
  ('00000000-0000-4000-8000-0000000000a3', 'teacher@example.invalid', '{"full_name": "Teacher"}');

DO $$
BEGIN
  -- TEAM users get no CLASSROOM profile; everyone else still does.
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id IN (
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2')) THEN
    RAISE EXCEPTION 'a TEAM auth user must not get a CLASSROOM profile';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-4000-8000-0000000000a3') THEN
    RAISE EXCEPTION 'a CLASSROOM sign-up must still get its profile';
  END IF;
END
$$;

INSERT INTO public.team_members (user_id, email, full_name, role, status) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'staff-a@example.invalid', 'Staff A', 'superadmin', 'active'),
  ('00000000-0000-4000-8000-0000000000a2', 'staff-b@example.invalid', 'Staff B', 'staff', 'active');
INSERT INTO public.team_activity_grants (user_id, activity) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'classroom'),
  ('00000000-0000-4000-8000-0000000000a2', 'water-lab');

DO $$
BEGIN
  -- Exactly one superadmin.
  BEGIN
    UPDATE public.team_members SET role = 'superadmin' WHERE user_id = '00000000-0000-4000-8000-0000000000a2';
    RAISE EXCEPTION 'a second superadmin must be refused';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  -- Only known activities.
  BEGIN
    INSERT INTO public.team_activity_grants (user_id, activity) VALUES ('00000000-0000-4000-8000-0000000000a2', 'admin');
    RAISE EXCEPTION 'an unknown activity must be refused';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$$;

-- team_issue_token: the limit holds, older links are cancelled.
DO $$
DECLARE
  first_id uuid;
  second_id uuid;
  third_id uuid;
  fourth_id uuid;
BEGIN
  first_id := public.team_issue_token('00000000-0000-4000-8000-0000000000a2', 'reset', repeat('a', 64), now() + interval '1 hour', 3, interval '15 minutes');
  second_id := public.team_issue_token('00000000-0000-4000-8000-0000000000a2', 'reset', repeat('b', 64), now() + interval '1 hour', 3, interval '15 minutes');
  third_id := public.team_issue_token('00000000-0000-4000-8000-0000000000a2', 'reset', repeat('c', 64), now() + interval '1 hour', 3, interval '15 minutes');
  fourth_id := public.team_issue_token('00000000-0000-4000-8000-0000000000a2', 'reset', repeat('d', 64), now() + interval '1 hour', 3, interval '15 minutes');
  IF first_id IS NULL OR second_id IS NULL OR third_id IS NULL THEN
    RAISE EXCEPTION 'three reset links within the window must be issued';
  END IF;
  IF fourth_id IS NOT NULL THEN
    RAISE EXCEPTION 'a fourth reset link within the window must be refused';
  END IF;
  IF (SELECT count(*) FROM public.team_tokens
      WHERE user_id = '00000000-0000-4000-8000-0000000000a2' AND purpose = 'reset' AND used_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'only the newest reset link may stay valid';
  END IF;
  -- Invitations have no limit and do not touch reset links.
  IF public.team_issue_token('00000000-0000-4000-8000-0000000000a2', 'invite', repeat('e', 64), now() + interval '72 hours') IS NULL THEN
    RAISE EXCEPTION 'an invitation without a limit must be issued';
  END IF;
END
$$;

-- Client roles. Staff B signed in.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a2', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.team_members) <> 1
     OR (SELECT user_id FROM public.team_members) <> '00000000-0000-4000-8000-0000000000a2' THEN
    RAISE EXCEPTION 'a member must see only their own member row';
  END IF;
  IF (SELECT array_agg(activity) FROM public.team_activity_grants) <> ARRAY['water-lab'] THEN
    RAISE EXCEPTION 'a member must see only their own grants';
  END IF;

  BEGIN
    UPDATE public.team_members SET role = 'superadmin', status = 'active';
    RAISE EXCEPTION 'a member must not be able to update member rows';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.team_activity_grants (user_id, activity) VALUES ('00000000-0000-4000-8000-0000000000a2', 'classroom');
    RAISE EXCEPTION 'a member must not be able to grant themself an activity';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.team_activity_grants;
    RAISE EXCEPTION 'a member must not be able to delete grants';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM count(*) FROM public.team_tokens;
    RAISE EXCEPTION 'team_tokens must not be readable by a signed-in user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.team_issue_token('00000000-0000-4000-8000-0000000000a2', 'reset', repeat('f', 64), now() + interval '1 hour');
    RAISE EXCEPTION 'team_issue_token must not be callable by a signed-in user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- A TEAM-only user has no CLASSROOM profile and so no CLASSROOM data or rights.
  IF EXISTS (SELECT 1 FROM public.profiles) OR EXISTS (SELECT 1 FROM public.games)
     OR EXISTS (SELECT 1 FROM public.library_items) OR EXISTS (SELECT 1 FROM public.lesson_plans) THEN
    RAISE EXCEPTION 'a TEAM-only user must not read CLASSROOM data';
  END IF;
  BEGIN
    INSERT INTO public.games (teacher_id, title) VALUES ('00000000-0000-4000-8000-0000000000a2', 'x');
    RAISE EXCEPTION 'a TEAM-only user must not create CLASSROOM activities';
  EXCEPTION WHEN insufficient_privilege OR foreign_key_violation OR not_null_violation OR check_violation THEN NULL;
  END;
END
$$;

RESET ROLE;

-- Anonymous visitors read nothing.
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.team_members;
    RAISE EXCEPTION 'anon must not read team_members';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM count(*) FROM public.team_activity_grants;
    RAISE EXCEPTION 'anon must not read team_activity_grants';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
RESET ROLE;

-- Deleting the auth user removes the TEAM rows with it.
DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-0000000000a2';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = '00000000-0000-4000-8000-0000000000a2')
     OR EXISTS (SELECT 1 FROM public.team_activity_grants WHERE user_id = '00000000-0000-4000-8000-0000000000a2')
     OR EXISTS (SELECT 1 FROM public.team_tokens WHERE user_id = '00000000-0000-4000-8000-0000000000a2') THEN
    RAISE EXCEPTION 'TEAM rows must go with the auth user';
  END IF;
END
$$;

ROLLBACK;
