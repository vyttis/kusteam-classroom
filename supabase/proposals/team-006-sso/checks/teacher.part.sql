  -- A real teacher of this database, as that teacher through RLS: every own
  -- activity is visible and the account counts as active. 'none' when the
  -- database has no active teacher with an activity.
  SELECT g.teacher_id INTO chk_teacher
  FROM public.games g JOIN public.profiles p ON p.id = g.teacher_id
  WHERE p.role = 'teacher' AND p.status = 'active'
  GROUP BY g.teacher_id ORDER BY count(*) DESC, g.teacher_id LIMIT 1;
  IF chk_teacher IS NOT NULL THEN
    SELECT count(*) INTO chk_own FROM public.games WHERE teacher_id = chk_teacher;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', chk_teacher, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO chk_seen FROM public.games WHERE teacher_id = chk_teacher;
    SELECT public.is_active_account() INTO chk_active;
    RESET ROLE;
  END IF;
