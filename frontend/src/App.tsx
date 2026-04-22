/**
 * App - Main application component
 * Provides routing, authentication, i18n, and toast notifications.
 *
 * Route guards are composed:
 *   <AuthGuard>                  — requires a signed-in session
 *     <RoleGuard allow="admin">  — requires an active profile with the given role(s)
 *       <AdminUsers />
 *     </RoleGuard>
 *   </AuthGuard>
 *
 * Navigation after login is non-blocking: Login.tsx navigates to `/dashboard`
 * the moment Supabase returns a session, and DashboardDispatcher reads the
 * role as soon as the profile hydrates (asynchronously) to redirect to the
 * role-specific home.
 */
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { SettingsProvider } from './context/SettingsContext';
import { I18nProvider, useTranslation } from './locales/i18n';
import { ROUTES, dashboardPathForRole } from './lib/routes';
import {
  Landing,
  Login,
  Signup,
  ForgotPassword,
  ResetPassword,
  RegistrationSuccess,
  StudentRegistration,
  TeacherRegistration,
  StudentDashboard,
  TeacherDashboard,
  AdminDashboard,
  AdminUsers,
  AdminUserDetail,
  AdminSettings,
  HalaqahDetails,
  AddReport,
} from './pages';
import type { ReactNode } from 'react';
import type { UserRole } from './types';

// ============================================
// Styles
// ============================================
const appStyles = {
  loadingWrapper: 'min-h-screen flex items-center justify-center bg-background',
  loadingSpinner: 'animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full',
  appContainer: 'font-sans antialiased min-h-screen bg-background',
};

// ============================================
// Loading Spinner
// ============================================
function LoadingSpinner() {
  return (
    <div className={appStyles.loadingWrapper}>
      <div className={appStyles.loadingSpinner} />
    </div>
  );
}

// ============================================
// AuthGuard — session-level gate
// Renders children only when a signed-in session exists. Does NOT wait for
// the profile; that's RoleGuard's job. Lets nested components render without
// blocking navigation on a DB roundtrip.
// ============================================
interface AuthGuardProps {
  children: ReactNode;
}

function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  // Unauthenticated users go to /login, not the landing page — they were
  // trying to reach a protected surface, so funnel them straight into the
  // auth flow rather than back to marketing.
  if (!user) return <Navigate to={ROUTES.login} replace />;

  return <>{children}</>;
}

// ============================================
// RoleGuard — role + status gate
// Waits for the profile to hydrate (profileLoading), then:
//   - if status !== 'active' → sign out + redirect to login (account pending/suspended).
//   - if role not in `allow` → send the user to their own dashboard.
// Otherwise renders children.
// ============================================
interface RoleGuardProps {
  allow: UserRole | UserRole[];
  children: ReactNode;
}

function RoleGuard({ allow, children }: RoleGuardProps) {
  const { user, profile, profileLoading, signOut } = useAuth();
  const toast = useToast();

  // Profile is hydrated asynchronously. Spin only while a fetch is actually
  // in flight — if it finished with null (trigger race / RLS), fall through
  // to the redirect so we don't hang forever.
  const waitingForProfile = !!user && !profile && profileLoading;

  // If profile loaded but account isn't active, sign out cleanly.
  useEffect(() => {
    if (profile && profile.status !== 'active') {
      toast.warning('حسابك غير مفعل. يرجى انتظار موافقة الإدارة.');
      void signOut();
    }
  }, [profile, signOut, toast]);

  if (waitingForProfile) return <LoadingSpinner />;

  // Profile fetch completed but returned nothing — treat as fatal.
  if (!profile) return <Navigate to={ROUTES.login} replace />;

  if (profile.status !== 'active') {
    return <Navigate to={ROUTES.login} replace />;
  }

  const allowed = Array.isArray(allow) ? allow : [allow];
  if (!allowed.includes(profile.role as UserRole)) {
    return <Navigate to={dashboardPathForRole(profile.role)} replace />;
  }

  return <>{children}</>;
}

// ============================================
// Public Route — redirects signed-in active users away
// ============================================
interface PublicRouteProps {
  children: ReactNode;
}

function PublicRoute({ children }: PublicRouteProps) {
  const { user, profile, loading, isRecoverySession } = useAuth();

  if (loading) return <LoadingSpinner />;

  // Only auto-redirect when we have a fully-hydrated, active profile AND
  // we're not in the middle of a password-recovery flow.
  if (user && profile && profile.status === 'active' && !isRecoverySession) {
    return <Navigate to={dashboardPathForRole(profile.role)} replace />;
  }

  return <>{children}</>;
}

// ============================================
// Dashboard Dispatcher — routes by role
// Sits behind AuthGuard at `/dashboard`. Waits for the profile, then:
//   - admin   → redirect to /admin
//   - teacher → render TeacherDashboard
//   - student → render StudentDashboard
// ============================================
function DashboardDispatcher() {
  const { user, profile, loading, profileLoading } = useAuth();

  // Hold a spinner only while auth is hydrating OR a profile fetch is
  // actually in flight. Critically, don't spin forever if the profile
  // fetch completed but returned null (trigger race / RLS); in that
  // case fall through to the redirect below. This was the "stuck after
  // login" bug.
  if (loading) return <LoadingSpinner />;
  if (user && !profile && profileLoading) return <LoadingSpinner />;
  if (!profile) return <Navigate to={ROUTES.login} replace />;

  // Admin has a distinct URL. Teacher/student render inline, wrapped in
  // RoleGuard so the active-status check + sign-out-on-inactive behavior
  // is identical to every other role-gated route.
  switch (profile.role) {
    case 'admin':
      return <Navigate to={ROUTES.admin} replace />;
    case 'teacher':
      return (
        <RoleGuard allow="teacher">
          <TeacherDashboard />
        </RoleGuard>
      );
    case 'student':
    default:
      return (
        <RoleGuard allow="student">
          <StudentDashboard />
        </RoleGuard>
      );
  }
}

// ============================================
// App Routes
// ============================================
function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      {/* Landing is always reachable — no PublicRoute guard so signed-in
          users can still visit marketing without being bounced to dashboard. */}
      <Route path={ROUTES.home}             element={<Landing />} />
      <Route path={ROUTES.login}            element={<PublicRoute><Login /></PublicRoute>} />
      <Route path={ROUTES.signup}           element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path={ROUTES.forgotPassword}   element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      {/* /reset-password intentionally has no guard: a recovery session must
          not be bounced to /dashboard. */}
      <Route path={ROUTES.resetPassword}    element={<ResetPassword />} />
      <Route path={ROUTES.registerStudent}  element={<PublicRoute><StudentRegistration /></PublicRoute>} />
      <Route path={ROUTES.registerTeacher}  element={<PublicRoute><TeacherRegistration /></PublicRoute>} />
      <Route path={ROUTES.success}          element={<PublicRoute><RegistrationSuccess /></PublicRoute>} />

      {/* Authenticated Routes */}
      <Route
        path={ROUTES.dashboard}
        element={
          <AuthGuard>
            <DashboardDispatcher />
          </AuthGuard>
        }
      />
      <Route
        path={ROUTES.admin}
        element={
          <AuthGuard>
            <RoleGuard allow="admin">
              <AdminDashboard />
            </RoleGuard>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTES.adminUsers}
        element={
          <AuthGuard>
            <RoleGuard allow="admin">
              <AdminUsers />
            </RoleGuard>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTES.adminUserDetail}
        element={
          <AuthGuard>
            <RoleGuard allow="admin">
              <AdminUserDetail />
            </RoleGuard>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTES.adminSettings}
        element={
          <AuthGuard>
            <RoleGuard allow="admin">
              <AdminSettings />
            </RoleGuard>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTES.halaqahDetails}
        element={
          <AuthGuard>
            <RoleGuard allow={['admin', 'teacher']}>
              <HalaqahDetails />
            </RoleGuard>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTES.reportNew}
        element={
          <AuthGuard>
            <RoleGuard allow="student">
              <AddReport />
            </RoleGuard>
          </AuthGuard>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  );
}

// ============================================
// DirectionShell — keeps <html dir/lang> in sync with the active language.
// Replaces the old hardcoded `dir="rtl"` wrapper so EN renders LTR.
// ============================================
function DirectionShell({ children }: { children: ReactNode }) {
  const { language, isRTL } = useTranslation();
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    root.setAttribute('lang', language);
  }, [language, isRTL]);
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={appStyles.appContainer}>
      {children}
    </div>
  );
}

// ============================================
// Main App Component
// ============================================
function App() {
  return (
    <BrowserRouter>
      <I18nProvider defaultLanguage="ar">
        <ToastProvider>
          <AuthProvider>
            {/* SettingsProvider sits inside Auth because its effective source
                of truth is the `settings` table, which some RLS setups gate
                on an authenticated session. It still renders children
                immediately and hydrates in the background, so login/signup
                don't wait on it. */}
            <SettingsProvider>
              <DirectionShell>
                <AppRoutes />
              </DirectionShell>
            </SettingsProvider>
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}

export default App;
