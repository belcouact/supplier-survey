-- 0. Drop conflicting policies
-- We need to drop these because they depend on the columns we are about to alter (template_id, user_id)
DROP POLICY IF EXISTS "Template owners can view results" ON survey_results;
DROP POLICY IF EXISTS "Template owners can delete results" ON survey_results;
DROP POLICY IF EXISTS "Users can view own results" ON survey_results;
DROP POLICY IF EXISTS "Users can update own results" ON survey_results;

-- CLEANUP: Remove invalid data
-- For template_id (target is bigint): remove non-numeric values
DELETE FROM survey_results
WHERE template_id !~ '^\d+$';

-- For user_id (target is uuid): remove non-uuid values (excluding 'anonymous')
DELETE FROM survey_results
WHERE user_id <> 'anonymous'
AND user_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- 1. Link survey_results to templates
-- Convert template_id to BIGINT (matching templates.id type)
alter table survey_results
  alter column template_id type bigint using template_id::bigint;

alter table survey_results
  add constraint fk_survey_results_template
  foreign key (template_id)
  references templates(id)
  on delete cascade;

-- 2. Link survey_results to users
-- Convert 'anonymous' to NULL and change type to UUID
alter table survey_results
  alter column user_id drop not null;

update survey_results
  set user_id = null
  where user_id = 'anonymous';

alter table survey_results
  alter column user_id type uuid using user_id::uuid;

alter table survey_results
  add constraint fk_survey_results_user
  foreign key (user_id)
  references auth.users(id)
  on delete set null;

-- 3. Re-create policies with correct types

ALTER TABLE survey_results ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view own results
CREATE POLICY "Users can view own results"
  ON survey_results FOR SELECT
  TO authenticated
  USING ( user_id = auth.uid() );

-- Policy: Users can update own results
CREATE POLICY "Users can update own results"
  ON survey_results FOR UPDATE
  TO authenticated
  USING ( user_id = auth.uid() );

-- Policy: Template owners can view results
-- Re-implemented to allow template owners to see all responses for their surveys
CREATE POLICY "Template owners can view results"
  ON survey_results FOR SELECT
  TO authenticated
  USING (
    exists (
      select 1 from templates
      where templates.id = survey_results.template_id
      and templates.created_by = auth.uid() -- CHANGED from user_id to created_by
    )
  );

-- Policy: Template owners can delete results
-- Re-implemented to allow template owners to delete responses for their surveys
CREATE POLICY "Template owners can delete results"
  ON survey_results FOR DELETE
  TO authenticated
  USING (
    exists (
      select 1 from templates
      where templates.id = survey_results.template_id
      and templates.created_by = auth.uid() -- CHANGED from user_id to created_by
    )
  );
