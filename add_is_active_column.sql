-- Run this SQL in your Supabase SQL Editor to fix the "is_active column not found" error

-- 1. Add the is_active column to the templates table
ALTER TABLE templates 
ADD COLUMN is_active BOOLEAN DEFAULT false;

-- 2. (Optional) Set the most recently created template as the active one
UPDATE templates 
SET is_active = true 
WHERE id = (
  SELECT id 
  FROM templates 
  ORDER BY created_at DESC 
  LIMIT 1
);
