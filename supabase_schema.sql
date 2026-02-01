-- Enable RLS on tables if not already enabled
alter table templates enable row level security;
alter table survey_results enable row level security;

-- Add created_by column to templates if it doesn't exist
alter table templates add column if not exists created_by uuid references auth.users(id);

-- -------------------------------------------------------------------------
-- Policies for 'templates'
-- -------------------------------------------------------------------------

-- 1. Select: Allow Public read (needed so anonymous users can load the survey by ID)
--    Note: We filter the 'List' view in the frontend/backend query for privacy.
create policy "Public templates access"
  on templates for select
  using ( true );

-- 2. Insert: Authenticated users can create templates
create policy "Users can create their own templates"
  on templates for insert
  to authenticated
  with check ( auth.uid() = created_by );

-- 3. Update: Users can update their own templates. Super Admins can update any.
--    (Assuming a custom claim or checking user metadata for super_admin is complex in pure SQL without helper functions,
--     so we'll stick to owner check for now. Super Admins can bypass RLS if using service role, or we can add specific logic.)
--    Simple version: Owner only.
create policy "Users can update own templates"
  on templates for update
  to authenticated
  using ( auth.uid() = created_by );

-- 4. Delete: Users can delete their own templates.
create policy "Users can delete own templates"
  on templates for delete
  to authenticated
  using ( auth.uid() = created_by );

-- -------------------------------------------------------------------------
-- Policies for 'survey_results'
-- -------------------------------------------------------------------------

-- 1. Insert: Public can submit results (Anonymous users)
create policy "Public can submit results"
  on survey_results for insert
  to anon, authenticated
  with check ( true );

-- 2. Select: Only the Template Owner can view results
create policy "Template owners can view results"
  on survey_results for select
  to authenticated
  using (
    exists (
      select 1 from templates
      where templates.id::text = survey_results.template_id
      and templates.created_by = auth.uid()
    )
  );

-- 3. Update/Delete: Usually not allowed or restricted to owner
create policy "Template owners can delete results"
  on survey_results for delete
  to authenticated
  using (
    exists (
      select 1 from templates
      where templates.id::text = survey_results.template_id
      and templates.created_by = auth.uid()
    )
  );
