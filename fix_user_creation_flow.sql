-- Fix User Creation Flow
-- 1. Ensure user_roles has email column
alter table public.user_roles add column if not exists email text;

-- 2. Update the handle_new_user function to correctly populate email in user_roles
-- and optionally in profiles if the table exists.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Insert into user_roles (Main logic)
  insert into public.user_roles (id, email, role)
  values (
    new.id, 
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'common_user')
  )
  on conflict (id) do update set 
    email = excluded.email,
    role = excluded.role;

  -- Insert into profiles (Legacy support)
  -- We use dynamic SQL to avoid errors if the profiles table doesn't exist
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    execute 'insert into public.profiles (id, email) values ($1, $2) on conflict (id) do update set email = excluded.email' 
    using new.id, new.email;
  end if;

  return new;
end;
$$;

-- 3. Recreate the trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Backfill missing emails in user_roles
-- This fixes existing users who have null emails
update public.user_roles ur
set email = au.email
from auth.users au
where ur.id = au.id
and ur.email is null;
