-- Update RLS policies for templates to allow Super Admins to manage all templates

-- 1. Update Policy
DROP POLICY IF EXISTS "Users can update own templates" ON templates;
CREATE POLICY "Users can update own templates"
  ON templates FOR UPDATE
  TO authenticated
  USING ( auth.uid() = created_by OR public.is_super_admin() );

-- 2. Delete Policy
DROP POLICY IF EXISTS "Users can delete own templates" ON templates;
CREATE POLICY "Users can delete own templates"
  ON templates FOR DELETE
  TO authenticated
  USING ( auth.uid() = created_by OR public.is_super_admin() );
