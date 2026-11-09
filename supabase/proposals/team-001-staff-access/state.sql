-- TEAM-001 state, read-only (only SELECTs): run in the production SQL Editor
-- before up.sql, after it and after first-superadmin.sql. Prints no email
-- addresses and no function source, only counts and an md5.
--
-- Before up.sql (2026-11-09): team_relations [], team_functions [],
-- profile_guard false, team_members null, handle_new_user_md5 as recorded.
-- After up.sql: 10 team_* relations (3 tables, 7 indexes), 3 functions,
-- profile_guard true, team_members {}, handle_new_user_md5 unchanged.
-- After first-superadmin.sql: team_members {"superadmin/active": 1},
-- users_marked_team 1, auth_users_without_profile 1.
select jsonb_build_object(
  'pg', current_setting('server_version'),
  'team_relations', (select coalesce(jsonb_agg(c.relname order by c.relname), '[]')
                     from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname like 'team\_%'),
  'team_functions', (select coalesce(jsonb_agg(p.proname order by p.proname), '[]')
                     from pg_proc p where p.pronamespace = 'public'::regnamespace
                       and p.proname in ('team_issue_token', 'team_touch_updated_at', 'skip_profile_for_team_users')),
  'profile_guard', exists(select 1 from pg_trigger where tgname = 'skip_profile_for_team_users'
                          and tgrelid = 'public.profiles'::regclass),
  -- team_members is read dynamically, so the query also runs before up.sql.
  'team_members', case when to_regclass('public.team_members') is null then null else
                    ((xpath('/row/v/text()', query_to_xml(
                      'select coalesce(jsonb_object_agg(k, n), ''{}'')::text as v from (
                         select role || ''/'' || status as k, count(*) as n from public.team_members group by 1) s',
                      false, true, '')))[1])::text::jsonb end,
  'auth_users', (select count(*) from auth.users),
  'profiles', (select count(*) from public.profiles),
  'auth_users_without_profile', (select count(*) from auth.users u
                                 where not exists (select 1 from public.profiles p where p.id = u.id)),
  'users_marked_team', (select count(*) from auth.users where raw_user_meta_data->>'kusteam_app' = 'team'),
  'handle_new_user_md5', (select md5(pg_get_functiondef('public.handle_new_user()'::regprocedure)))
) as team_001_state;
