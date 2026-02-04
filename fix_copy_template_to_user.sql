-- Fix the copy_template_to_user function to ensure it copies ONLY to the target user.
-- This function bypasses RLS to allow Super Admins to copy templates to other users.

CREATE OR REPLACE FUNCTION copy_template_to_user(
    new_title TEXT,
    new_description TEXT,
    new_schema JSONB,
    new_short_id TEXT,
    expiration_date TIMESTAMP WITH TIME ZONE,
    target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (should be super_admin/db_owner)
AS $$
DECLARE
    new_template_id BIGINT;
    result_record RECORD;
BEGIN
    -- Perform the insertion for the specific target_user_id
    INSERT INTO templates (
        title,
        description,
        schema,
        short_id,
        expiration_date,
        created_at,
        created_by -- Crucial: Assign to the target user
    )
    VALUES (
        new_title,
        new_description,
        new_schema,
        new_short_id,
        expiration_date,
        NOW(),
        target_user_id
    )
    RETURNING * INTO result_record;

    -- Return the newly created record as JSON
    RETURN to_jsonb(result_record);
END;
$$;
