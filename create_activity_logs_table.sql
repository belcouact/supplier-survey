-- 1. Create profiles table if it doesn't exist (Prerequisite)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public profiles are viewable by everyone.'
    ) THEN
        CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile.'
    ) THEN
        CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile.'
    ) THEN
        CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
END $$;

-- Backfill profiles from auth.users to ensure foreign keys work
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- 2. Create admin_activity_logs table
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_id UUID, -- Can be template_id or user_id
    target_type TEXT, -- 'TEMPLATE' or 'USER'
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can view all logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'admin_activity_logs' AND policyname = 'Super admins can view all activity logs'
    ) THEN
        CREATE POLICY "Super admins can view all activity logs" 
        ON public.admin_activity_logs 
        FOR SELECT 
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
          )
        );
    END IF;
END $$;

-- Policy: Admins/Super admins can insert logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'admin_activity_logs' AND policyname = 'Admins can insert activity logs'
    ) THEN
        CREATE POLICY "Admins can insert activity logs" 
        ON public.admin_activity_logs 
        FOR INSERT 
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
          )
        );
    END IF;
END $$;
