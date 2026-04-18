/**
 * App - Main application component
 * Provides routing, authentication, i18n, and toast notifications
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { I18nProvider } from './locales/i18n';
import {
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
// Loading Spinner Component
// ============================================
function LoadingSpinner() {
  return (
    <div className={appStyles.loadingWrapper}>
      <div className={appStyles.loadingSpinner} />
    </div>
  );
}

// ============================================
// Protected Route
// ============================================
interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading, isActive } = useAuth();

  // Debug logging
  console.log('[ProtectedRoute] State:', {
    hasUser: !!user,
    hasProfile: !!profile,
    loading,
    isActive,
    profileRole: profile?.role,
    allowedRoles,
  });

  // Show loading while auth is initializing
  if (loading) {
    console.log('[ProtectedRoute] Still loading...');
    return <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to login');
    return <Navigate to="/" replace />;
  }

  // Wait for profile to load
  if (!profile) {
    console.log('[ProtectedRoute] No profile yet, showing spinner');
    return <LoadingSpinner />;
  }

  // Check if account is active
  if (!isActive) {
    console.log('[ProtectedRoute] Account not active, redirecting to login');
    return <Navigate to="/" replace />;
  }

  // Check role permissions
  if (allowedRoles && !allowedRoles.includes(profile.role as UserRole)) {
    console.log('[ProtectedRoute] Role not allowed:', {
      profileRole: profile.role,
      allowedRoles,
    });
    return <Navigate to="/dashboard" replace />;
  }

  console.log('[ProtectedRoute] Access granted');
  return <>{children}</>;
}

// ============================================
// Public Route
// ============================================
interface PublicRouteProps {
  children: ReactNode;
}

function PublicRoute({ children }: PublicRouteProps) {
  const { user, profile, loading, isActive, isRecoverySession } = useAuth();

  // Show loading while auth is initializing
  if (loading) {
    return <LoadingSpinner />;
  }

  // Redirect to dashboard if authenticated AND active,
  // but NEVER during a password-recovery flow.
  if (user && profile && isActive && !isRecoverySession) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// ============================================
// Dashboard Router
// ============================================
function DashboardRouter() {
  const { profile, loading } = useAuth();

  console.log('[DashboardRouter] State:', {
    loading,
    hasProfile: !!profile,
    profileRole: profile?.role,
    roleType: typeof profile?.role,
  });

  if (loading || !profile) {
    console.log('[DashboardRouter] Loading or no profile');
    return <LoadingSpinner />;
  }

  console.log('[DashboardRouter] Rendering dashboard for role:', profile.role);

  switch (profile.role) {
    case 'admin':
      console.log('[DashboardRouter] Rendering AdminDashboard');
      return <AdminDashboard />;
    case 'teacher':
      console.log('[DashboardRouter] Rendering TeacherDashboard');
      return <TeacherDashboard />;
    case 'student':
    default:
      console.log('[DashboardRouter] Rendering StudentDashboard');
      return <StudentDashboard />;
  }
}

// ============================================
// App Routes
// ============================================
function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      {/* Reset-password is accessible without PublicRoute guard so that a
          recovery session doesn't bounce the user to /dashboard. */}
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/register/student"
        element={
          <PublicRoute>
            <StudentRegistration />
          </PublicRoute>
        }
      />
      <Route
        path="/register/teacher"
        element={
          <PublicRoute>
            <TeacherRegistration />
          </PublicRoute>
        }
      />
      <Route
        path="/success"
        element={
          <PublicRoute>
            <RegistrationSuccess />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardRouter />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/halaqah/:id"
        element={
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <HalaqahDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/report/new"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <AddReport />
          </ProtectedRoute>
        }
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
            <div dir="rtl" className={appStyles.appContainer}>
              <AppRoutes />
            </div>
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}

export default App;
