-- TEAM-001: the first and only TEAM superadmin, set once after up.sql.
-- Run in the Supabase SQL Editor only with Vytis's approval, replacing
-- APPROVED_USER_ID with the auth user id he confirmed (Authentication > Users).
-- Superadmin rights are never derived from an email address.
--
-- Fails (nothing changed) when the id is not an existing auth user or a
-- superadmin already exists (index team_members_one_superadmin).
BEGIN;

DO $$
DECLARE
  approved uuid := 'APPROVED_USER_ID';
  inserted int;
BEGIN
  INSERT INTO public.team_members (user_id, email, full_name, role, status, activated_at)
  SELECT u.id, lower(u.email), coalesce(p.full_name, ''), 'superadmin', 'active', now()
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = approved;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted <> 1 THEN
    RAISE EXCEPTION 'No auth user with id %', approved;
  END IF;

  INSERT INTO public.team_activity_grants (user_id, activity, granted_by)
  SELECT approved, a, approved FROM unnest(ARRAY['ai-vault', 'water-lab', 'classroom']) AS a;
END
$$;

COMMIT;
