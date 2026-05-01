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
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { SettingsProvider } from './context/SettingsContext';
import { DashboardViewProvider } from './context/DashboardViewContext';
import { I18nProvider, useTranslation } from './locales/i18n';
import { ROUTES, dashboardPathForRole } from './lib/routes';
import { api } from './lib/supabase';
import { isUserSupervisor } from './lib/permissions';
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
  SupervisorDashboard,
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
/**
 * Storage key for the active "view" the user has chosen this session
 * when they hold both student and supervisor capabilities. Cleared on
 * logout (which wipes sessionStorage).
 */
const SUPERVISOR_VIEW_KEY = 'wahdaynak.supervisor.view';

function DashboardDispatcher() {
  const { user, profile, loading, profileLoading } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();

  const [supervisorView, setSupervisorView] = useState<'student' | 'supervisor' | null>(
    () => {
      if (typeof window === 'undefined') return null;
      const v = window.sessionStorage.getItem(SUPERVISOR_VIEW_KEY);
      return v === 'student' || v === 'supervisor' ? v : null;
    },
  );

  // Halaqah supervisor assignments — RELATIONAL source of truth.
  const [assignments, setAssignments] = useState<Array<{ halaqah_id: string }> | null>(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  useEffect(() => {
    // Re-runs whenever profile.id changes (post-login, account switch).
    // No caching: each transition makes a fresh fetch.
    if (!profile?.id) return;
    let cancelled = false;

    // Surface BOTH ids for diff. Per the production bug spec, supervisor
    // logic must use profile.id everywhere — never auth.user.id directly.
    // We log both so any mismatch shows up in the console immediately.
    console.log('AUTH USER ID', user?.id);
    console.log('PROFILE ID', profile.id);
    if (user?.id && user.id !== profile.id) {
      // profiles.id is FK to auth.users.id, so they MUST match. If they
      // don't, the DB is in an inconsistent state and any RLS check
      // against auth.uid() will diverge from our app-side filter.
      console.error('ID MISMATCH', { authId: user?.id, profileId: profile.id });
    }

    setAssignmentsLoading(true);
    void api.supervisors
      .listByUser(profile.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        setAssignments(data ?? []);

        // Fail-safe UI: if the fetch errored, OR if the profile claims
        // halaqah_supervisor capability but no rows came back, alert
        // the operator with a clear toast. This is the diagnostic the
        // production user reported missing.
        if (error) {
          console.error('Supervisor fetch error', error);
          toast.error(t('auth.supervisorDataLoadFailed'));
          return;
        }
        if (
          profile.role === 'halaqah_supervisor' &&
          (data ?? []).length === 0
        ) {
          console.warn(
            'profile.role === halaqah_supervisor but assignments empty',
            { userId: profile.id },
          );
          toast.warning(t('auth.supervisorDataLoadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setAssignmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `t` and `toast` are intentionally excluded — they're unstable
    // context references that change every render. Including them would
    // re-fire this fetch on every render and produce the infinite-loop
    // (`AUTH USER ID` / `FETCH RESULT` repeating forever) the user hit.
    // The closure reads them at toast time, which is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role]);

  if (loading) return <LoadingSpinner />;
  if (user && !profile && profileLoading) return <LoadingSpinner />;
  if (!profile) return <Navigate to={ROUTES.login} replace />;

  // Admin / supervisor_manager paths short-circuit straight to /admin.
  // No supervisor logic applies to them.
  if (profile.role === 'admin' || profile.role === 'supervisor_manager') {
    return <Navigate to={ROUTES.admin} replace />;
  }

  // Wait for the supervisor-assignments fetch — without it we can't
  // decide between student-only and the supervisor picker.
  if (assignmentsLoading || assignments === null) return <LoadingSpinner />;

  const isSupervisor = isUserSupervisor(assignments);

  const choose = (next: 'student' | 'supervisor') => {
    window.sessionStorage.setItem(SUPERVISOR_VIEW_KEY, next);
    setSupervisorView(next);
  };
  const clearChoice = () => {
    window.sessionStorage.removeItem(SUPERVISOR_VIEW_KEY);
    setSupervisorView('student');
  };

  // Empty-state guard: a user who chose "supervisor" but has no
  // assignments (e.g. assignments revoked between sessions, or admin
  // toggled profile.role manually). Show a clear message + a button to
  // fall back to the student dashboard. Never blank screen.
  if (supervisorView === 'supervisor' && !isSupervisor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-2xl shadow-lg p-6 sm:p-8 max-w-md w-full text-center space-y-4">
          <p className="text-base text-foreground">
            {t('auth.noHalaqahsToSupervise')}
          </p>
          <button
            type="button"
            onClick={clearChoice}
            className="w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
          >
            {t('auth.backToStudent')}
          </button>
        </div>
      </div>
    );
  }

  // Picker: only when the user actually IS a supervisor (has assignments)
  // AND hasn't chosen yet this session. Otherwise we skip straight to
  // their student/teacher dashboard.
  if (isSupervisor && !supervisorView) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-2xl shadow-lg p-6 sm:p-8 max-w-md w-full text-center space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            {t('auth.supervisorRoleQuestion')}
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => choose('student')}
              className="flex-1 px-4 py-3 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition"
            >
              {t('auth.continueAsStudent')}
            </button>
            <button
              type="button"
              onClick={() => choose('supervisor')}
              className="flex-1 px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              {t('auth.continueAsSupervisor')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // `canSwitch` enables the in-dashboard view toggle. True only when the
  // account is BOTH supervisor (has assignments) AND able to act as a
  // student (i.e. not a teacher — teachers don't need this switcher).
  // Teachers fall through to TeacherDashboard with no switcher exposed.
  const canSwitch = isSupervisor && profile.role !== 'teacher';
  const viewValue: 'student' | 'supervisor' =
    supervisorView === 'supervisor' ? 'supervisor' : 'student';

  // Active supervisor session — dedicated read-only dashboard. NOT the
  // TeacherDashboard: a halaqah supervisor has different responsibilities
  // (oversight, no edit) and the UI must reflect that.
  if (isSupervisor && supervisorView === 'supervisor') {
    return (
      <DashboardViewProvider value={{ view: viewValue, switchTo: choose, canSwitch }}>
        <SupervisorDashboard />
      </DashboardViewProvider>
    );
  }

  // Default rendering by primary role. profile.role === 'halaqah_supervisor'
  // with no assignments is treated as a regular student per the spec
  // (data drift / cleanup case). Teacher and student fall through here.
  switch (profile.role) {
    case 'teacher':
      return (
        <RoleGuard allow="teacher">
          <TeacherDashboard />
        </RoleGuard>
      );
    case 'student':
    case 'halaqah_supervisor':
    default:
      return (
        <RoleGuard allow={['student', 'halaqah_supervisor']}>
          <DashboardViewProvider value={{ view: viewValue, switchTo: choose, canSwitch }}>
            <StudentDashboard />
          </DashboardViewProvider>
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
            <RoleGuard allow={['admin', 'supervisor_manager']}>
              <AdminDashboard />
            </RoleGuard>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTES.adminUsers}
        element={
          <AuthGuard>
            <RoleGuard allow={['admin', 'supervisor_manager']}>
              <AdminUsers />
            </RoleGuard>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTES.adminUserDetail}
        element={
          <AuthGuard>
            <RoleGuard allow={['admin', 'supervisor_manager']}>
              <AdminUserDetail />
            </RoleGuard>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTES.adminSettings}
        element={
          <AuthGuard>
            {/* Settings stays admin-only. supervisor_manager cannot
                change academy settings (per spec). */}
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
            <RoleGuard allow={['admin', 'teacher', 'supervisor_manager', 'halaqah_supervisor']}>
              <HalaqahDetails />
            </RoleGuard>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTES.reportNew}
        element={
          <AuthGuard>
            {/* halaqah_supervisor is included because a user can be BOTH
                a student and a supervisor — the relational supervisor row
                does not strip their student capability. The dispatcher
                already treats a supervisor in `student` view as a regular
                student, so the route must let them through. */}
            <RoleGuard allow={['student', 'halaqah_supervisor']}>
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
