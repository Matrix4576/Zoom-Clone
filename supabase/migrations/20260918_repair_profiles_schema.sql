-- Repair an existing early `public.profiles` table so it matches the login
-- contract. Apply this once in the Supabase SQL Editor. It does not change
-- `auth.users`, which is a Supabase-managed schema.

begin;

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists status text not null default 'active';

-- The existing table already has `role`; ensure the automatic trigger can
-- create future accounts even when no role was supplied at creation time.
update public.profiles
set role = 'student'
where role is null;

alter table public.profiles
  alter column role set default 'student';

-- Make the permitted lifecycle states explicit. The `not valid` / `validate`
-- form keeps this safe for an existing table while still checking all rows.
alter table public.profiles
  drop constraint if exists profiles_status_check;

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'suspended', 'banned')) not valid;

alter table public.profiles
  validate constraint profiles_status_check;

-- The client may only read its own profile. Profile writes remain server-only.
alter table public.profiles enable row level security;
revoke all on table public.profiles from anon;
grant select on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Ensure users added from now on receive a profile automatically.
create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, status)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_auth_user();

-- Backfill all Auth users that do not yet have a profile.
insert into public.profiles (id, email, display_name, status)
select
  id,
  email,
  nullif(raw_user_meta_data ->> 'display_name', ''),
  'active'
from auth.users
on conflict (id) do nothing;

commit;
