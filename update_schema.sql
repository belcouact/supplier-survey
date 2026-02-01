-- Add columns to templates table
ALTER TABLE templates ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMP WITH TIME ZONE;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'common_user' CHECK (role IN ('super_admin', 'admin', 'common_user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policies for user_roles
-- Helper function to check super_admin status without recursion
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Super admin can do anything
DROP POLICY IF EXISTS "Super admin can do all on user_roles" ON user_roles;
CREATE POLICY "Super admin can do all on user_roles" ON user_roles
  FOR ALL USING (public.is_super_admin());

-- Function to get all users with details (including last_sign_in_at)
CREATE OR REPLACE FUNCTION public.get_users_with_details()
RETURNS TABLE (
  id UUID,
  email TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Check permission using the secure function
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    ur.id,
    ur.email,
    ur.role,
    ur.created_at,
    au.last_sign_in_at
  FROM public.user_roles ur
  JOIN auth.users au ON ur.id = au.id
  ORDER BY ur.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a user by ID
CREATE OR REPLACE FUNCTION public.delete_user_by_id(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Delete from user_roles first (manual cascade)
  DELETE FROM public.user_roles WHERE id = target_user_id;
  
  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users can read their own role
DROP POLICY IF EXISTS "Users can read own role" ON user_roles;
CREATE POLICY "Users can read own role" ON user_roles
  FOR SELECT USING (auth.uid() = id);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_roles (id, email, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'role', 'common_user')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Insert initial super admin (Update with actual ID if known, or handle manually)
-- INSERT INTO user_roles (id, email, role) VALUES ('USER_UUID', 'admin@wlgore.com', 'super_admin');
