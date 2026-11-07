-- Migration: Enable pgcrypto and update check_answer for bcrypt support
-- Answer verification now primarily happens in the API route (server-side bcrypt),
-- but we keep the DB function as a fallback for legacy plaintext hashes.

create extension if not exists pgcrypto;

-- Update check_answer to support both legacy plaintext and bcrypt hashes
create or replace function public.check_answer(
  p_challenge_id uuid,
  p_answer text
) returns boolean as $$
declare
  v_hash text;
  v_normalized text;
begin
  select answer_hash into v_hash
  from public.challenges
  where id = p_challenge_id;

  if v_hash is null then
    return false;
  end if;

  v_normalized := lower(trim(p_answer));

  -- Check if hash is bcrypt format (starts with $2)
  if v_hash like '$2%' then
    -- bcrypt verification via pgcrypto
    return v_hash = crypt(v_normalized, v_hash);
  else
    -- Legacy plaintext comparison
    return v_normalized = v_hash;
  end if;
end;
$$ language plpgsql security definer;
