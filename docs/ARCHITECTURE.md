# Architecture Documentation

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    React Application                        │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │ │
│  │  │   Pages     │  │  Components │  │   Hooks/Context     │ │ │
│  │  │  (Routes)   │  │  (Atomic)   │  │   (State Mgmt)      │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ │ │
│  │                            │                                 │ │
│  │                    ┌───────┴───────┐                        │ │
│  │                    │ Supabase      │                        │ │
│  │                    │ Client (JS)   │                        │ │
│  │                    └───────────────┘                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Platform                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │    Supabase     │  │    PostgreSQL   │  │    Supabase     │ │
│  │      Auth       │  │    Database     │  │    Storage      │ │
│  │                 │  │    + RLS        │  │   (if needed)   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Atomic Design System

```
src/
├── components/
│   ├── atoms/           # Smallest building blocks
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Text.jsx
│   │   ├── Select.jsx
│   │   ├── Badge.jsx
│   │   ├── Checkbox.jsx
│   │   ├── ProgressBar.jsx
│   │   └── Icon.jsx
│   │
│   ├── molecules/       # Combinations of atoms
│   │   ├── FormField.jsx
│   │   ├── Card.jsx
│   │   ├── StatCard.jsx
│   │   ├── TimeSlotSelector.jsx
│   │   └── MeetLinkCard.jsx
│   │
│   ├── organisms/       # Complex UI sections
│   │   ├── RegistrationForm.jsx
│   │   ├── ReportForm.jsx
│   │   ├── HalaqahTable.jsx
│   │   ├── StudentTable.jsx
│   │   ├── ReportList.jsx
│   │   └── Header.jsx
│   │
│   └── templates/       # Page layouts
│       ├── AuthLayout.jsx
│       └── DashboardLayout.jsx
│
├── pages/               # Route components
│   ├── Login.jsx
│   ├── Signup.jsx
│   ├── StudentRegistration.jsx
│   ├── TeacherRegistration.jsx
│   ├── ForgotPassword.jsx
│   ├── RegistrationSuccess.jsx
│   ├── StudentDashboard.jsx
│   ├── TeacherDashboard.jsx
│   ├── AdminDashboard.jsx
│   ├── HalaqahDetails.jsx
│   └── AddReport.jsx
│
├── hooks/               # Custom React hooks
│   ├── useAuth.js
│   ├── useProfile.js
│   ├── useHalaqah.js
│   └── useReports.js
│
├── context/             # React Context providers
│   └── AuthContext.jsx
│
├── lib/                 # Utilities and configs
│   ├── supabase.js
│   ├── constants.js
│   └── utils.js
│
└── styles/              # Global styles
    └── index.css
```

### Component Hierarchy

```
App
├── AuthContext.Provider
│   ├── Routes
│   │   ├── AuthLayout (unauthenticated routes)
│   │   │   ├── Login
│   │   │   ├── Signup
│   │   │   ├── StudentRegistration
│   │   │   ├── TeacherRegistration
│   │   │   ├── ForgotPassword
│   │   │   └── RegistrationSuccess
│   │   │
│   │   └── DashboardLayout (authenticated routes)
│   │       ├── StudentDashboard
│   │       ├── TeacherDashboard
│   │       ├── AdminDashboard
│   │       ├── HalaqahDetails
│   │       └── AddReport
```

## State Management

### Authentication State
- Managed via `AuthContext`
- Stores: user session, profile data, loading state
- Provides: login, logout, signup functions

### Data Fetching
- Direct Supabase queries in components/hooks
- Real-time subscriptions where needed
- Loading/error states handled locally

## Routing

```javascript
// Protected routes based on role
const routes = {
  public: ['/', '/signup', '/forgot-password', '/register/*', '/success'],
  student: ['/dashboard', '/report/new'],
  teacher: ['/dashboard', '/halaqah/:id'],
  admin: ['/dashboard', '/halaqah/:id', '/halaqah/new']
};
```

## Security

### Frontend
- JWT stored in memory (Supabase handles this)
- Protected routes with role checks
- Input validation before submission

### Backend (Supabase)
- Row Level Security (RLS) on all tables
- Role-based policies
- Secure functions with SECURITY DEFINER

## Color System (Tailwind Config)

```javascript
colors: {
  primary: '#5B8C5A',
  'primary-foreground': '#FFFFFF',
  secondary: '#E8DECD',
  accent: '#D4C5A9',
  background: '#F9F7F4',
  card: '#FFFFFF',
  foreground: '#2C3E2F',
  muted: '#7A8F7D',
  success: '#6B9F6A',
  destructive: '#C85A54',
  gold: '#C9A961',
}
```

## API Patterns

### Authentication
```javascript
// Login
await supabase.auth.signInWithPassword({ email, password })

// Signup
await supabase.auth.signUp({ email, password, options: { data: {...} } })

// Logout
await supabase.auth.signOut()
```

### Data Operations
```javascript
// Read with RLS
const { data } = await supabase.from('table').select('*')

// Insert
const { data } = await supabase.from('table').insert({ ... })

// Update
const { data } = await supabase.from('table').update({ ... }).eq('id', id)

// Delete
await supabase.from('table').delete().eq('id', id)
```

## Performance Considerations

1. **Lazy Loading**: Route-based code splitting
2. **Caching**: Supabase client handles query caching
3. **Optimistic Updates**: For better UX on mutations
4. **Pagination**: For large data sets (reports, students)
