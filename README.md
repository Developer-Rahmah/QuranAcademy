# أكاديمية تحفيظ القرآن الكريم
# Quran Memorization Academy

A web-based platform for managing Quran memorization circles (Halaqat), tracking student progress, and facilitating communication between students, teachers, and administrators.

## Features

- **Student Portal**: Track memorization progress, submit daily reports, view halaqah details
- **Teacher Portal**: Monitor student progress, view reports, manage halaqah
- **Admin Portal**: Manage halaqahs, teachers, students, and view academy-wide statistics
- **RTL Arabic Interface**: Fully right-to-left layout with Arabic localization
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

### Frontend
- React 18
- Tailwind CSS
- React Router v6
- Supabase JS Client

### Backend
- Supabase (PostgreSQL + Auth)
- Row Level Security (RLS)

## Project Structure

```
QuranAcademy/
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # UI components (Atomic Design)
│   │   │   ├── atoms/     # Basic building blocks
│   │   │   ├── molecules/ # Combinations of atoms
│   │   │   ├── organisms/ # Complex UI sections
│   │   │   └── templates/ # Page layouts
│   │   ├── pages/         # Route components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── context/       # React Context providers
│   │   ├── lib/           # Utilities and configs
│   │   └── styles/        # Global styles
│   ├── public/            # Static assets
│   └── .env.example       # Environment template
├── backend/               # Supabase configuration
│   └── supabase_schema.sql # Database schema + RLS
└── docs/                  # Documentation
    ├── PRD.md             # Product Requirements
    ├── DATABASE_SCHEMA.md # Database documentation
    ├── ARCHITECTURE.md    # Architecture overview
    └── SETUP_INSTRUCTIONS.md # Setup guide
```

## Quick Start

### 1. Clone the repository
```bash
git clone <repository-url>
cd QuranAcademy
```

### 2. Set up Supabase
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `backend/supabase_schema.sql`
3. Copy your project URL and anon key from Project Settings > API

### 3. Configure environment
```bash
cd frontend
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Install dependencies
```bash
npm install
```

### 5. Start development server
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## User Roles

| Role | Capabilities |
|------|-------------|
| **Student (طالبة)** | View own halaqah, submit reports, track progress |
| **Teacher (معلمة)** | View assigned halaqah, monitor student progress |
| **Admin (مدير)** | Full access to all data, manage halaqahs and users |

## Supabase Free Plan Limitations

- 500 MB database storage
- 1 GB file storage
- 2 GB bandwidth
- 50,000 monthly active users
- Main branch only (no database branching)

## Documentation

- [Product Requirements](docs/PRD.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Setup Instructions](docs/SETUP_INSTRUCTIONS.md)

## License

Private - All rights reserved
