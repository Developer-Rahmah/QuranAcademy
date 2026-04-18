# Backend - Supabase Configuration

This folder contains the Supabase database schema and configuration.

## Files

- `supabase_schema.sql` - Complete database schema including:
  - Table definitions
  - Enum types
  - Indexes
  - Functions
  - Triggers
  - Row Level Security (RLS) policies
  - Views

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Enter project details and create

### 2. Run Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase_schema.sql`
4. Paste into the editor
5. Click **Run** (or Cmd/Ctrl + Enter)

### 3. Verify Setup

1. Go to **Table Editor**
2. Verify these tables exist:
   - `profiles`
   - `halaqahs`
   - `halaqah_members`
   - `reports`
   - `report_items`

### 4. Create Admin User

1. Go to **Authentication** > **Users**
2. Click **Add user** > **Create new user**
3. Enter admin email and password
4. After creation, run in SQL Editor:
```sql
UPDATE profiles
SET role = 'admin', status = 'active'
WHERE email = 'admin@example.com';
```

### 5. Get API Credentials

1. Go to **Project Settings** > **API**
2. Copy:
   - **Project URL**
   - **anon public** key

Use these in the frontend `.env` file.

## Row Level Security

All tables have RLS enabled with policies that enforce:

- **Students**: Can only access their own data
- **Teachers**: Can access data for their assigned halaqahs
- **Admins**: Full access to all data

## Important Notes

- Never expose the `service_role` key in the frontend
- Only use the `anon` key for client-side operations
- RLS policies will automatically filter data based on the authenticated user
