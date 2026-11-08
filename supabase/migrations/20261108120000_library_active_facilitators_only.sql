-- CLS-015 (decision S12 = B, Vytis Radvila 2026-11-08): the approved
-- library is for active, signed-in facilitators only.
--
-- Before: anon had every privilege on library_items (Supabase default
-- grant) and "read_approved_library" applied to role public, so anyone with
-- the public anon key could read every approved item through the Data API,
-- hints and reviewer notes included. Signed-in accounts that are pending or
-- blocked could read them too: the restrictive "Only active accounts ..."
-- policies covered INSERT, UPDATE and DELETE but not SELECT.
--
-- After: anon has no privilege on library_items. The read policy applies to
-- authenticated only, with the same rule as before, and a restrictive
-- SELECT policy requires an active account, as writes already do. The app
-- reads the library only with the facilitator's session, so nothing in the
-- app changes for active facilitators and administrators.
--
-- Data is not changed. Rollback: supabase/rollback/20261108120000_library_active_facilitators_only.sql
-- Procedure and checks: docs/migration-history.md, "CLS-015".

BEGIN;

REVOKE ALL ON public.library_items FROM anon;

DROP POLICY IF EXISTS "read_approved_library" ON public.library_items;
CREATE POLICY "read_approved_library" ON public.library_items
  FOR SELECT TO authenticated
  USING (
    status = 'approved'
    OR published_by = auth.uid()
    OR get_my_role() IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "Only active accounts read" ON public.library_items;
CREATE POLICY "Only active accounts read" ON public.library_items
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT public.is_active_account()));

COMMIT;
