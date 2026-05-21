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
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { SettingsProvider } from "./context/SettingsContext";
import { DashboardViewProvider } from "./context/DashboardViewContext";
import { I18nProvider, useTranslation } from "./locales/i18n";
import { ROUTES, dashboardPathForRole } from "./lib/routes";
import { api } from "./lib/supabase";
import { isUserSupervisor } from "./lib/permissions";
import { Seo } from "./components/atoms/Seo";
// Landing is eager-imported because it's the SEO-critical entry point
// (`/`) and we want it in the main bundle for fastest first paint /
// best Core Web Vitals. Every other page is lazy so a visitor landing
// on `/` doesn't pull the entire authenticated app on first request.
import { Landing } from "./pages/Landing";
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Signup = lazy(() => import("./pages/Signup").then((m) => ({ default: m.Signup })));
const ForgotPassword = lazy(() =>
  import("./pages/ForgotPassword").then((m) => ({ default: m.ForgotPassword })),
);
const ResetPassword = lazy(() =>
  import("./pages/ResetPassword").then((m) => ({ default: m.ResetPassword })),
);
const RegistrationSuccess = lazy(() =>
  import("./pages/RegistrationSuccess").then((m) => ({
    default: m.RegistrationSuccess,
  })),
);
const StudentRegistration = lazy(() =>
  import("./pages/StudentRegistration").then((m) => ({
    default: m.StudentRegistration,
  })),
);
const TeacherRegistration = lazy(() =>
  import("./pages/TeacherRegistration").then((m) => ({
    default: m.TeacherRegistration,
  })),
);
const StudentDashboard = lazy(() =>
  import("./pages/StudentDashboard").then((m) => ({ default: m.StudentDashboard })),
);
const TeacherDashboard = lazy(() =>
  import("./pages/TeacherDashboard").then((m) => ({ default: m.TeacherDashboard })),
);
const SupervisorDashboard = lazy(() =>
  import("./pages/SupervisorDashboard").then((m) => ({
    default: m.SupervisorDashboard,
  })),
);
const AdminDashboard = lazy(() =>
  import("./pages/AdminDashboard").then((m) => ({ default: m.AdminDashboard })),
);
const AdminUsers = lazy(() =>
  import("./pages/AdminUsers").then((m) => ({ default: m.AdminUsers })),
);
const AdminUserDetail = lazy(() =>
  import("./pages/AdminUserDetail").then((m) => ({ default: m.AdminUserDetail })),
);
const AdminSettings = lazy(() =>
  import("./pages/AdminSettings").then((m) => ({ default: m.AdminSettings })),
);
const HalaqahDetails = lazy(() =>
  import("./pages/HalaqahDetails").then((m) => ({ default: m.HalaqahDetails })),
);
const AddReport = lazy(() =>
  import("./pages/AddReport").then((m) => ({ default: m.AddReport })),
);
const EditReport = lazy(() =>
  import("./pages/EditReport").then((m) => ({ default: m.EditReport })),
);
import type { ReactNode } from "react";
import type { UserRole } from "./types";

// ============================================
// Styles
// ============================================
const appStyles = {
  loadingWrapper: "min-h-screen flex items-center justify-center bg-background",
  loadingSpinner:
    "animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full",
  appContainer: "font-sans antialiased min-h-screen bg-background",
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
//   - if status !== 'active' → bounce to /login. The actual sign-out
//     happens centrally in AuthProvider (auth/active-status guard) so
//     a single toast fires regardless of which guard saw it first.
//   - if role not in `allow` → send the user to their own dashboard.
// Otherwise renders children.
// ============================================
interface RoleGuardProps {
  allow: UserRole | UserRole[];
  children: ReactNode;
}

function RoleGuard({ allow, children }: RoleGuardProps) {
  const { user, profile, profileLoading } = useAuth();

  // Profile is hydrated asynchronously. Spin only while a fetch is actually
  // in flight — if it finished with null (trigger race / RLS), fall through
  // to the redirect so we don't hang forever.
  const waitingForProfile = !!user && !profile && profileLoading;

  if (waitingForProfile) return <LoadingSpinner />;

  // Profile fetch completed but returned nothing — treat as fatal.
  if (!profile) return <Navigate to={ROUTES.login} replace />;

  if (profile.status !== "active") {
    // AuthProvider's active-status effect handles signOut + toast. Here
    // we just bail the render so a non-active profile never shows
    // protected UI even for the millisecond before signOut completes.
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
  const { user, loading, isRecoverySession } = useAuth();

  // Prerender bypass: when the build-time prerender script (see
  // scripts/prerender.mjs) loads a public page in headless Chromium it
  // sets `window.__PRERENDER__ = true` BEFORE app scripts execute. In
  // that mode we skip the auth-loading spinner so the marketing /
  // registration page is captured as HTML, not a placeholder spinner.
  // Real users never have this flag — production behaviour is
  // unchanged.
  const isPrerender =
    typeof window !== "undefined" &&
    (window as unknown as { __PRERENDER__?: boolean }).__PRERENDER__ === true;

  if (loading && !isPrerender) return <LoadingSpinner />;

  // Redirect to dashboard if authenticated, EXCEPT during a recovery
  // flow. We redirect on `user` alone (not waiting for the profile)
  // so browser-back from /dashboard to / / /login immediately bounces
  // forward — without flashing the landing/login page to a logged-in
  // user. The /dashboard route's AuthGuard + RoleGuard handle pending
  // and suspended accounts from there.
  if (user && !isRecoverySession) {
    return <Navigate to={ROUTES.dashboard} replace />;
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
const SUPERVISOR_VIEW_KEY = "wahdaynak.supervisor.view";

function DashboardDispatcher() {
  const { user, profile, loading, profileLoading } = useAuth();
  const { t } = useTranslation();

  const [supervisorView, setSupervisorView] = useState<
    "student" | "supervisor" | null
  >(() => {
    if (typeof window === "undefined") return null;
    const v = window.sessionStorage.getItem(SUPERVISOR_VIEW_KEY);
    return v === "student" || v === "supervisor" ? v : null;
  });

  // Halaqah supervisor assignments — RELATIONAL source of truth.
  const [assignments, setAssignments] = useState<Array<{
    halaqah_id: string;
  }> | null>(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    // Skip the supervisor-assignments fetch for roles that can't be
    // supervisors. Teachers and admins never need this query, and on
    // production it sometimes stalls — running it for every role made
    // every dashboard wait ~30s before rendering.
    if (
      profile.role === "teacher" ||
      profile.role === "admin" ||
      profile.role === "supervisor_manager"
    ) {
      setAssignments([]);
      return;
    }
    let cancelled = false;

    // Surface only the actual mismatch case (auth.uid != profiles.id).
    // Routine "user/profile id" trace logs were noise on every login.
    if (user?.id && user.id !== profile.id) {
      console.error("ID MISMATCH", { authId: user?.id, profileId: profile.id });
    }

    setAssignmentsLoading(true);
    void api.supervisors
      .listByUser(profile.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        setAssignments(data ?? []);
        if (error) {
          console.error("Supervisor fetch error", error);
          // Don't toast for halaqah_supervisor-with-no-rows — that's a
          // benign data state, not a failure. The operator already sees
          // a clean dashboard. Loud toasting on every dashboard mount
          // was producing false alarms.
          return;
        }
      })
      .finally(() => {
        if (!cancelled) setAssignmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role]);

  if (loading) return <LoadingSpinner />;
  if (user && !profile && profileLoading) return <LoadingSpinner />;
  if (!profile) return <Navigate to={ROUTES.login} replace />;

  // Admin / supervisor_manager paths short-circuit straight to /admin.
  // No supervisor logic applies to them.
  if (profile.role === "admin" || profile.role === "supervisor_manager") {
    return <Navigate to={ROUTES.admin} replace />;
  }

  // Only block the dashboard render on the supervisor fetch when the
  // user has explicitly chosen the supervisor view this session. Pure
  // students and teachers see their dashboard immediately while the
  // assignments fetch (if any) hydrates in the background — that's the
  // fix for the ~30s blank screen on every login.
  if (
    supervisorView === "supervisor" &&
    (assignmentsLoading || assignments === null)
  ) {
    return <LoadingSpinner />;
  }
  // Default `assignments` to [] for everyone else so isSupervisor is
  // simply false until the fetch (if running) returns.

  const isSupervisor = isUserSupervisor(assignments ?? []);

  const choose = (next: "student" | "supervisor") => {
    window.sessionStorage.setItem(SUPERVISOR_VIEW_KEY, next);
    setSupervisorView(next);
  };
  const clearChoice = () => {
    window.sessionStorage.removeItem(SUPERVISOR_VIEW_KEY);
    setSupervisorView("student");
  };

  // Empty-state guard: a user who chose "supervisor" but has no
  // assignments (e.g. assignments revoked between sessions, or admin
  // toggled profile.role manually). Show a clear message + a button to
  // fall back to the student dashboard. Never blank screen.
  if (supervisorView === "supervisor" && !isSupervisor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-2xl shadow-lg p-6 sm:p-8 max-w-md w-full text-center space-y-4">
          <p className="text-base text-foreground">
            {t("auth.noHalaqahsToSupervise")}
          </p>
          <button
            type="button"
            onClick={clearChoice}
            className="w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
          >
            {t("auth.backToStudent")}
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
            {t("auth.supervisorRoleQuestion")}
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => choose("student")}
              className="flex-1 px-4 py-3 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition"
            >
              {t("auth.continueAsStudent")}
            </button>
            <button
              type="button"
              onClick={() => choose("supervisor")}
              className="flex-1 px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              {t("auth.continueAsSupervisor")}
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
  const canSwitch = isSupervisor && profile.role !== "teacher";
  const viewValue: "student" | "supervisor" =
    supervisorView === "supervisor" ? "supervisor" : "student";

  // Active supervisor session — dedicated read-only dashboard. NOT the
  // TeacherDashboard: a halaqah supervisor has different responsibilities
  // (oversight, no edit) and the UI must reflect that.
  if (isSupervisor && supervisorView === "supervisor") {
    return (
      <DashboardViewProvider
        value={{ view: viewValue, switchTo: choose, canSwitch }}
      >
        <SupervisorDashboard />
      </DashboardViewProvider>
    );
  }

  // Default rendering by primary role. profile.role === 'halaqah_supervisor'
  // with no assignments is treated as a regular student per the spec
  // (data drift / cleanup case). Teacher and student fall through here.
  switch (profile.role) {
    case "teacher":
      return (
        <RoleGuard allow="teacher">
          <TeacherDashboard />
        </RoleGuard>
      );
    case "student":
    case "halaqah_supervisor":
    default:
      return (
        <RoleGuard allow={["student", "halaqah_supervisor"]}>
          <DashboardViewProvider
            value={{ view: viewValue, switchTo: choose, canSwitch }}
          >
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
  // Suspense fallback covers the brief window while a lazy page chunk
  // downloads. Reuses the same spinner the auth guards already show, so
  // there's no visual jump between "downloading code" and "checking
  // session" — the user perceives a single smooth load.
  return (
    <Suspense fallback={<LoadingSpinner />}>
    <Routes>
      {/* Public Routes — every public surface (including the landing
          page) is wrapped in PublicRoute so an authenticated user who
          presses browser-back never lands on marketing. PublicRoute
          redirects to /dashboard the moment a session exists. The only
          exception is /reset-password (declared below) — its recovery
          session must NOT be bounced. */}
      <Route
        path={ROUTES.home}
        element={
          <PublicRoute>
            <Landing />
          </PublicRoute>
        }
      />
      <Route
        path={ROUTES.login}
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path={ROUTES.signup}
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />
      <Route
        path={ROUTES.forgotPassword}
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      {/* /reset-password intentionally has no guard: a recovery session must
          not be bounced to /dashboard. */}
      <Route path={ROUTES.resetPassword} element={<ResetPassword />} />
      <Route
        path={ROUTES.registerStudent}
        element={
          <PublicRoute>
            <StudentRegistration />
          </PublicRoute>
        }
      />
      <Route
        path={ROUTES.registerTeacher}
        element={
          <PublicRoute>
            <TeacherRegistration />
          </PublicRoute>
        }
      />
      <Route
        path={ROUTES.success}
        element={
          <PublicRoute>
            <RegistrationSuccess />
          </PublicRoute>
        }
      />

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
            <RoleGuard allow={["admin", "supervisor_manager"]}>
              <AdminDashboard />
            </RoleGuard>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTES.adminUsers}
        element={
          <AuthGuard>
            <RoleGuard allow={["admin", "supervisor_manager"]}>
              <AdminUsers />
            </RoleGuard>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTES.adminUserDetail}
        element={
          <AuthGuard>
            <RoleGuard allow={["admin", "supervisor_manager"]}>
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
            <RoleGuard
              allow={[
                "admin",
                "teacher",
                "supervisor_manager",
                "halaqah_supervisor",
              ]}
            >
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
            <RoleGuard allow={["student", "halaqah_supervisor"]}>
              <AddReport />
            </RoleGuard>
          </AuthGuard>
        }
      />
      <Route
        path={ROUTES.reportEdit}
        element={
          <AuthGuard>
            <RoleGuard allow={["student", "halaqah_supervisor"]}>
              <EditReport />
            </RoleGuard>
          </AuthGuard>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
    </Suspense>
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
    root.setAttribute("dir", isRTL ? "rtl" : "ltr");
    root.setAttribute("lang", language);
  }, [language, isRTL]);
  return (
    <div dir={isRTL ? "rtl" : "ltr"} className={appStyles.appContainer}>
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
              {/* Seo owns every SEO-relevant head tag (title /
                  description / canonical / OG / Twitter / robots) and
                  reacts to route + language + settings changes. Mounted
                  here because it depends on Router + i18n + Settings.
                  Renders nothing — side-effect on document.head. */}
              <Seo />
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
