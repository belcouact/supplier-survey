-- 1. Create user_roles table if it doesn't exist
create table if not exists public.user_roles (
  id uuid references auth.users(id) on delete cascade primary key,
  role text check (role in ('common_user', 'admin', 'super_admin')) default 'common_user',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS
alter table public.user_roles enable row level security;

-- Helper function to check admin status without recursion
-- SECURITY DEFINER allows it to bypass RLS when reading user_roles
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.user_roles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  );
end;
$$ language plpgsql security definer;

-- 3. RLS Policies

-- Allow users to read their own role
drop policy if exists "Users can read own role" on public.user_roles;
create policy "Users can read own role"
  on public.user_roles for select
  to authenticated
  using ( auth.uid() = id );

-- Allow admins/super_admins to read all roles (for Admin Dashboard)
-- Uses the security definer function to avoid infinite recursion
drop policy if exists "Admins can read all roles" on public.user_roles;
create policy "Admins can read all roles"
  on public.user_roles for select
  to authenticated
  using ( public.is_admin() );

-- Allow admins to update roles
drop policy if exists "Admins can update roles" on public.user_roles;
create policy "Admins can update roles"
  on public.user_roles for update
  to authenticated
  using ( public.is_admin() );

-- 4. Trigger to automatically create entry in user_roles when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_roles (id, role)
  values (new.id, 'common_user');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Backfill script: Ensure all existing users have a role entry
insert into public.user_roles (id, role)
select id, coalesce(raw_user_meta_data->>'role', 'common_user') 
from auth.users
where id not in (select id from public.user_roles);
