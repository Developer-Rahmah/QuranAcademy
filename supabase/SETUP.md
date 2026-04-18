# Supabase Setup Guide

## Step 1: Create Environment Variables

Create `/frontend/.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these from: Supabase Dashboard > Settings > API

## Step 2: Run SQL Scripts

Go to Supabase Dashboard > SQL Editor and run these scripts IN ORDER:

1. **Run `schema.sql`** - Creates all tables and indexes
2. **Run `rls-policies.sql`** - Creates Row Level Security policies

## Step 3: Create Admin User

After running the scripts, create an admin user:

```sql
-- First, sign up a user through your app, then run this:
UPDATE profiles
SET role = 'admin', status = 'active'
WHERE email = 'admin@example.com';
```

## Data Flow Explained

```
┌──────────────┐      HTTPS        ┌──────────────┐
│   Frontend   │ ◄──────────────► │   Supabase   │
│   (React)    │   supabase-js     │   (Backend)  │
└──────────────┘                   └──────────────┘
       │                                  │
       │                                  │
   Uses these:                       Contains:
   - supabase.ts                     - auth.users (authentication)
   - AuthContext.tsx                 - profiles (user data)
   - db helpers                      - halaqahs (classes)
                                     - halaqah_members
                                     - reports
                                     - report_items
```

### Authentication Flow

1. User calls `signUp(email, password, profileData)`
2. Supabase creates user in `auth.users`
3. User is now authenticated (has JWT)
4. App inserts profile into `profiles` table
5. RLS policy `profiles_insert_own` allows this because `id = auth.uid()`
6. App signs out user (they wait for admin approval)

### Login Flow

1. User calls `signIn(email, password)`
2. Supabase verifies credentials
3. Returns JWT token
4. App fetches profile from `profiles` table
5. Checks if `status = 'active'`
6. If not active, signs out and shows error

### RLS (Row Level Security)

RLS controls WHO can do WHAT:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | Own profile + admin sees all | Only own (auth.uid) | Own + admin | Never |
| halaqahs | All authenticated | Admin only | Admin + teacher (own) | Admin only |
| halaqah_members | Own + teacher's students + admin | Admin only | - | Admin only |
| reports | Own + teacher's halaqah + admin | Student (own only) | Student (same day) | - |
| report_items | Same as reports | Student (own reports) | - | - |

## Troubleshooting

### "new row violates row-level security policy"

This means RLS is blocking the INSERT. Check:
1. Is the user authenticated?
2. Is `id` matching `auth.uid()`?
3. Run the RLS policies script again

### Profile not created after signup

Check browser console for errors. The signup flow:
1. Creates auth user (should succeed)
2. Inserts profile (needs RLS policy `profiles_insert_own`)

### Cannot see data after login

Check:
1. Is user status = 'active'?
2. Are RLS SELECT policies in place?

## Testing RLS Policies

In Supabase SQL Editor, test as a specific user:

```sql
-- Set the user context
SET request.jwt.claim.sub = 'user-uuid-here';

-- Test SELECT
SELECT * FROM profiles;

-- Test INSERT
INSERT INTO profiles (id, email, first_name, role)
VALUES ('user-uuid-here', 'test@test.com', 'Test', 'student');
```
