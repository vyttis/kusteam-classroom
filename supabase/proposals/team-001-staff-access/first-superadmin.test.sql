-- TEAM-001 first-superadmin.sql test, run by scripts/test-db.sh after up.sql
-- and test.sql. Fixtures (accounts made like Authentication > Add user, so
-- handle_new_user() gave each an empty CLASSROOM profile):
--   ...b1 signed in before, ...b2 has an active profile, ...b3 owns a
--   CLASSROOM activity: first-superadmin.sql refused all three;
--   ...b4 is new: first-superadmin.sql made it the TEAM superadmin.
DO $$
BEGIN
  IF (SELECT raw_user_meta_data->>'kusteam_app' FROM auth.users WHERE id = '00000000-0000-4000-8000-0000000000b4') IS DISTINCT FROM 'team' THEN
    RAISE EXCEPTION 'the new superadmin account must be marked TEAM-only';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-4000-8000-0000000000b4') THEN
    RAISE EXCEPTION 'the new superadmin account must have no CLASSROOM profile';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = '00000000-0000-4000-8000-0000000000b4'
                 AND role = 'superadmin' AND status = 'active' AND email = 'team-admin@example.invalid') THEN
    RAISE EXCEPTION 'the new account must be the active superadmin';
  END IF;
  IF (SELECT count(*) FROM public.team_activity_grants WHERE user_id = '00000000-0000-4000-8000-0000000000b4') <> 3 THEN
    RAISE EXCEPTION 'the superadmin must have all three activities';
  END IF;

  -- Refused accounts are exactly as they were.
  IF (SELECT count(*) FROM public.profiles WHERE id IN (
        '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b3')) <> 3
     OR NOT EXISTS (SELECT 1 FROM public.games WHERE teacher_id = '00000000-0000-4000-8000-0000000000b3')
     OR EXISTS (SELECT 1 FROM auth.users WHERE id IN (
        '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b3')
        AND raw_user_meta_data ? 'kusteam_app')
     OR EXISTS (SELECT 1 FROM public.team_members WHERE user_id <> '00000000-0000-4000-8000-0000000000b4') THEN
    RAISE EXCEPTION 'a refused account must be left unchanged';
  END IF;
END
$$;

-- Clean up the fixtures (their profiles, the activity and TEAM rows go with them).
DELETE FROM auth.users WHERE id IN (
  '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b2',
  '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000b4');
