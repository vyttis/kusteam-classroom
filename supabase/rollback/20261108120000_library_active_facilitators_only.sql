-- Rollback for 20261108120000_library_active_facilitators_only (CLS-015).
-- Restores the library read access exactly as production had it on
-- 2026-11-08 (Vytis Radvila checked in the SQL Editor that
-- "read_approved_library" applies to role public; the schema fingerprint
-- shows the same policies and grants as the migration files): anon gets
-- back the Supabase default grant (ALL), the read policy applies to public
-- again and the restrictive SELECT policy is removed. Data is not changed.
--
-- WARNING: this emergency rollback reopens the anonymous read that the
-- migration closes. After it, anyone with the public anon key can again
-- read every approved library item through the Data API, and pending or
-- blocked accounts can read them too. Use it only if the migration breaks
-- the library for active facilitators, and plan the fix right away. If
-- only the active-account check is the problem, use the partial rollback
-- in docs/migration-history.md ("CLS-015"), which keeps anon closed.

BEGIN;

DROP POLICY IF EXISTS "Only active accounts read" ON public.library_items;

DROP POLICY IF EXISTS "read_approved_library" ON public.library_items;
CREATE POLICY "read_approved_library" ON public.library_items
  FOR SELECT
  USING (
    status = 'approved'
    OR published_by = auth.uid()
    OR get_my_role() IN ('admin', 'super_admin')
  );

GRANT ALL ON public.library_items TO anon;

COMMIT;
