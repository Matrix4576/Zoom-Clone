-- SMCC Live: minimum identity/profile layer for the static login prototype.
-- Apply with the Supabase CLI or SQL Editor using a project owner account.

begin;

do $$
begin
  create type public.account_role as enum ('admin', 'teacher', 'student');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.account_status as enum ('active', 'suspended', 'banned');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.account_role not null default 'student',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
grant select on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- No browser role/status/profile write policy is created. FastAPI will perform
-- provisioning and administrative changes with server credentials.
create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_auth_user();

-- Backfill any Auth users created before this migration. They remain students
-- until a project owner assigns their authoritative role/status server-side.
insert into public.profiles (id, display_name)
select id, nullif(raw_user_meta_data ->> 'display_name', '')
from auth.users
on conflict (id) do nothing;

commit;
