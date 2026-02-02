-- 1. Helper function for super_admin (ensures orphaned templates can be managed)
create or replace function public.is_super_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.user_roles
    where id = auth.uid()
    and role = 'super_admin'
  );
end;
$$ language plpgsql security definer;

-- 2. Ensure templates are NOT deleted when the creator (user) is deleted
-- Instead, set created_by to NULL (orphan the template) so it can still be accessed by Super Admins

DO $$
BEGIN
    -- Try to drop the existing constraint. The name is usually templates_created_by_fkey
    -- We use a block to avoid errors if it doesn't exist or has a different name
    BEGIN
        ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_created_by_fkey;
    EXCEPTION
        WHEN undefined_object THEN
            RAISE NOTICE 'Constraint templates_created_by_fkey not found';
    END;
END $$;

-- Re-add the constraint with ON DELETE SET NULL
ALTER TABLE templates
ADD CONSTRAINT templates_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES auth.users(id)
ON DELETE SET NULL;
