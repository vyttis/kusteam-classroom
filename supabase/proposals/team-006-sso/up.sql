-- TEAM-006 proposal: KU STEAM TEAM sign-in for activities (SSO). Not a
-- migration yet: nothing in supabase/proposals is applied by the CLI or to
-- production. Applied in production only with Vytis's approval, then it
-- becomes supabase/migrations/<timestamp>_team_sso.sql with down.sql as its
-- rollback (docs/migration-history.md, TEAM-006).
--
-- Decision and contract: kusteam-ai-lab docs/ADR-001-TEAM-SSO.md and
-- docs/TEAM-SSO-INTEGRATION-CONTRACT.md (v1).
--
-- What it adds:
--   team_sso_codes       one-time codes TEAM issues to an activity (hash only,
--                        60 s, single use, bound to client, member, TEAM
--                        session and a PKCE challenge)
--   team_sso_sessions    the activity sessions opened with those codes; their
--                        status is computed live (member, grant, TEAM session)
--   team_sessions        the Supabase sessions TEAM itself created with a
--                        password sign-in. Only these may open activities: a
--                        session made elsewhere for the same person (CLASSROOM
--                        creates one for staff) is never a TEAM session.
--   functions            register, issue, redeem, status, link, revoke:
--                        service role only. Removing a grant or blocking a
--                        member revokes in the same transaction (triggers).
--   profiles.role        new value 'staff': a TEAM staff member inside
--                        CLASSROOM, created only by the TEAM sign-in, never a
--                        teacher or an admin
--   RLS                  a restrictive policy on CLASSROOM facilitator data:
--                        a 'staff' request is refused unless its Supabase
--                        session is linked to an active SSO session.
--                        team_staff_access_ok() is true for everyone else, so
--                        teachers, admins and participants are unaffected.
--                        is_active_account() and can_read_game() (used by
--                        the SECURITY DEFINER RPCs that skip RLS) get the
--                        same rule.
--
-- It does not change Supabase Auth settings, handle_new_user() (CLS-011 is a
-- separate decision) or any teacher's data.
BEGIN;

-- 1. Tables ------------------------------------------------------------------

CREATE TABLE public.team_sso_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- sha256 of the opaque handle given to a remote client (WATER LAB, AI VAULT).
  -- NULL for CLASSROOM, which uses the id through the database.
  handle_hash text UNIQUE CHECK (handle_hash ~ '^[0-9a-f]{64}$'),
  client_id text NOT NULL CHECK (client_id IN ('classroom', 'water-lab', 'ai-vault')),
  user_id uuid NOT NULL REFERENCES public.team_members(user_id) ON DELETE CASCADE,
  -- The TEAM Supabase session (auth.sessions.id) that opened it.
  team_session_id uuid NOT NULL,
  -- CLASSROOM only: the CLASSROOM Supabase session created for it.
  client_session_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text CHECK (revoke_reason IN ('logged_out', 'blocked', 'grant_revoked', 'code_reused', 'client_signed_out')),
  CHECK ((revoked_at IS NULL) = (revoke_reason IS NULL))
);
CREATE INDEX team_sso_sessions_user ON public.team_sso_sessions (user_id, created_at);
CREATE INDEX team_sso_sessions_team_session ON public.team_sso_sessions (team_session_id);

CREATE TABLE public.team_sso_codes (
  code_hash text PRIMARY KEY CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  client_id text NOT NULL CHECK (client_id IN ('classroom', 'water-lab', 'ai-vault')),
  user_id uuid NOT NULL REFERENCES public.team_members(user_id) ON DELETE CASCADE,
  team_session_id uuid NOT NULL,
  code_challenge text NOT NULL CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  sso_session_id uuid REFERENCES public.team_sso_sessions(id) ON DELETE SET NULL
);
CREATE INDEX team_sso_codes_user_created ON public.team_sso_codes (user_id, created_at);
CREATE INDEX team_sso_codes_sso_session ON public.team_sso_codes (sso_session_id);

-- The Supabase sessions TEAM created (password sign-in on komanda.*),
-- registered by the TEAM server right after signing in.
CREATE TABLE public.team_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.team_members(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX team_sessions_user ON public.team_sessions (user_id, created_at);

ALTER TABLE public.team_sso_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_sso_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_sessions ENABLE ROW LEVEL SECURITY;
-- No client role reads or writes them; only the TEAM and CLASSROOM servers
-- through the service role.
REVOKE ALL ON public.team_sso_codes, public.team_sso_sessions, public.team_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.team_sso_codes, public.team_sso_sessions, public.team_sessions TO service_role;

-- 2. Live access check ---------------------------------------------------------
-- 'ok', or why the member may not use the activity now. The client id is the
-- activity key (contract section 2). The TEAM session must be one TEAM
-- registered (team_sessions) and must still exist in auth.sessions: a TEAM
-- sign-out, a password change or Supabase ending the session closes every
-- activity session opened from it.
CREATE FUNCTION public.team_sso_access(p_user uuid, p_activity text, p_team_session uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN m.user_id IS NULL THEN 'not_member'
    WHEN m.status = 'blocked' THEN 'blocked'
    WHEN m.status <> 'active' THEN 'not_member'
    WHEN NOT EXISTS (
      SELECT 1 FROM public.team_activity_grants g
      WHERE g.user_id = p_user AND g.activity = p_activity
    ) THEN 'grant_revoked'
    WHEN NOT EXISTS (
      SELECT 1 FROM public.team_sessions t
      WHERE t.session_id = p_team_session AND t.user_id = p_user
    ) THEN 'logged_out'
    WHEN NOT EXISTS (
      SELECT 1 FROM auth.sessions s
      WHERE s.id = p_team_session AND s.user_id = p_user
        AND (s.not_after IS NULL OR s.not_after > now())
    ) THEN 'logged_out'
    ELSE 'ok'
  END
  FROM (SELECT 1) AS one
  LEFT JOIN public.team_members m ON m.user_id = p_user
$$;

-- 2b. Register a TEAM session (TEAM sign-in, invitation, reset, password
--     change). Only a live session of that member counts. Forgets this
--     member's sessions that Supabase already ended.
CREATE FUNCTION public.team_register_session(p_user uuid, p_session uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.team_sessions t
  WHERE t.user_id = p_user
    AND NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = t.session_id);
  IF NOT EXISTS (SELECT 1 FROM public.team_members m WHERE m.user_id = p_user)
     OR NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = p_session AND s.user_id = p_user) THEN
    RETURN false;
  END IF;
  INSERT INTO public.team_sessions (session_id, user_id) VALUES (p_session, p_user)
  ON CONFLICT (session_id) DO NOTHING;
  RETURN EXISTS (SELECT 1 FROM public.team_sessions t WHERE t.session_id = p_session AND t.user_id = p_user);
END;
$$;

-- 3. Issue a code (TEAM /sso/authorize) -------------------------------------
-- Returns 'ok', 'invalid_client', 'rate_limited' or a reason from
-- team_sso_access. A per-member lock makes parallel requests wait, so the
-- limit (20 per member and activity per minute) holds under a burst.
CREATE FUNCTION public.team_sso_issue_code(
  p_user uuid,
  p_client text,
  p_team_session uuid,
  p_code_hash text,
  p_code_challenge text,
  p_ttl interval DEFAULT interval '60 seconds',
  p_max_per_minute integer DEFAULT 20
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  access text;
BEGIN
  IF p_client IS NULL OR p_client NOT IN ('classroom', 'water-lab', 'ai-vault') THEN
    RETURN 'invalid_client';
  END IF;
  IF p_ttl IS NULL OR p_ttl < interval '5 seconds' OR p_ttl > interval '5 minutes' THEN
    RAISE EXCEPTION 'team_sso_issue_code: code lifetime % out of range', p_ttl;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('team_sso_codes:' || p_user::text, 0));
  access := public.team_sso_access(p_user, p_client, p_team_session);
  IF access <> 'ok' THEN
    RETURN access;
  END IF;
  -- Per member and activity, so a burst for one activity never locks the others.
  IF (
    SELECT count(*) FROM public.team_sso_codes c
    WHERE c.user_id = p_user AND c.client_id = p_client AND c.created_at > now() - interval '1 minute'
  ) >= p_max_per_minute THEN
    RETURN 'rate_limited';
  END IF;
  -- Housekeeping for this member only (indexes on user_id, created_at).
  DELETE FROM public.team_sso_codes c
  WHERE c.user_id = p_user AND c.created_at < now() - interval '1 day';
  DELETE FROM public.team_sso_sessions s
  WHERE s.user_id = p_user AND s.expires_at < now() - interval '30 days';
  INSERT INTO public.team_sso_codes (code_hash, client_id, user_id, team_session_id, code_challenge, expires_at)
  VALUES (p_code_hash, p_client, p_user, p_team_session, p_code_challenge, now() + p_ttl);
  RETURN 'ok';
END;
$$;

-- 4. Redeem a code (TEAM /api/sso/token, CLASSROOM callback) ------------------
-- One transaction: the code row is locked, marked used before any other
-- check (a wrong verifier or an expired code burns it), then the PKCE
-- verifier and live access are checked and the session is created. A code
-- presented a second time ends the session created by its first use
-- (OAuth 2.1, section 4.1.3).
CREATE FUNCTION public.team_sso_redeem_code(
  p_client text,
  p_code_hash text,
  p_code_verifier text,
  p_handle_hash text DEFAULT NULL,
  p_ttl interval DEFAULT interval '8 hours'
)
RETURNS TABLE (
  status text,
  session_id uuid,
  user_id uuid,
  email text,
  full_name text,
  team_role text,
  activity text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  c public.team_sso_codes%ROWTYPE;
  m public.team_members%ROWTYPE;
  access text;
  challenge text;
  new_id uuid;
  ends timestamptz;
BEGIN
  IF p_ttl IS NULL OR p_ttl < interval '1 minute' OR p_ttl > interval '12 hours' THEN
    RAISE EXCEPTION 'team_sso_redeem_code: session lifetime % out of range', p_ttl;
  END IF;

  SELECT * INTO c FROM public.team_sso_codes WHERE code_hash = p_code_hash FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid_grant'::text, NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF c.used_at IS NOT NULL THEN
    WITH ended AS (
      UPDATE public.team_sso_sessions s
      SET revoked_at = now(), revoke_reason = 'code_reused'
      WHERE s.id = c.sso_session_id AND s.revoked_at IS NULL
      RETURNING s.client_session_id
    )
    DELETE FROM auth.sessions a WHERE a.id IN (SELECT e.client_session_id FROM ended e);
    RETURN QUERY SELECT 'invalid_grant'::text, NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- Burn the code first: whatever happens next, it cannot be tried again.
  UPDATE public.team_sso_codes SET used_at = now() WHERE code_hash = p_code_hash;

  challenge := CASE
    WHEN p_code_verifier ~ '^[A-Za-z0-9._~-]{43,128}$' THEN
      translate(rtrim(encode(sha256(convert_to(p_code_verifier, 'UTF8')), 'base64'), '='), '+/', '-_')
  END;
  IF c.client_id IS DISTINCT FROM p_client
     OR c.expires_at <= now()
     OR challenge IS NULL
     OR challenge <> c.code_challenge THEN
    RETURN QUERY SELECT 'invalid_grant'::text, NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  access := public.team_sso_access(c.user_id, c.client_id, c.team_session_id);
  IF access <> 'ok' THEN
    RETURN QUERY SELECT ('access_denied:' || access)::text, NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO m FROM public.team_members WHERE user_id = c.user_id;
  ends := now() + p_ttl;
  INSERT INTO public.team_sso_sessions (handle_hash, client_id, user_id, team_session_id, expires_at)
  VALUES (p_handle_hash, c.client_id, c.user_id, c.team_session_id, ends)
  RETURNING id INTO new_id;
  UPDATE public.team_sso_codes SET sso_session_id = new_id WHERE code_hash = p_code_hash;

  RETURN QUERY SELECT 'ok'::text, new_id, m.user_id, m.email, m.full_name, m.role, c.client_id, ends;
END;
$$;

-- 5. Session status (TEAM /api/sso/session, CLASSROOM proxy and RLS) ----------
-- Computed from live data on every call. Reasons as in the contract:
-- logged_out, blocked, grant_revoked, not_member, expired, unknown.
CREATE FUNCTION public.team_sso_session_status(
  p_client text,
  p_session_id uuid DEFAULT NULL,
  p_handle_hash text DEFAULT NULL
)
RETURNS TABLE (active boolean, reason text, user_id uuid, expires_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  s public.team_sso_sessions%ROWTYPE;
  access text;
BEGIN
  IF p_session_id IS NOT NULL THEN
    SELECT * INTO s FROM public.team_sso_sessions WHERE id = p_session_id AND client_id = p_client;
  ELSIF p_handle_hash IS NOT NULL THEN
    SELECT * INTO s FROM public.team_sso_sessions WHERE handle_hash = p_handle_hash AND client_id = p_client;
  END IF;
  IF s.id IS NULL THEN
    RETURN QUERY SELECT false, 'unknown'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  IF s.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT false,
      CASE s.revoke_reason
        WHEN 'blocked' THEN 'blocked'
        WHEN 'grant_revoked' THEN 'grant_revoked'
        WHEN 'code_reused' THEN 'unknown'
        ELSE 'logged_out'
      END::text,
      s.user_id, s.expires_at;
    RETURN;
  END IF;
  IF s.expires_at <= now() THEN
    RETURN QUERY SELECT false, 'expired'::text, s.user_id, s.expires_at;
    RETURN;
  END IF;
  access := public.team_sso_access(s.user_id, s.client_id, s.team_session_id);
  IF access <> 'ok' THEN
    RETURN QUERY SELECT false, access, s.user_id, s.expires_at;
    RETURN;
  END IF;
  RETURN QUERY SELECT true, NULL::text, s.user_id, s.expires_at;
END;
$$;

-- 6. CLASSROOM: link the CLASSROOM Supabase session to the SSO session ------
-- Only once, only for a live session of the same person.
CREATE FUNCTION public.team_sso_link_client_session(p_session_id uuid, p_client_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  linked uuid;
BEGIN
  UPDATE public.team_sso_sessions s
  SET client_session_id = p_client_session_id
  WHERE s.id = p_session_id
    AND s.client_id = 'classroom'
    AND s.client_session_id IS NULL
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND EXISTS (
      SELECT 1 FROM auth.sessions a
      WHERE a.id = p_client_session_id AND a.user_id = s.user_id
    )
  RETURNING s.id INTO linked;
  RETURN linked IS NOT NULL;
END;
$$;

-- 7. Explicit revocation (TEAM sign-out, blocking, grant removal, a client
--    signing out). Status is computed live anyway; this records why and
--    makes the end permanent even if access comes back later. A CLASSROOM
--    Supabase session opened by a revoked SSO session is deleted with it
--    (its refresh tokens go with it), so it cannot even be refreshed.
CREATE FUNCTION public.team_sso_revoke(
  p_user uuid,
  p_reason text,
  p_team_session uuid DEFAULT NULL,
  p_client text DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  n integer;
BEGIN
  IF p_reason NOT IN ('logged_out', 'blocked', 'grant_revoked', 'client_signed_out') THEN
    RAISE EXCEPTION 'team_sso_revoke: unknown reason %', p_reason;
  END IF;
  WITH ended AS (
    UPDATE public.team_sso_sessions s
    SET revoked_at = now(), revoke_reason = p_reason
    WHERE s.user_id = p_user
      AND s.revoked_at IS NULL
      AND (p_team_session IS NULL OR s.team_session_id = p_team_session)
      AND (p_client IS NULL OR s.client_id = p_client)
      AND (p_session_id IS NULL OR s.id = p_session_id)
    RETURNING s.client_session_id
  ), gone AS (
    DELETE FROM auth.sessions a WHERE a.id IN (SELECT e.client_session_id FROM ended e)
  )
  SELECT count(*) INTO n FROM ended;
  RETURN n;
END;
$$;

-- A client ends its own session (TEAM /api/sso/revoke, RFC 7009 shape):
-- only a session of that client, found by its handle hash.
CREATE FUNCTION public.team_sso_revoke_handle(p_client text, p_handle_hash text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  s public.team_sso_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.team_sso_sessions
  WHERE handle_hash = p_handle_hash AND client_id = p_client AND revoked_at IS NULL;
  IF s.id IS NULL THEN
    RETURN 0;
  END IF;
  RETURN public.team_sso_revoke(s.user_id, 'client_signed_out', NULL, p_client, s.id);
END;
$$;

-- Revocation in the same transaction as the change that causes it, so no
-- activity can miss a short gap (a grant removed and given back at once).
CREATE FUNCTION public.team_sso_revoke_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'team_activity_grants' THEN
    PERFORM public.team_sso_revoke(OLD.user_id, 'grant_revoked', NULL, OLD.activity);
    RETURN OLD;
  END IF;
  IF NEW.status = 'blocked' AND OLD.status IS DISTINCT FROM 'blocked' THEN
    PERFORM public.team_sso_revoke(NEW.user_id, 'blocked');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER team_sso_revoke_on_grant_removal
  AFTER DELETE ON public.team_activity_grants
  FOR EACH ROW EXECUTE FUNCTION public.team_sso_revoke_on_change();
CREATE TRIGGER team_sso_revoke_on_block
  AFTER UPDATE OF status ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.team_sso_revoke_on_change();

REVOKE ALL ON FUNCTION public.team_sso_revoke_on_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.team_sso_revoke_handle(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_sso_revoke_handle(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.team_register_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_register_session(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.team_sso_access(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.team_sso_issue_code(uuid, text, uuid, text, text, interval, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.team_sso_redeem_code(text, text, text, text, interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.team_sso_session_status(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.team_sso_link_client_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.team_sso_revoke(uuid, text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_sso_access(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.team_sso_issue_code(uuid, text, uuid, text, text, interval, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.team_sso_redeem_code(text, text, text, text, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.team_sso_session_status(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.team_sso_link_client_session(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.team_sso_revoke(uuid, text, uuid, text, uuid) TO service_role;

-- 8. CLASSROOM role 'staff' ----------------------------------------------------

ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('teacher', 'admin', 'super_admin', 'staff'));

-- Only the service role (the CLASSROOM server during the TEAM sign-in) may
-- give or take the 'staff' role. Anyone else, including a CLASSROOM admin
-- through the Data API, is refused. (The CLASSROOM admin API, which uses the
-- service role, refuses role changes for 'staff' profiles in code.)
CREATE FUNCTION public.protect_staff_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.role = 'staff')
     OR (TG_OP = 'UPDATE' AND (OLD.role = 'staff') IS DISTINCT FROM (NEW.role = 'staff')) THEN
    IF coalesce(auth.role(), '') <> 'service_role' AND current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'The staff role is set only by the KU STEAM TEAM sign-in'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_staff_role
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_staff_role();

-- TEAM-001 skipped every CLASSROOM profile of a TEAM user. A 'staff' profile
-- (inserted by the CLASSROOM server at the TEAM sign-in) is now let through;
-- the automatic 'teacher' profile from handle_new_user() is still skipped.
CREATE OR REPLACE FUNCTION public.skip_profile_for_team_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM 'staff' AND EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = NEW.id AND u.raw_user_meta_data ->> 'kusteam_app' = 'team'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 9. Restrictive RLS for 'staff' -------------------------------------------------
-- True for every caller who is not 'staff'. For 'staff': the request's
-- Supabase session (JWT session_id) must be linked to a CLASSROOM SSO session
-- that is active right now (member active, grant 'classroom', TEAM session
-- alive, not expired or revoked).
CREATE FUNCTION public.team_staff_access_ok()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sid uuid;
  sso uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'staff') THEN
    RETURN true;
  END IF;
  BEGIN
    sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  IF sid IS NULL THEN
    RETURN false;
  END IF;
  SELECT s.id INTO sso FROM public.team_sso_sessions s
  WHERE s.client_session_id = sid AND s.client_id = 'classroom' AND s.user_id = auth.uid();
  IF sso IS NULL THEN
    RETURN false;
  END IF;
  RETURN coalesce((SELECT st.active FROM public.team_sso_session_status('classroom', sso) st), false);
END;
$$;
REVOKE ALL ON FUNCTION public.team_staff_access_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_staff_access_ok() TO authenticated, service_role;

-- The SECURITY DEFINER functions that clients call skip RLS; they rely on
-- these two checks, which now include the staff rule too. Bodies otherwise
-- as before (20261106130000, 20261106120000); grants are kept.
CREATE OR REPLACE FUNCTION public.is_active_account()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
    AND public.team_staff_access_ok()
$$;

CREATE OR REPLACE FUNCTION public.can_read_game(game_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(auth.role(), '') = 'service_role'
    OR (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_uuid AND g.teacher_id = auth.uid())
        AND public.team_staff_access_ok())
    OR coalesce(public.get_my_role(), '') IN ('admin', 'super_admin')
$$;

-- Every CLASSROOM facilitator table with RLS (profiles and the team_* tables
-- excluded: own profile reads stay possible so the app can tell a staff
-- member why access ended). team-006 test.sql fails if a public table with
-- RLS is neither here nor in that exclusion list.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'access_requests', 'achievements', 'admin_audit_log', 'ai_usage', 'announcements',
    'challenges', 'games', 'hint_reveals', 'lesson_plans', 'library_items',
    'platform_settings', 'reflections', 'request_links', 'submissions', 'teams', 'templates'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY "TEAM staff only through an active TEAM sign-in" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
        'USING ((SELECT public.team_staff_access_ok())) WITH CHECK ((SELECT public.team_staff_access_ok()))', t);
    END IF;
  END LOOP;
END $$;

-- storage.objects exists wherever Supabase Storage runs (production, the
-- test bootstrap); a local stack started without Storage has no such table.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    CREATE POLICY "TEAM staff only through an active TEAM sign-in" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT public.team_staff_access_ok())) WITH CHECK ((SELECT public.team_staff_access_ok()));
  END IF;
END $$;

COMMIT;
