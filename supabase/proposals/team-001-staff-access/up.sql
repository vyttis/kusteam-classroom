-- TEAM-001 proposal, not a migration yet: nothing in supabase/proposals is
-- applied by the Supabase CLI or to production. After Vytis approves it, it
-- becomes supabase/migrations/<timestamp>_team_staff_access.sql with down.sql
-- as its rollback (docs/migration-history.md, TEAM-001).
--
-- KU STEAM TEAM (komanda.kusteam.app, repo vyttis/kusteam-team) shares this
-- project's Supabase Auth (Vytis, 2026-11-09). Its staff accounts and their
-- activity access live in three tables of their own:
--
--   team_members          one row per staff member: role, status
--   team_activity_grants  which activities a member may open
--   team_tokens           one-time invitation and password reset links (hashes),
--                         issued through team_issue_token()
--
-- Only the TEAM server writes them, with the service role. A signed-in member
-- may read their own member row and grants; nobody else reads anything, and
-- team_tokens is not readable by any client role at all.
--
-- TEAM staff must not become CLASSROOM facilitators automatically. CLASSROOM's
-- handle_new_user() creates a profile for every new auth user; TEAM creates
-- its users with user_metadata.kusteam_app = 'team', and for those the profile
-- insert is skipped. handle_new_user() itself is not changed (CLS-011 is a
-- separate decision). The flag can only skip a profile, never grant anything:
-- TEAM access needs a team_members row, which only the service role writes.
BEGIN;

CREATE TABLE public.team_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email = lower(email) AND email LIKE '%@%'),
  full_name text NOT NULL DEFAULT '' CHECK (length(full_name) <= 120),
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'superadmin')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'blocked')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);
CREATE UNIQUE INDEX team_members_email_key ON public.team_members (email);
-- One superadmin (Vytis, set once by SQL with his approved user id). The
-- application has no way to change a role.
CREATE UNIQUE INDEX team_members_one_superadmin ON public.team_members (role) WHERE role = 'superadmin';

CREATE TABLE public.team_activity_grants (
  user_id uuid NOT NULL REFERENCES public.team_members(user_id) ON DELETE CASCADE,
  activity text NOT NULL CHECK (activity IN ('ai-vault', 'water-lab', 'classroom')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity)
);

CREATE TABLE public.team_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.team_members(user_id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('invite', 'reset')),
  -- sha256 of the random token sent by email; the token itself is never stored.
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX team_tokens_user_purpose ON public.team_tokens (user_id, purpose);

-- Issues a one-time link for a member in one step: at most p_max_recent links
-- of this purpose in p_window (NULL: no limit), older unused links of this
-- purpose cancelled, the new one inserted. A per-member lock makes parallel
-- requests wait, so a burst cannot send more emails than the limit or leave
-- two valid links. Returns the new token id, or NULL when over the limit.
-- Service role only.
CREATE FUNCTION public.team_issue_token(
  p_user_id uuid,
  p_purpose text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_max_recent integer DEFAULT NULL,
  p_window interval DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  new_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('team_tokens:' || p_user_id::text || ':' || p_purpose, 0));
  IF p_max_recent IS NOT NULL AND (
    SELECT count(*) FROM public.team_tokens t
    WHERE t.user_id = p_user_id AND t.purpose = p_purpose
      AND t.created_at > now() - coalesce(p_window, interval '15 minutes')
  ) >= p_max_recent THEN
    RETURN NULL;
  END IF;
  UPDATE public.team_tokens t SET used_at = now()
  WHERE t.user_id = p_user_id AND t.purpose = p_purpose AND t.used_at IS NULL;
  INSERT INTO public.team_tokens (user_id, purpose, token_hash, expires_at)
  VALUES (p_user_id, p_purpose, p_token_hash, p_expires_at)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE FUNCTION public.team_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.team_touch_updated_at();

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_activity_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tokens ENABLE ROW LEVEL SECURITY;

-- Supabase gives anon and authenticated every privilege on new public tables
-- by default; take them back and grant only reading own rows.
REVOKE ALL ON public.team_members, public.team_activity_grants, public.team_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.team_members, public.team_activity_grants TO authenticated;
GRANT ALL ON public.team_members, public.team_activity_grants, public.team_tokens TO service_role;
REVOKE ALL ON FUNCTION public.team_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.team_issue_token(uuid, text, text, timestamptz, integer, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_issue_token(uuid, text, text, timestamptz, integer, interval) TO service_role;

CREATE POLICY "Members read own row" ON public.team_members
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Members read own grants" ON public.team_activity_grants
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
-- team_tokens: no policy and no grant for client roles.

CREATE FUNCTION public.skip_profile_for_team_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = NEW.id AND u.raw_user_meta_data ->> 'kusteam_app' = 'team'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.skip_profile_for_team_users() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER skip_profile_for_team_users
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.skip_profile_for_team_users();

COMMIT;
