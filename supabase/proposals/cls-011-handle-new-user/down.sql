-- Rollback for the CLS-011 proposal: restores the definition saved by up.sql
-- (in production, the hand-edited version). CREATE OR REPLACE keeps the
-- function's grants. The backup table is left in place.
BEGIN;
DO $$
BEGIN
  EXECUTE (SELECT def FROM backup_cls011.handle_new_user);
END
$$;
COMMIT;
