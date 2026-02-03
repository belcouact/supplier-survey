-- Add status column to survey_results table to distinguish between saved and submitted responses
ALTER TABLE survey_results ADD COLUMN IF NOT EXISTS status TEXT;
