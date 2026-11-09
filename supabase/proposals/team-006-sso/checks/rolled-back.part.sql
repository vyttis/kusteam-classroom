  -- Checks of the state after the rollback: TEAM-001 as before TEAM-006.
  SELECT count(*) INTO chk_tables FROM pg_class
  WHERE relnamespace = 'public'::regnamespace
    AND relname IN ('team_sso_codes', 'team_sso_sessions', 'team_sessions');
  SELECT count(*) INTO chk_functions FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND proname IN (
    'team_sso_access', 'team_register_session', 'team_sso_issue_code', 'team_sso_redeem_code',
    'team_sso_session_status', 'team_sso_link_client_session', 'team_sso_revoke', 'team_sso_revoke_handle',
    'team_sso_revoke_on_change', 'protect_staff_role', 'team_staff_access_ok');
  SELECT count(*) INTO chk_rule FROM pg_proc
  WHERE oid IN ('public.is_active_account()'::regprocedure, 'public.can_read_game(uuid)'::regprocedure)
    AND prosrc LIKE '%team_staff_access_ok%';
  SELECT count(*) INTO chk_policies FROM pg_policies
  WHERE policyname = 'TEAM staff only through an active TEAM sign-in';
  SELECT count(*) INTO chk_triggers FROM pg_trigger
  WHERE NOT tgisinternal
    AND tgname IN ('protect_staff_role', 'team_sso_revoke_on_grant_removal', 'team_sso_revoke_on_block');
  SELECT coalesce(bool_and(pg_get_constraintdef(oid) NOT LIKE '%''staff''%'), false) INTO chk_role
  FROM pg_constraint WHERE conname = 'profiles_role_check' AND conrelid = 'public.profiles'::regclass;
  SELECT count(*) INTO chk_staff FROM public.profiles WHERE role = 'staff';
  chk_team001 := to_regclass('public.team_members') IS NOT NULL AND to_regclass('public.team_activity_grants') IS NOT NULL
    AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'skip_profile_for_team_users' AND NOT tgisinternal);
  SELECT prosrc NOT LIKE '%staff%' INTO chk_skip FROM pg_proc
  WHERE oid = 'public.skip_profile_for_team_users()'::regprocedure;
@TEACHER@
  chk_ok := chk_tables = 0 AND chk_functions = 0 AND chk_rule = 0 AND chk_policies = 0
    AND chk_triggers = 0 AND chk_role AND chk_staff = 0 AND chk_team001 AND chk_skip
    AND (chk_teacher IS NULL OR (chk_seen = chk_own AND chk_active));
  RAISE EXCEPTION 'TEAM-006 @LABEL@ %: tables %, functions %, staff rule %, policies %, triggers %, role check %, staff profiles %, TEAM-001 %, profile guard %, teacher %',
    CASE WHEN chk_ok THEN 'OK' ELSE 'FAILED' END,
    chk_tables, chk_functions, chk_rule, chk_policies, chk_triggers, chk_role, chk_staff, chk_team001, chk_skip,
    CASE WHEN chk_teacher IS NULL THEN 'none'
         ELSE chk_seen || '/' || chk_own || CASE WHEN chk_active THEN ' active' ELSE ' NOT active' END END;
