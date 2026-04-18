# Product Requirements Document (PRD)
# Quran Memorization Academy - أكاديمية تحفيظ القرآن الكريم

## 1. Overview

### 1.1 Product Vision
A web-based platform to manage Quran memorization circles (Halaqat), track student progress, and facilitate communication between students, teachers, and administrators.

### 1.2 Target Users
- **Students (طالبات)**: Women and children memorizing the Quran
- **Teachers (معلمات)**: Female Quran teachers managing halaqahs
- **Administrators (مديرات)**: Academy staff managing the overall system

## 2. Features

### 2.1 Authentication
- Email/phone login
- Password reset via email
- Role-based access control (Student, Teacher, Admin)
- Registration approval workflow

### 2.2 Student Features
- View assigned halaqah details
- Track memorization progress (pages)
- Track review progress (pages)
- Submit daily reports (memorization + review)
- View historical reports
- Access Google Meet link for online sessions

### 2.3 Teacher Features
- View assigned halaqah
- View all students in halaqah
- Track individual student progress
- View student reports
- Access Google Meet link

### 2.4 Admin Features
- View academy-wide statistics
- Manage halaqahs (create, edit, delete)
- View all teachers and students
- Assign teachers to halaqahs
- Assign students to halaqahs
- Approve new registrations

## 3. Technical Requirements

### 3.1 Frontend
- React 18+ with functional components
- Tailwind CSS for styling
- RTL layout for Arabic
- Atomic Design System
- Responsive design

### 3.2 Backend
- Supabase (PostgreSQL)
- Row Level Security (RLS)
- Supabase Auth
- No custom backend server

### 3.3 Data Model
- Users (with roles)
- Halaqahs (study circles)
- Halaqah Members (student assignments)
- Reports (daily progress)
- Report Items (individual surahs in a report)

## 4. Business Rules

### 4.1 Reports
- Minimum report entry: 0.25 pages (quarter page)
- Reports can include multiple surahs
- Two types: Memorization (حفظ) and Review (مراجعة)
- Reports are date-stamped

### 4.2 Progress Calculation
- Total pages in Quran: 604 pages
- Progress = (Total memorized pages / 604) × 100%

### 4.3 Registration
- New users must be approved by admin
- Users select account type (Student/Teacher)
- Users select available time slots

## 5. Non-Functional Requirements

### 5.1 Performance
- Page load < 3 seconds
- Responsive on mobile devices

### 5.2 Security
- RLS policies for data isolation
- Secure authentication via Supabase Auth
- Input validation on all forms

### 5.3 Accessibility
- RTL support
- Clear Arabic typography
- High contrast colors

## 6. Supabase Free Plan Limitations
- Single branch only (main)
- Shared CPU
- 500 MB database storage
- 1 GB file storage
- 2 GB bandwidth
- 50,000 monthly active users
