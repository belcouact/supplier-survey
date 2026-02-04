-- Function to copy a template to another user
-- This function bypasses RLS to allow admins to create templates for other users.
-- Run this in your Supabase SQL Editor.

create or replace function copy_template_to_user(
  new_title text,
  new_description text,
  new_schema jsonb,
  new_short_id text,
  expiration_date timestamptz,
  target_user_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  new_record templates;
begin
  insert into templates (
    title,
    description,
    schema,
    short_id,
    expiration_date,
    created_at,
    created_by
  ) values (
    new_title,
    new_description,
    new_schema,
    new_short_id,
    expiration_date,
    now(),
    target_user_id
  ) returning * into new_record;
  
  return row_to_json(new_record);
end;
$$;
