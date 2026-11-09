-- TEAM-006 proposal test, run by scripts/test-db.sh after up.sql on the
-- fully migrated test database (supabase/tests/bootstrap.sql provides
-- auth.users, auth.sessions, auth.uid(), auth.role(), auth.jwt() and the
-- roles). Everything runs in one transaction that is rolled back.
--
-- PKCE test vector from RFC 7636, appendix B:
--   verifier  dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
--   challenge E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
BEGIN;

-- Fixtures as the owner. d1 staff with classroom + water-lab, d2 staff with
-- water-lab only, d3 blocked, d4 a CLASSROOM teacher (not TEAM).
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'sso-staff@example.invalid', '{"kusteam_app": "team"}'),
  ('00000000-0000-4000-8000-0000000000d2', 'sso-other@example.invalid', '{"kusteam_app": "team"}'),
  ('00000000-0000-4000-8000-0000000000d3', 'sso-blocked@example.invalid', '{"kusteam_app": "team"}'),
  ('00000000-0000-4000-8000-0000000000d4', 'sso-teacher@example.invalid', '{}');
UPDATE public.profiles SET status = 'active', onboarding_completed = true
WHERE id = '00000000-0000-4000-8000-0000000000d4';
INSERT INTO public.team_members (user_id, email, full_name, role, status) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'sso-staff@example.invalid', 'Sso Staff', 'staff', 'active'),
  ('00000000-0000-4000-8000-0000000000d2', 'sso-other@example.invalid', '', 'staff', 'active'),
  ('00000000-0000-4000-8000-0000000000d3', 'sso-blocked@example.invalid', '', 'staff', 'blocked');
INSERT INTO public.team_activity_grants (user_id, activity) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'classroom'),
  ('00000000-0000-4000-8000-0000000000d1', 'water-lab'),
  ('00000000-0000-4000-8000-0000000000d2', 'water-lab'),
  ('00000000-0000-4000-8000-0000000000d3', 'classroom');
-- e1: d1's TEAM session, e2: d1's CLASSROOM session, e3: d2's TEAM session,
-- e4: d3's TEAM session, e5: d4's CLASSROOM session.
INSERT INTO auth.sessions (id, user_id) VALUES
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000d1'),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000d2'),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000d3'),
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-0000000000d4');

-- 1. Client roles cannot touch the SSO tables or call the SSO functions.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000d1', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.team_sso_codes;
    RAISE EXCEPTION 'authenticated read team_sso_codes';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.team_sso_sessions;
    RAISE EXCEPTION 'authenticated read team_sso_sessions';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'classroom',
      '00000000-0000-4000-8000-0000000000e1', repeat('a', 64), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    RAISE EXCEPTION 'authenticated issued a code';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.team_sso_session_status('classroom', gen_random_uuid());
    RAISE EXCEPTION 'authenticated called team_sso_session_status';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.team_sso_redeem_code('classroom', repeat('a', 64), 'x');
    RAISE EXCEPTION 'anon redeemed a code';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
RESET ROLE;

-- 2. Issuing codes (as the service role, like the TEAM server).
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$
DECLARE
  ch constant text := 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  r text;
BEGIN
  r := public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'classroom',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-1'), 'hex'), ch);
  IF r <> 'ok' THEN RAISE EXCEPTION 'issue for a granted member: %', r; END IF;

  r := public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d2', 'classroom',
    '00000000-0000-4000-8000-0000000000e3', encode(sha256('code-x'), 'hex'), ch);
  IF r <> 'grant_revoked' THEN RAISE EXCEPTION 'issue without the grant: %', r; END IF;

  r := public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d3', 'classroom',
    '00000000-0000-4000-8000-0000000000e4', encode(sha256('code-x'), 'hex'), ch);
  IF r <> 'blocked' THEN RAISE EXCEPTION 'issue for a blocked member: %', r; END IF;

  r := public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d4', 'classroom',
    '00000000-0000-4000-8000-0000000000e5', encode(sha256('code-x'), 'hex'), ch);
  IF r <> 'not_member' THEN RAISE EXCEPTION 'issue for a non-member: %', r; END IF;

  r := public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'evil',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-x'), 'hex'), ch);
  IF r <> 'invalid_client' THEN RAISE EXCEPTION 'issue for an unknown client: %', r; END IF;

  -- A TEAM session that does not exist, or belongs to someone else.
  r := public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'classroom',
    '00000000-0000-4000-8000-0000000000e3', encode(sha256('code-x'), 'hex'), ch);
  IF r <> 'logged_out' THEN RAISE EXCEPTION 'issue with another person''s session: %', r; END IF;

  BEGIN
    PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'classroom',
      '00000000-0000-4000-8000-0000000000e1', 'not-a-hash', ch);
    RAISE EXCEPTION 'a malformed code hash was stored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'classroom',
      '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-y'), 'hex'), ch, interval '1 hour');
    RAISE EXCEPTION 'a code lifetime of an hour was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'team_sso_issue_code: code lifetime%' THEN RAISE; END IF;
  END;

  -- At most 20 codes per member per minute (one issued above).
  FOR i IN 2..20 LOOP
    r := public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'water-lab',
      '00000000-0000-4000-8000-0000000000e1', encode(sha256(convert_to('burst-' || i, 'UTF8')), 'hex'), ch);
    IF r <> 'ok' THEN RAISE EXCEPTION 'code % of 20 refused: %', i, r; END IF;
  END LOOP;
  r := public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'water-lab',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('burst-21'), 'hex'), ch);
  IF r <> 'rate_limited' THEN RAISE EXCEPTION 'the 21st code in a minute: %', r; END IF;
  -- Let the burst age out for the rest of the test.
  UPDATE public.team_sso_codes SET created_at = now() - interval '2 minutes'
  WHERE user_id = '00000000-0000-4000-8000-0000000000d1';
END
$$;

-- 3. Redeeming.
DO $$
DECLARE
  ch constant text := 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  v constant text := 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  r record;
  st record;
BEGIN
  -- Wrong verifier: refused, and the code is burned.
  SELECT * INTO r FROM public.team_sso_redeem_code('classroom', encode(sha256('code-1'), 'hex'),
    'wrong-verifier-wrong-verifier-wrong-verifier-123');
  IF r.status <> 'invalid_grant' THEN RAISE EXCEPTION 'wrong verifier: %', r.status; END IF;
  SELECT * INTO r FROM public.team_sso_redeem_code('classroom', encode(sha256('code-1'), 'hex'), v);
  IF r.status <> 'invalid_grant' THEN RAISE EXCEPTION 'a burned code was accepted: %', r.status; END IF;

  -- Unknown code.
  SELECT * INTO r FROM public.team_sso_redeem_code('classroom', encode(sha256('nope'), 'hex'), v);
  IF r.status <> 'invalid_grant' THEN RAISE EXCEPTION 'unknown code: %', r.status; END IF;

  -- Another client's code.
  PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'water-lab',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-wl'), 'hex'), ch);
  SELECT * INTO r FROM public.team_sso_redeem_code('classroom', encode(sha256('code-wl'), 'hex'), v);
  IF r.status <> 'invalid_grant' THEN RAISE EXCEPTION 'another client''s code: %', r.status; END IF;

  -- Expired code.
  PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'classroom',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-old'), 'hex'), ch);
  UPDATE public.team_sso_codes SET expires_at = now() - interval '1 second'
  WHERE code_hash = encode(sha256('code-old'), 'hex');
  SELECT * INTO r FROM public.team_sso_redeem_code('classroom', encode(sha256('code-old'), 'hex'), v);
  IF r.status <> 'invalid_grant' THEN RAISE EXCEPTION 'expired code: %', r.status; END IF;

  -- Access lost between authorize and token.
  PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'water-lab',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-lost'), 'hex'), ch);
  DELETE FROM public.team_activity_grants
  WHERE user_id = '00000000-0000-4000-8000-0000000000d1' AND activity = 'water-lab';
  SELECT * INTO r FROM public.team_sso_redeem_code('water-lab', encode(sha256('code-lost'), 'hex'), v,
    encode(sha256('handle-lost'), 'hex'));
  IF r.status <> 'access_denied:grant_revoked' THEN RAISE EXCEPTION 'grant removed before redeem: %', r.status; END IF;
  INSERT INTO public.team_activity_grants (user_id, activity)
  VALUES ('00000000-0000-4000-8000-0000000000d1', 'water-lab');

  -- Success, then reuse ends the session.
  PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'water-lab',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-ok'), 'hex'), ch);
  SELECT * INTO r FROM public.team_sso_redeem_code('water-lab', encode(sha256('code-ok'), 'hex'), v,
    encode(sha256('handle-ok'), 'hex'));
  IF r.status <> 'ok' OR r.user_id <> '00000000-0000-4000-8000-0000000000d1'
     OR r.email <> 'sso-staff@example.invalid' OR r.team_role <> 'staff' OR r.activity <> 'water-lab'
     OR r.expires_at < now() + interval '7 hours 59 minutes' THEN
    RAISE EXCEPTION 'redeem result: %', row_to_json(r);
  END IF;
  SELECT * INTO st FROM public.team_sso_session_status('water-lab', NULL, encode(sha256('handle-ok'), 'hex'));
  IF NOT st.active THEN RAISE EXCEPTION 'new session not active: %', st.reason; END IF;
  SELECT * INTO st FROM public.team_sso_session_status('classroom', NULL, encode(sha256('handle-ok'), 'hex'));
  IF st.active OR st.reason <> 'unknown' THEN RAISE EXCEPTION 'session visible to another client'; END IF;

  SELECT * INTO r FROM public.team_sso_redeem_code('water-lab', encode(sha256('code-ok'), 'hex'), v,
    encode(sha256('handle-again'), 'hex'));
  IF r.status <> 'invalid_grant' THEN RAISE EXCEPTION 'code reuse: %', r.status; END IF;
  SELECT * INTO st FROM public.team_sso_session_status('water-lab', NULL, encode(sha256('handle-ok'), 'hex'));
  IF st.active THEN RAISE EXCEPTION 'code reuse did not end the first session'; END IF;
END
$$;

-- 4. Status follows live data: grant, block, TEAM session, expiry, revoke.
DO $$
DECLARE
  ch constant text := 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  v constant text := 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  r record;
  st record;
  sid uuid;
BEGIN
  PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'water-lab',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-live'), 'hex'), ch);
  SELECT * INTO r FROM public.team_sso_redeem_code('water-lab', encode(sha256('code-live'), 'hex'), v,
    encode(sha256('handle-live'), 'hex'));
  sid := r.session_id;

  DELETE FROM public.team_activity_grants
  WHERE user_id = '00000000-0000-4000-8000-0000000000d1' AND activity = 'water-lab';
  SELECT * INTO st FROM public.team_sso_session_status('water-lab', sid);
  IF st.active OR st.reason <> 'grant_revoked' THEN RAISE EXCEPTION 'grant removed: %', row_to_json(st); END IF;
  INSERT INTO public.team_activity_grants (user_id, activity)
  VALUES ('00000000-0000-4000-8000-0000000000d1', 'water-lab');

  UPDATE public.team_members SET status = 'blocked' WHERE user_id = '00000000-0000-4000-8000-0000000000d1';
  SELECT * INTO st FROM public.team_sso_session_status('water-lab', sid);
  IF st.active OR st.reason <> 'blocked' THEN RAISE EXCEPTION 'blocked: %', row_to_json(st); END IF;
  UPDATE public.team_members SET status = 'active' WHERE user_id = '00000000-0000-4000-8000-0000000000d1';

  SELECT * INTO st FROM public.team_sso_session_status('water-lab', sid);
  IF NOT st.active THEN RAISE EXCEPTION 'access back, session should be active: %', st.reason; END IF;

  UPDATE public.team_sso_sessions SET expires_at = now() - interval '1 second' WHERE id = sid;
  SELECT * INTO st FROM public.team_sso_session_status('water-lab', sid);
  IF st.active OR st.reason <> 'expired' THEN RAISE EXCEPTION 'expired: %', row_to_json(st); END IF;
  UPDATE public.team_sso_sessions SET expires_at = now() + interval '1 hour' WHERE id = sid;

  IF public.team_sso_revoke('00000000-0000-4000-8000-0000000000d1', 'logged_out',
       '00000000-0000-4000-8000-0000000000e1') < 1 THEN
    RAISE EXCEPTION 'revoke by TEAM session changed nothing';
  END IF;
  SELECT * INTO st FROM public.team_sso_session_status('water-lab', sid);
  IF st.active OR st.reason <> 'logged_out' THEN RAISE EXCEPTION 'revoked: %', row_to_json(st); END IF;

  BEGIN
    PERFORM public.team_sso_revoke('00000000-0000-4000-8000-0000000000d1', 'whatever');
    RAISE EXCEPTION 'an unknown revoke reason was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'team_sso_revoke: unknown reason%' THEN RAISE; END IF;
  END;
END
$$;

-- 5. CLASSROOM: staff profile, link, restrictive RLS.
DO $$
DECLARE
  ch constant text := 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  v constant text := 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  r record;
BEGIN
  -- The CLASSROOM server creates the staff profile (service role) for a TEAM user.
  INSERT INTO public.profiles (id, email, full_name, role, status, onboarding_completed)
  VALUES ('00000000-0000-4000-8000-0000000000d1', 'sso-staff@example.invalid', 'Sso Staff', 'staff', 'active', true);
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-4000-8000-0000000000d1' AND role = 'staff') THEN
    RAISE EXCEPTION 'the staff profile of a TEAM user was skipped';
  END IF;

  PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'classroom',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-cls'), 'hex'), ch);
  SELECT * INTO r FROM public.team_sso_redeem_code('classroom', encode(sha256('code-cls'), 'hex'), v);
  IF r.status <> 'ok' THEN RAISE EXCEPTION 'classroom redeem: %', r.status; END IF;

  -- Linking needs a session of the same person, once.
  IF public.team_sso_link_client_session(r.session_id, '00000000-0000-4000-8000-0000000000e5') THEN
    RAISE EXCEPTION 'linked another person''s session';
  END IF;
  IF NOT public.team_sso_link_client_session(r.session_id, '00000000-0000-4000-8000-0000000000e2') THEN
    RAISE EXCEPTION 'link failed';
  END IF;
  IF public.team_sso_link_client_session(r.session_id, '00000000-0000-4000-8000-0000000000e2') THEN
    RAISE EXCEPTION 'linked twice';
  END IF;
END
$$;
RESET ROLE;

-- The teacher cannot make themself staff, nor can anyone give it through the Data API.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000d4', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000d4", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000e5"}', true);
DO $$
BEGIN
  BEGIN
    UPDATE public.profiles SET role = 'staff' WHERE id = '00000000-0000-4000-8000-0000000000d4';
    RAISE EXCEPTION 'a teacher made themself staff';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- A teacher is not affected by the staff rule.
  INSERT INTO public.games (teacher_id, title, game_code)
  VALUES ('00000000-0000-4000-8000-0000000000d4', 'Teacher game', 'SSOT01');
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE game_code = 'SSOT01') THEN
    RAISE EXCEPTION 'a teacher cannot read their own game';
  END IF;
END
$$;
RESET ROLE;

-- Staff through the linked CLASSROOM session e2: allowed while access is live.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000d1', true);
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000d1", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000e2"}', true);
DO $$
BEGIN
  INSERT INTO public.games (teacher_id, title, game_code)
  VALUES ('00000000-0000-4000-8000-0000000000d1', 'Staff game', 'SSOS01');
  IF (SELECT count(*) FROM public.games WHERE game_code IN ('SSOS01', 'SSOT01')) <> 1 THEN
    RAISE EXCEPTION 'staff must see their own game and not the teacher''s';
  END IF;
  BEGIN
    UPDATE public.profiles SET role = 'teacher' WHERE id = '00000000-0000-4000-8000-0000000000d1';
    RAISE EXCEPTION 'staff changed their own role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;

-- The same person through a session that is not linked (signed in to
-- CLASSROOM directly): no data.
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000d1", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000e1"}', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.games WHERE game_code = 'SSOS01') THEN
    RAISE EXCEPTION 'an unlinked session read staff data';
  END IF;
  BEGIN
    INSERT INTO public.games (teacher_id, title, game_code)
    VALUES ('00000000-0000-4000-8000-0000000000d1', 'Sneaky', 'SSOS02');
    RAISE EXCEPTION 'an unlinked session wrote staff data';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
-- No session_id at all.
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000d1", "role": "authenticated"}', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.games WHERE game_code = 'SSOS01') THEN
    RAISE EXCEPTION 'a token without session_id read staff data';
  END IF;
END
$$;
RESET ROLE;

-- Removing the grant ends data access at once, giving it back restores it.
DELETE FROM public.team_activity_grants
WHERE user_id = '00000000-0000-4000-8000-0000000000d1' AND activity = 'classroom';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000d1", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000e2"}', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.games WHERE game_code = 'SSOS01') THEN
    RAISE EXCEPTION 'staff without the grant still read data';
  END IF;
END
$$;
RESET ROLE;
INSERT INTO public.team_activity_grants (user_id, activity)
VALUES ('00000000-0000-4000-8000-0000000000d1', 'classroom');

-- A TEAM sign-out (the TEAM Supabase session row is deleted) ends it too.
DELETE FROM auth.sessions WHERE id = '00000000-0000-4000-8000-0000000000e1';
SET ROLE authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.games WHERE game_code = 'SSOS01') THEN
    RAISE EXCEPTION 'staff data readable after the TEAM session ended';
  END IF;
END
$$;
RESET ROLE;

-- 6. Every public table with RLS is covered by the staff rule, or excluded on purpose.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relrowsecurity
    AND c.relname NOT IN ('profiles', 'team_members', 'team_activity_grants', 'team_tokens',
                          'team_sso_codes', 'team_sso_sessions')
    AND NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = c.oid AND p.polname = 'TEAM staff only through an active TEAM sign-in'
        AND NOT p.polpermissive
    );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'tables without the TEAM staff rule: %', missing;
  END IF;
END
$$;

ROLLBACK;
