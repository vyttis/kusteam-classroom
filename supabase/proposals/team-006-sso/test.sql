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
-- e1: d1's TEAM session, e2 and e6: d1's CLASSROOM sessions, e3: d2's TEAM
-- session, e4: d3's TEAM session, e5: d4's CLASSROOM session.
INSERT INTO auth.sessions (id, user_id) VALUES
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000d1'),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000d2'),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000d3'),
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-0000000000d4'),
  ('00000000-0000-4000-8000-0000000000e6', '00000000-0000-4000-8000-0000000000d1');

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
    PERFORM 1 FROM public.team_sessions;
    RAISE EXCEPTION 'authenticated read team_sessions';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.team_register_session('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e2');
    RAISE EXCEPTION 'authenticated registered a TEAM session';
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

-- 2. TEAM sessions and issuing codes (as the service role, like the TEAM server).
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$
DECLARE
  ch constant text := 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  r text;
BEGIN
  -- TEAM registers the sessions it created; nothing else counts.
  IF NOT public.team_register_session('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e1')
     OR NOT public.team_register_session('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000e3')
     OR NOT public.team_register_session('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000e4') THEN
    RAISE EXCEPTION 'registering TEAM sessions failed';
  END IF;
  IF public.team_register_session('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e3') THEN
    RAISE EXCEPTION 'registered another person''s session';
  END IF;
  IF public.team_register_session('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000e5') THEN
    RAISE EXCEPTION 'registered a session of someone who is not a TEAM member';
  END IF;

  r := public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'classroom',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-1'), 'hex'), ch);
  IF r <> 'ok' THEN RAISE EXCEPTION 'issue for a granted member: %', r; END IF;

  -- A session of the same person that TEAM did not create (CLASSROOM's) is not a TEAM session.
  r := public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'water-lab',
    '00000000-0000-4000-8000-0000000000e2', encode(sha256('code-x'), 'hex'), ch);
  IF r <> 'logged_out' THEN RAISE EXCEPTION 'issue with a non-TEAM session: %', r; END IF;

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

  -- A TEAM session of someone else.
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

  -- At most 20 codes per member and activity per minute; other activities are not affected.
  FOR i IN 1..20 LOOP
    r := public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'water-lab',
      '00000000-0000-4000-8000-0000000000e1', encode(sha256(convert_to('burst-' || i, 'UTF8')), 'hex'), ch);
    IF r <> 'ok' THEN RAISE EXCEPTION 'code % of 20 refused: %', i, r; END IF;
  END LOOP;
  r := public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'water-lab',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('burst-21'), 'hex'), ch);
  IF r <> 'rate_limited' THEN RAISE EXCEPTION 'the 21st code in a minute: %', r; END IF;
  r := public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'classroom',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('burst-other'), 'hex'), ch);
  IF r <> 'ok' THEN RAISE EXCEPTION 'a burst for one activity blocked another: %', r; END IF;
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

-- 4. Status follows live data; removing a grant and blocking end sessions for
-- good. As the owner: one case switches a trigger off for a moment.
RESET ROLE;
DO $$
DECLARE
  ch constant text := 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  v constant text := 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  r record;
  st record;
  sid uuid;
BEGIN
  -- Grant removed and given back at once: the session stays ended (trigger).
  PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'water-lab',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-g'), 'hex'), ch);
  SELECT * INTO r FROM public.team_sso_redeem_code('water-lab', encode(sha256('code-g'), 'hex'), v, encode(sha256('handle-g'), 'hex'));
  sid := r.session_id;
  DELETE FROM public.team_activity_grants
  WHERE user_id = '00000000-0000-4000-8000-0000000000d1' AND activity = 'water-lab';
  INSERT INTO public.team_activity_grants (user_id, activity)
  VALUES ('00000000-0000-4000-8000-0000000000d1', 'water-lab');
  SELECT * INTO st FROM public.team_sso_session_status('water-lab', sid);
  IF st.active OR st.reason <> 'grant_revoked' THEN RAISE EXCEPTION 'grant removed and given back: %', row_to_json(st); END IF;

  -- Blocked and unblocked at once: ended too.
  PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'water-lab',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-b'), 'hex'), ch);
  SELECT * INTO r FROM public.team_sso_redeem_code('water-lab', encode(sha256('code-b'), 'hex'), v, encode(sha256('handle-b'), 'hex'));
  sid := r.session_id;
  UPDATE public.team_members SET status = 'blocked' WHERE user_id = '00000000-0000-4000-8000-0000000000d1';
  UPDATE public.team_members SET status = 'active' WHERE user_id = '00000000-0000-4000-8000-0000000000d1';
  SELECT * INTO st FROM public.team_sso_session_status('water-lab', sid);
  IF st.active OR st.reason <> 'blocked' THEN RAISE EXCEPTION 'blocked and unblocked: %', row_to_json(st); END IF;

  -- Live: blocked right now (without a revocation record) is refused too.
  PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'water-lab',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-l'), 'hex'), ch);
  SELECT * INTO r FROM public.team_sso_redeem_code('water-lab', encode(sha256('code-l'), 'hex'), v, encode(sha256('handle-l'), 'hex'));
  sid := r.session_id;
  ALTER TABLE public.team_members DISABLE TRIGGER team_sso_revoke_on_block;
  UPDATE public.team_members SET status = 'blocked' WHERE user_id = '00000000-0000-4000-8000-0000000000d1';
  ALTER TABLE public.team_members ENABLE TRIGGER team_sso_revoke_on_block;
  SELECT * INTO st FROM public.team_sso_session_status('water-lab', sid);
  IF st.active OR st.reason <> 'blocked' THEN RAISE EXCEPTION 'live block: %', row_to_json(st); END IF;
  ALTER TABLE public.team_members DISABLE TRIGGER team_sso_revoke_on_block;
  UPDATE public.team_members SET status = 'active' WHERE user_id = '00000000-0000-4000-8000-0000000000d1';
  ALTER TABLE public.team_members ENABLE TRIGGER team_sso_revoke_on_block;
  SELECT * INTO st FROM public.team_sso_session_status('water-lab', sid);
  IF NOT st.active THEN RAISE EXCEPTION 'unrecorded block lifted, session should be active: %', st.reason; END IF;

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

  -- A client ends its own session by handle; another client's handle does nothing.
  PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'water-lab',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-h'), 'hex'), ch);
  SELECT * INTO r FROM public.team_sso_redeem_code('water-lab', encode(sha256('code-h'), 'hex'), v, encode(sha256('handle-h'), 'hex'));
  IF public.team_sso_revoke_handle('ai-vault', encode(sha256('handle-h'), 'hex')) <> 0 THEN
    RAISE EXCEPTION 'another client ended this session';
  END IF;
  IF public.team_sso_revoke_handle('water-lab', encode(sha256('handle-h'), 'hex')) <> 1 THEN
    RAISE EXCEPTION 'the client could not end its session';
  END IF;
  SELECT * INTO st FROM public.team_sso_session_status('water-lab', r.session_id);
  IF st.active OR st.reason <> 'logged_out' THEN RAISE EXCEPTION 'client sign-out: %', row_to_json(st); END IF;

  BEGIN
    PERFORM public.team_sso_revoke('00000000-0000-4000-8000-0000000000d1', 'whatever');
    RAISE EXCEPTION 'an unknown revoke reason was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'team_sso_revoke: unknown reason%' THEN RAISE; END IF;
  END;
END
$$;

-- 5. CLASSROOM: staff profile, link, restrictive RLS and the RPC checks.
SET ROLE service_role;
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

-- A teacher cannot make themself staff and is not affected by the staff rule.
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
  INSERT INTO public.games (teacher_id, title, game_code)
  VALUES ('00000000-0000-4000-8000-0000000000d4', 'Teacher game', 'SSOT01');
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE game_code = 'SSOT01') THEN
    RAISE EXCEPTION 'a teacher cannot read their own game';
  END IF;
  IF NOT public.is_active_account()
     OR NOT public.can_read_game((SELECT id FROM public.games WHERE game_code = 'SSOT01')) THEN
    RAISE EXCEPTION 'the RPC checks changed for a teacher';
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
  IF NOT public.is_active_account()
     OR NOT public.can_read_game((SELECT id FROM public.games WHERE game_code = 'SSOS01')) THEN
    RAISE EXCEPTION 'the RPC checks refuse live staff';
  END IF;
  BEGIN
    UPDATE public.profiles SET role = 'teacher' WHERE id = '00000000-0000-4000-8000-0000000000d1';
    RAISE EXCEPTION 'staff changed their own role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;

-- The same person through a session that is not linked (signed in to
-- CLASSROOM directly): no data, and the RPC checks say no.
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000d1", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000e6"}', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.games WHERE game_code = 'SSOS01') THEN
    RAISE EXCEPTION 'an unlinked session read staff data';
  END IF;
  IF public.is_active_account() THEN
    RAISE EXCEPTION 'is_active_account() true for an unlinked staff session';
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

-- Removing the grant: data and RPC checks closed at once, the CLASSROOM
-- session itself deleted, and giving the grant back does not reopen it.
DELETE FROM public.team_activity_grants
WHERE user_id = '00000000-0000-4000-8000-0000000000d1' AND activity = 'classroom';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.sessions WHERE id = '00000000-0000-4000-8000-0000000000e2') THEN
    RAISE EXCEPTION 'the CLASSROOM session of a revoked SSO session still exists';
  END IF;
END
$$;
INSERT INTO public.team_activity_grants (user_id, activity)
VALUES ('00000000-0000-4000-8000-0000000000d1', 'classroom');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000d1", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000e2"}', true);
DO $$
DECLARE
  game uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.games WHERE game_code = 'SSOS01') THEN
    RAISE EXCEPTION 'revoked staff still read data';
  END IF;
  SELECT id INTO game FROM public.games WHERE game_code = 'SSOT01';
  IF public.is_active_account() THEN
    RAISE EXCEPTION 'is_active_account() true for revoked staff';
  END IF;
END
$$;
RESET ROLE;
DO $$
BEGIN
  -- can_read_game is what get_game_stats and get_game_reflections check.
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  IF (SELECT public.can_read_game(id) FROM public.games WHERE game_code = 'SSOS01') THEN
    RAISE EXCEPTION 'can_read_game() true for revoked staff';
  END IF;
END
$$;

-- A new SSO session works again; a TEAM sign-out ends it.
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$
DECLARE
  r record;
BEGIN
  PERFORM public.team_sso_issue_code('00000000-0000-4000-8000-0000000000d1', 'classroom',
    '00000000-0000-4000-8000-0000000000e1', encode(sha256('code-cls-2'), 'hex'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  SELECT * INTO r FROM public.team_sso_redeem_code('classroom', encode(sha256('code-cls-2'), 'hex'),
    'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
  IF r.status <> 'ok' OR NOT public.team_sso_link_client_session(r.session_id, '00000000-0000-4000-8000-0000000000e6') THEN
    RAISE EXCEPTION 'second classroom sign-in: %', r.status;
  END IF;
END
$$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000d1', true);
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000d1", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000e6"}', true);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE game_code = 'SSOS01') THEN
    RAISE EXCEPTION 'a new TEAM sign-in did not reopen CLASSROOM';
  END IF;
END
$$;
RESET ROLE;
DELETE FROM auth.sessions WHERE id = '00000000-0000-4000-8000-0000000000e1';
SET ROLE authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.games WHERE game_code = 'SSOS01') OR public.is_active_account() THEN
    RAISE EXCEPTION 'staff data readable after the TEAM session ended';
  END IF;
END
$$;
RESET ROLE;

-- 6. Coverage guards.
DO $$
DECLARE
  missing text;
BEGIN
  -- Every public table with RLS has the staff rule, or is excluded on purpose.
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relrowsecurity
    AND c.relname NOT IN ('profiles', 'team_members', 'team_activity_grants', 'team_tokens',
                          'team_sso_codes', 'team_sso_sessions', 'team_sessions')
    AND NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = c.oid AND p.polname = 'TEAM staff only through an active TEAM sign-in'
        AND NOT p.polpermissive
    );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'tables without the TEAM staff rule: %', missing;
  END IF;

  -- Every SECURITY DEFINER function a signed-in client may call skips RLS,
  -- so it must apply the staff rule itself (directly or through
  -- is_active_account / can_read_game), or be one of the few that reveal
  -- nothing about facilitator data.
  SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY 1) INTO missing
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND p.proname NOT IN ('handle_new_user', 'get_my_role', 'get_platform_stats', 'team_staff_access_ok')
    AND p.prosrc !~ '(team_staff_access_ok|is_active_account|can_read_game)\(';
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY DEFINER functions without the TEAM staff rule: %', missing;
  END IF;
END
$$;

ROLLBACK;
