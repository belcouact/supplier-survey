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
-- Super admin can do anything
CREATE POLICY "Super admin can do all on user_roles" ON user_roles
  FOR ALL USING (auth.uid() IN (SELECT id FROM user_roles WHERE role = 'super_admin'));

-- Users can read their own role
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
