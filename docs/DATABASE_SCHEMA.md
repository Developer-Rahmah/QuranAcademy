# Database Schema Documentation

## Entity Relationship Diagram (Textual)

```
┌─────────────────┐       ┌─────────────────┐
│     profiles    │       │    halaqahs     │
├─────────────────┤       ├─────────────────┤
│ id (FK auth)    │       │ id              │
│ email           │       │ name            │
│ first_name      │       │ teacher_id (FK) │
│ second_name     │       │ meet_link       │
│ third_name      │       │ level           │
│ phone           │       │ target_audience │
│ age             │       │ schedule        │
│ country         │       │ status          │
│ role            │       │ created_at      │
│ student_type    │       └────────┬────────┘
│ memorization_lvl│                │
│ experience      │                │
│ preferred_aud   │       ┌────────┴────────┐
│ available_times │       │ halaqah_members │
│ status          │       ├─────────────────┤
│ created_at      │       │ id              │
└────────┬────────┘       │ halaqah_id (FK) │
         │                │ student_id (FK) │
         │                │ joined_at       │
         │                │ status          │
         └────────────────┴────────┬────────┘
                                   │
                          ┌────────┴────────┐
                          │     reports     │
                          ├─────────────────┤
                          │ id              │
                          │ student_id (FK) │
                          │ halaqah_id (FK) │
                          │ report_date     │
                          │ created_at      │
                          └────────┬────────┘
                                   │
                          ┌────────┴────────┐
                          │  report_items   │
                          ├─────────────────┤
                          │ id              │
                          │ report_id (FK)  │
                          │ surah_name      │
                          │ pages           │
                          │ type            │
                          └─────────────────┘
```

## Tables

### 1. profiles
Extends Supabase auth.users with additional profile data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, FK auth.users | User ID from auth |
| email | text | NOT NULL, UNIQUE | User email |
| first_name | text | NOT NULL | الاسم الأول |
| second_name | text | NOT NULL | الاسم الثاني |
| third_name | text | NOT NULL | الاسم الثالث |
| phone | text | NOT NULL | رقم الهاتف |
| age | integer | | العمر |
| country | text | | الدولة |
| role | enum | NOT NULL | student, teacher, admin |
| student_type | enum | | woman, child |
| memorization_level | enum | | beginner, intermediate, advanced |
| teaching_experience | text | | Teacher's experience |
| preferred_audience | enum | | children, women, both |
| available_times | jsonb | | Array of time slots |
| status | enum | DEFAULT 'pending' | pending, active, suspended |
| created_at | timestamptz | DEFAULT now() | |

### 2. halaqahs
Study circles/groups.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| name | text | NOT NULL | اسم الحلقة |
| teacher_id | uuid | FK profiles | المعلمة |
| meet_link | text | | رابط Google Meet |
| level | enum | | beginner, intermediate, advanced |
| target_audience | enum | | children, women |
| schedule | jsonb | | Schedule details |
| status | enum | DEFAULT 'active' | active, paused, completed |
| created_at | timestamptz | DEFAULT now() | |

### 3. halaqah_members
Junction table for students in halaqahs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| halaqah_id | uuid | FK halaqahs, NOT NULL | |
| student_id | uuid | FK profiles, NOT NULL | |
| joined_at | timestamptz | DEFAULT now() | |
| status | enum | DEFAULT 'active' | active, inactive |

### 4. reports
Daily progress reports from students.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| student_id | uuid | FK profiles, NOT NULL | |
| halaqah_id | uuid | FK halaqahs, NOT NULL | |
| report_date | date | NOT NULL | تاريخ التقرير |
| created_at | timestamptz | DEFAULT now() | |

### 5. report_items
Individual entries within a report.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | |
| report_id | uuid | FK reports, NOT NULL | |
| surah_name | text | NOT NULL | اسم السورة |
| pages | decimal(5,2) | NOT NULL, CHECK >= 0.25 | عدد الصفحات |
| type | enum | NOT NULL | memorization, review |

## Enums

```sql
-- User roles
CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');

-- Student types
CREATE TYPE student_type AS ENUM ('woman', 'child');

-- Memorization levels
CREATE TYPE memorization_level AS ENUM ('beginner', 'intermediate', 'advanced');

-- Preferred teaching audience
CREATE TYPE preferred_audience AS ENUM ('children', 'women', 'both');

-- Account/membership status
CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended');

-- Halaqah status
CREATE TYPE halaqah_status AS ENUM ('active', 'paused', 'completed');

-- Report item type
CREATE TYPE report_type AS ENUM ('memorization', 'review');
```

## Row Level Security (RLS) Policies

### profiles table
- Users can read their own profile
- Teachers can read profiles of students in their halaqahs
- Admins can read/write all profiles

### halaqahs table
- Students can read halaqahs they're members of
- Teachers can read/update their assigned halaqahs
- Admins can read/write all halaqahs

### halaqah_members table
- Students can read their own memberships
- Teachers can read memberships in their halaqahs
- Admins can read/write all memberships

### reports table
- Students can read/write their own reports
- Teachers can read reports from students in their halaqahs
- Admins can read all reports

### report_items table
- Students can read/write items in their own reports
- Teachers can read items from reports in their halaqahs
- Admins can read all report items
