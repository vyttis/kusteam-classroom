  -- Checks of the applied state (the same in apply-check.sql and verify.sql).
  SELECT count(*) INTO chk_tables FROM pg_class
  WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity
    AND relname IN ('team_sso_codes', 'team_sso_sessions', 'team_sessions');
  SELECT count(*) INTO chk_functions FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND proname IN (
    'team_sso_access', 'team_register_session', 'team_sso_issue_code', 'team_sso_redeem_code',
    'team_sso_session_status', 'team_sso_link_client_session', 'team_sso_revoke', 'team_sso_revoke_handle',
    'team_sso_revoke_on_change', 'protect_staff_role', 'team_staff_access_ok');
  -- Only team_staff_access_ok() may be called by a client role (authenticated).
  SELECT count(*) INTO chk_exposed FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND proname IN (
    'team_sso_access', 'team_register_session', 'team_sso_issue_code', 'team_sso_redeem_code',
    'team_sso_session_status', 'team_sso_link_client_session', 'team_sso_revoke', 'team_sso_revoke_handle',
    'team_sso_revoke_on_change', 'protect_staff_role')
    AND (has_function_privilege('anon', oid, 'EXECUTE') OR has_function_privilege('authenticated', oid, 'EXECUTE'));
  SELECT count(*) INTO chk_rule FROM pg_proc
  WHERE oid IN ('public.is_active_account()'::regprocedure, 'public.can_read_game(uuid)'::regprocedure)
    AND prosrc LIKE '%team_staff_access_ok()%';
  SELECT count(*) INTO chk_policies FROM pg_policies
  WHERE policyname = 'TEAM staff only through an active TEAM sign-in' AND permissive = 'RESTRICTIVE';
  SELECT count(*) INTO chk_uncovered FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND c.relrowsecurity
    AND c.relname <> 'profiles' AND c.relname NOT LIKE 'team\_%'
    AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
                    AND p.polname = 'TEAM staff only through an active TEAM sign-in');
  chk_storage := to_regclass('storage.objects') IS NULL OR EXISTS (
    SELECT 1 FROM pg_policy p WHERE p.polrelid = to_regclass('storage.objects')
      AND p.polname = 'TEAM staff only through an active TEAM sign-in');
  SELECT count(*) INTO chk_triggers FROM pg_trigger
  WHERE NOT tgisinternal
    AND tgname IN ('protect_staff_role', 'team_sso_revoke_on_grant_removal', 'team_sso_revoke_on_block');
  SELECT coalesce(bool_and(pg_get_constraintdef(oid) LIKE '%''staff''%'), false) INTO chk_role
  FROM pg_constraint WHERE conname = 'profiles_role_check' AND conrelid = 'public.profiles'::regclass;
  SELECT count(*) INTO chk_staff FROM public.profiles WHERE role = 'staff';
  -- postgres owns the SECURITY DEFINER functions that end CLASSROOM sessions.
  chk_auth := has_table_privilege('auth.sessions', 'SELECT') AND has_table_privilege('auth.sessions', 'DELETE');
  -- The bodies of every function TEAM-006 creates or replaces are exactly
  -- the reviewed ones (md5 from the Postgres replay in test:db).
  SELECT md5(string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') ' || p.prosecdef
                        || ' ' || coalesce(array_to_string(p.proconfig, ','), '')
                        || ' ' || regexp_replace(p.prosrc, '\s+', ' ', 'g'),
                        E'\n' ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)))
  INTO chk_fn FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN (
    'team_sso_access', 'team_register_session', 'team_sso_issue_code', 'team_sso_redeem_code',
    'team_sso_session_status', 'team_sso_link_client_session', 'team_sso_revoke', 'team_sso_revoke_handle',
    'team_sso_revoke_on_change', 'protect_staff_role', 'team_staff_access_ok',
    'is_active_account', 'can_read_game', 'skip_profile_for_team_users');
@TEACHER@
  chk_ok_applied := chk_tables = 3 AND chk_functions = 11 AND chk_exposed = 0 AND chk_rule = 2
    AND chk_uncovered = 0 AND chk_storage AND chk_triggers = 3 AND chk_role AND chk_auth
    AND chk_fn = '@APPLIED_MD5@'
    AND chk_teacher IS NOT NULL AND chk_seen = chk_own AND chk_active;
  chk_msg_applied := format('tables %s, functions %s, exposed %s, staff rule %s, policies %s, uncovered %s, storage %s, triggers %s, role check %s, staff profiles %s, auth sessions %s, function bodies %s, teacher %s',
    chk_tables, chk_functions, chk_exposed, chk_rule, chk_policies, chk_uncovered, chk_storage,
    chk_triggers, chk_role, chk_staff, chk_auth, chk_fn = '@APPLIED_MD5@',
    CASE WHEN chk_teacher IS NULL THEN 'none'
         ELSE chk_seen || '/' || chk_own || CASE WHEN chk_active THEN ' active' ELSE ' NOT active' END END);
