-- Enable RLS on survey_results (ensure it is enabled)
ALTER TABLE survey_results ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to view their own results
-- This prevents creating duplicate entries when they save multiple times
CREATE POLICY "Users can view own results"
  ON survey_results FOR SELECT
  TO authenticated
  USING ( user_id = auth.uid()::text );

-- Policy to allow authenticated users to update their own results
-- This fixes the 403 Forbidden error when saving an existing survey
CREATE POLICY "Users can update own results"
  ON survey_results FOR UPDATE
  TO authenticated
  USING ( user_id = auth.uid()::text );
