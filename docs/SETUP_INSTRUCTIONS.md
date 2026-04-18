# Setup Instructions

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Supabase account (free tier is sufficient)

## 1. Supabase Setup

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Enter project details:
   - Name: `quran-academy`
   - Database Password: (save this securely)
   - Region: Choose closest to your users
5. Click "Create new project"
6. Wait for project to initialize

### 1.2 Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy entire contents of `backend/supabase_schema.sql`
4. Paste into the editor
5. Click **Run** (or Cmd/Ctrl + Enter)
6. Verify all tables were created in **Table Editor**

### 1.3 Get API Keys

1. Go to **Project Settings** (gear icon)
2. Click **API** in sidebar
3. Copy these values:
   - **Project URL** (e.g., `https://mrkulyorxxpgcbbxmpvz.supabase.co`)
   - **anon public** key (eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ya3VseW9yeHhwZ2NiYnhtcHZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNDg0MTAsImV4cCI6MjA4NDkyNDQxMH0.oo680Jow6akvT04smcIGrRMokjfC4cSsf8zGS38aX2E)

### 1.4 Configure Authentication

1. Go to **Authentication** > **Providers**
2. Ensure **Email** provider is enabled
3. Go to **Authentication** > **URL Configuration**
4. Set Site URL: `http://localhost:5173` (for development)
5. Add redirect URLs:
   - `http://localhost:5173/**`
   - Your production URL when ready

### 1.5 Create First Admin User

1. Go to **Authentication** > **Users**
2. Click **Add user** > **Create new user**
3. Enter admin email and password
4. After user is created, go to **SQL Editor**
5. Run:

```sql
UPDATE profiles
SET role = 'admin', status = 'active'
WHERE email = 'your-admin@email.com';
```

## 2. Frontend Setup

### 2.1 Install Dependencies

```bash
cd frontend
npm install
```

### 2.2 Configure Environment Variables

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Edit `.env` with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2.3 Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## 3. Testing the Application

### 3.1 Test Registration Flow

1. Go to `http://localhost:5173`
2. Click "إنشاء حساب جديد" (Create new account)
3. Select account type (Student/Teacher)
4. Fill out registration form
5. Submit and verify success page

### 3.2 Test Login (Admin)

1. Log in with admin credentials
2. Verify admin dashboard loads
3. Test creating a halaqah
4. Test assigning teachers/students

### 3.3 Test Student Flow

1. Approve a student registration (as admin)
2. Log in as student
3. View dashboard
4. Submit a report

### 3.4 Test Teacher Flow

1. Approve a teacher registration (as admin)
2. Assign teacher to halaqah (as admin)
3. Log in as teacher
4. View assigned students

## 4. Deployment

### 4.1 Build for Production

```bash
cd frontend
npm run build
```

### 4.2 Deploy to Vercel (Recommended)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy

### 4.3 Update Supabase URLs

1. Go to Supabase **Authentication** > **URL Configuration**
2. Update Site URL to production URL
3. Add production redirect URLs

## 5. Supabase Free Plan Limitations

Be aware of these limitations on the free plan:

| Resource             | Limit            |
| -------------------- | ---------------- |
| Database size        | 500 MB           |
| File storage         | 1 GB             |
| Bandwidth            | 2 GB             |
| Monthly active users | 50,000           |
| Edge functions       | 500K invocations |
| Realtime connections | 200 concurrent   |
| Branching            | Main branch only |
| CPU                  | Shared           |

### Tips to Stay Within Limits

1. **Optimize queries**: Use proper indexes (already defined in schema)
2. **Limit file uploads**: Don't store large files
3. **Archive old data**: Consider archiving old reports yearly
4. **Monitor usage**: Check dashboard regularly

## 6. Troubleshooting

### Common Issues

**"Invalid API key"**

- Verify `.env` has correct Supabase URL and key
- Restart dev server after changing `.env`

**"Permission denied" (RLS error)**

- Check user has correct role in profiles table
- Verify RLS policies are created
- Test with Supabase SQL editor

**"User not found"**

- Profile might not be created
- Check auth.users and profiles tables match

**Login works but dashboard is empty**

- User status might be 'pending'
- Update to 'active' in profiles table

### Getting Help

- Supabase Docs: [supabase.com/docs](https://supabase.com/docs)
- Supabase Discord: [discord.supabase.com](https://discord.supabase.com)
- React Docs: [react.dev](https://react.dev)
- Tailwind Docs: [tailwindcss.com/docs](https://tailwindcss.com/docs)
