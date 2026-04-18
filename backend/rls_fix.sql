-- ============================================
-- RLS POLICY FIX FOR REGISTRATION
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- ============================================
-- FIXED PROFILES INSERT POLICY
-- Allows authenticated users to insert their own profile during signup
-- ============================================

-- Allow authenticated users to insert their own profile (id must match auth.uid)
CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Allow users to read their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- ============================================
-- ALTERNATIVE: Database Trigger for Auto Profile Creation
-- This creates a profile automatically when a user signs up
-- Uncomment if you prefer trigger-based approach
-- ============================================

/*
-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, second_name, third_name, phone, role, status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'second_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'third_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'),
        'pending'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
*/

-- ============================================
-- VERIFICATION QUERIES
-- Run these to verify policies are set correctly
-- ============================================

-- Check current policies on profiles table
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Test insert (replace with actual user ID after signup)
-- INSERT INTO profiles (id, email, first_name, second_name, third_name, phone, role)
-- VALUES ('your-auth-user-id', 'test@example.com', 'Test', 'User', 'Name', '+966501234567', 'student');
