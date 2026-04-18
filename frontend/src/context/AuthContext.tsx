/**
 * AuthContext - Authentication state management
 * Handles signup, signin, signout, and profile management with Supabase
 *
 * FIXED:
 * - Proper session null guards
 * - No crashes on null session
 * - Single auth listener
 * - Proper state cleanup on signout
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { supabase, db } from "../lib/supabase";
import type { Profile, UserRole, AuthContextType, User } from "../types";
import type { Session, AuthError } from "@supabase/supabase-js";

// ============================================
// Context Setup
// ============================================
const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

// ============================================
// Logger Utility
// ============================================
const logger = {
  info: (message: string, data?: unknown) => {
    // Always log auth events for debugging
    console.log(`[Auth] ${message}`, data ?? "");
  },
  error: (message: string, error?: unknown) => {
    console.error(`[Auth Error] ${message}`, error ?? "");
  },
  debug: (message: string, data?: unknown) => {
    console.log(`[Auth DEBUG] ${message}`, JSON.stringify(data, null, 2));
  },
};

// ============================================
// Auth Provider Component
// ============================================
export function AuthProvider({ children }: AuthProviderProps) {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  // Recovery mode: set when user arrives via a password reset email link.
  // While true, PublicRoute will not auto-redirect an "authenticated" user
  // to /dashboard, so they can complete the reset flow.
  const [isRecoverySession, setIsRecoverySession] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.location.hash.includes("type=recovery");
  });

  // Refs to prevent race conditions
  const isInitializing = useRef(false);
  const isFetchingProfile = useRef(false);
  // Mirrors isRecoverySession so the long-lived onAuthStateChange closure
  // always reads the current value without being recreated.
  const isRecoverySessionRef = useRef(isRecoverySession);
  useEffect(() => {
    isRecoverySessionRef.current = isRecoverySession;
  }, [isRecoverySession]);

  // ============================================
  // Fetch Profile (with guards and retry for trigger delay)
  // ============================================
  const fetchProfile = useCallback(
    async (userId: string, retries = 3, delay = 500): Promise<Profile | null> => {
      if (!userId || isFetchingProfile.current) {
        return null;
      }

      isFetchingProfile.current = true;
      logger.info("Fetching profile", { userId, retries });

      try {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            const { data, error: fetchError } = await db.profiles.get(userId);

            if (fetchError) {
              logger.error(`Profile fetch failed (attempt ${attempt})`, fetchError);
              // If it's an RLS error (42P17), don't retry - it won't help
              if ((fetchError as { code?: string }).code === "42P17") {
                logger.error("RLS recursion error - check database policies");
                return null;
              }
              // Wait before retry
              if (attempt < retries) {
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
              }
              return null;
            }

            if (data) {
              logger.debug("Profile fetched successfully", {
                profileId: data.id,
                email: data.email,
                role: data.role,
                roleType: typeof data.role,
                status: data.status,
              });
              return data;
            }

            // Profile not found - might be trigger delay
            if (attempt < retries) {
              logger.info(`Profile not found, retrying (${attempt}/${retries})`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }

            logger.error("Profile not found after all retries");
            return null;
          } catch (err) {
            logger.error(`Profile fetch exception (attempt ${attempt})`, err);
            if (attempt < retries) {
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
            return null;
          }
        }
        return null;
      } finally {
        isFetchingProfile.current = false;
      }
    },
    [],
  );

  // ============================================
  // Handle Session Change
  // ============================================
  const handleSessionChange = useCallback(
    async (session: Session | null) => {
      // CRITICAL: Guard against null session
      if (!session?.user) {
        logger.info("No session or user, clearing state");
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const sessionUser = session.user;
      logger.info("Session user found", { userId: sessionUser.id });

      setUser(sessionUser as unknown as User);

      // Fetch profile
      const userProfile = await fetchProfile(sessionUser.id);
      setProfile(userProfile);
      setLoading(false);
    },
    [fetchProfile],
  );

  // ============================================
  // Initialize Auth on Mount
  // ============================================
  useEffect(() => {
    if (isInitializing.current || initialized) {
      return;
    }

    isInitializing.current = true;
    logger.info("Initializing auth...");

    const initAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          logger.error("Session fetch error", sessionError);
          setError(sessionError.message);
          setLoading(false);
          return;
        }

        if (isRecoverySessionRef.current && session?.user) {
          setUser(session.user as unknown as User);
          setProfile(null);
          setLoading(false);
        } else {
          await handleSessionChange(session);
        }
      } catch (err) {
        logger.error("Auth init exception", err);
        setError((err as Error).message);
        setLoading(false);
      } finally {
        isInitializing.current = false;
        setInitialized(true);
      }
    };

    initAuth();

    // Subscribe to auth state changes. The entire handler is wrapped in
    // try/catch because Supabase will surface this listener on every auth
    // event (including SIGNED_OUT with a null session) and any unhandled
    // throw here would otherwise be reported as a global uncaught error.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        try {
          // Normalize: a valid "session.user" is the only thing we ever care
          // about. Never read session.user without the optional chain.
          const sessionUser = session?.user ?? null;

          logger.info("Auth state changed", {
            event,
            hasSession: !!session,
            hasUser: !!sessionUser,
          });

          switch (event) {
            case "PASSWORD_RECOVERY":
              // Recovery link was clicked. Keep user minimally authenticated
              // but do NOT hydrate the profile — guards must leave the
              // /reset-password page alone until the flow completes.
              logger.info("Password recovery session detected");
              setIsRecoverySession(true);
              if (sessionUser) {
                setUser(sessionUser as unknown as User);
              }
              setProfile(null);
              setLoading(false);
              break;

            case "SIGNED_IN":
            case "TOKEN_REFRESHED":
            case "USER_UPDATED":
              if (!sessionUser) {
                // Defensive: an auth event can theoretically arrive with a
                // null session. Treat it as a no-op rather than crashing.
                logger.info(`${event} fired with null session — ignoring`);
                break;
              }
              if (isRecoverySessionRef.current) {
                setUser(sessionUser as unknown as User);
                setLoading(false);
              } else {
                await handleSessionChange(session);
              }
              break;

            case "SIGNED_OUT":
              // IMPORTANT: don't touch session.user here — session IS null.
              logger.info("User signed out, clearing state");
              setUser(null);
              setProfile(null);
              setError(null);
              setIsRecoverySession(false);
              setLoading(false);
              break;

            default:
              // INITIAL_SESSION and anything else.
              if (!sessionUser) {
                break;
              }
              if (isRecoverySessionRef.current) {
                setUser(sessionUser as unknown as User);
                setLoading(false);
              } else {
                await handleSessionChange(session);
              }
          }
        } catch (handlerError) {
          logger.error("onAuthStateChange handler failed", handlerError);
        }
      },
    );

    return () => {
      logger.info("Cleaning up auth subscription");
      subscription?.unsubscribe();
    };
  }, [initialized, handleSessionChange]);

  // ============================================
  // Sign In
  // ============================================
  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      setLoading(true);
      logger.info("Attempting sign in", { email });

      try {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (signInError) {
          logger.error("Sign in failed", signInError);
          throw signInError;
        }

        // CRITICAL: Guard against null user
        if (!data.user) {
          throw new Error("لم يتم إرجاع بيانات المستخدم");
        }

        logger.info("/////Sign in successful", data.user);

        // Fetch profile
        const userProfile = await fetchProfile(data.user.id);

        if (!userProfile) {
          logger.error("Profile not found after sign in");
          await supabase.auth.signOut();
          throw new Error("لم يتم العثور على الملف الشخصي");
        }

        // Check if account is active
        if (userProfile.status !== "active") {
          logger.info("Account not active", { status: userProfile.status });
          await supabase.auth.signOut();
          throw new Error("حسابك غير مفعل. يرجى انتظار موافقة الإدارة.");
        }

        // Set user from auth response (not user_metadata which may be stale)
        setUser(data.user as unknown as User);
        setProfile(userProfile);

        logger.debug("Login complete - final state", {
          userId: data.user.id,
          profileRole: userProfile.role,
          profileStatus: userProfile.status,
        });

        return { data, error: null };
      } catch (err) {
        const errorMessage = (err as Error).message;
        setError(errorMessage);
        return { data: null, error: err as Error };
      } finally {
        setLoading(false);
      }
    },
    [fetchProfile],
  );

  // ============================================
  // Sign Up
  // ============================================
  const signUp = useCallback(
    async (email: string, password: string, profileData: Partial<Profile>) => {
      setError(null);
      setLoading(true);
      logger.info("Starting registration", { email, role: profileData.role });

      try {
        // Create auth user with metadata
        // The database trigger (handle_new_user) automatically creates the profile
        const { data: authData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                first_name: profileData.first_name || "",
                second_name: profileData.second_name || "",
                third_name: profileData.third_name || "",
                phone: profileData.phone || "",
                role: profileData.role || "student",
                age: profileData.age,
                country: profileData.country,
                student_type: profileData.student_type,
                memorization_level: profileData.memorization_level,
                teaching_experience: profileData.teaching_experience,
                preferred_audience: profileData.preferred_audience,
                available_times: JSON.stringify(profileData.available_times || []),
              },
            },
          });

        if (signUpError) {
          logger.error("Auth signup failed", signUpError);
          throw signUpError;
        }

        if (!authData.user) {
          logger.error("No user returned from signup");
          throw new Error("فشل إنشاء الحساب");
        }

        const userId = authData.user.id;
        logger.info("Auth user created (trigger will create profile)", { userId });

        // Wait for trigger to create profile, then verify it exists
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const profile = await fetchProfile(userId, 3, 500);
        if (!profile) {
          logger.error("Profile not created by trigger - attempting manual creation");
          // Fallback: Try manual insert if trigger failed
          const { error: profileError } = await db.profiles.create({
            id: userId,
            email: email,
            first_name: profileData.first_name || "",
            second_name: profileData.second_name || "",
            third_name: profileData.third_name || "",
            phone: profileData.phone || "",
            age: profileData.age,
            country: profileData.country,
            role: profileData.role || "student",
            student_type: profileData.student_type,
            memorization_level: profileData.memorization_level,
            teaching_experience: profileData.teaching_experience,
            preferred_audience: profileData.preferred_audience,
            available_times: profileData.available_times || [],
            status: "pending",
          });

          if (profileError) {
            logger.error("Manual profile creation also failed", profileError);
            await supabase.auth.signOut();
            throw new Error("فشل إنشاء الملف الشخصي");
          }
        }

        logger.info("Profile verified/created", { userId });

        // Sign out (user needs admin approval)
        await supabase.auth.signOut();
        logger.info("User signed out after registration (pending approval)");

        return { data: authData, error: null };
      } catch (err) {
        const errorMessage = (err as AuthError | Error).message;
        logger.error("Registration failed", err);
        setError(errorMessage);
        return { data: null, error: err as Error };
      } finally {
        setLoading(false);
      }
    },
    [fetchProfile],
  );

  // ============================================
  // Sign Out
  // ============================================
  const signOut = useCallback(async () => {
    setError(null);
    logger.info("Signing out");

    try {
      // Clear state FIRST
      setUser(null);
      setProfile(null);

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        logger.error("Sign out error", signOutError);
        // Don't throw - state is already cleared
      }

      logger.info("Sign out complete");
      return { error: null };
    } catch (err) {
      logger.error("Sign out exception", err);
      return { error: err as Error };
    }
  }, []);

  // ============================================
  // Reset Password
  // ============================================
  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    setLoading(true);
    logger.info("Requesting password reset", { email });

    try {
      const { data, error: resetError } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

      if (resetError) throw resetError;

      logger.info("Password reset email sent");
      return { data, error: null };
    } catch (err) {
      logger.error("Password reset failed", err);
      setError((err as Error).message);
      return { data: null, error: err as Error };
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // Update Password (used by /reset-password flow)
  // ============================================
  const updatePassword = useCallback(async (password: string) => {
    setError(null);
    logger.info("Updating password");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("انتهت صلاحية رابط إعادة التعيين أو أنه غير صالح");
      }

      const { data, error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      logger.info("Password updated successfully");
      // NOTE: we intentionally do NOT clear isRecoverySession here. The flag
      // is cleared by the SIGNED_OUT event that fires when the page finishes
      // the flow with signOut(). Clearing it now would cause PublicRoute and
      // ResetPassword's session check to race against the success UI.
      return { data, error: null };
    } catch (err) {
      logger.error("Password update failed", err);
      setError((err as Error).message);
      return { data: null, error: err as Error };
    }
  }, []);

  // ============================================
  // Update Profile
  // ============================================
  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!user) {
        return { data: null, error: new Error("Not authenticated") };
      }

      setError(null);
      logger.info("Updating profile", { userId: user.id });

      try {
        const { data, error: updateError } = await db.profiles.update(
          user.id,
          updates,
        );
        if (updateError) throw updateError;

        setProfile(data);
        logger.info("Profile updated");
        return { data, error: null };
      } catch (err) {
        logger.error("Profile update failed", err);
        setError((err as Error).message);
        return { data: null, error: err as Error };
      }
    },
    [user],
  );

  // ============================================
  // Refresh Profile
  // ============================================
  const refreshProfile = useCallback(async () => {
    if (!user) return;

    logger.info("Refreshing profile", { userId: user.id });
    const freshProfile = await fetchProfile(user.id);
    if (freshProfile) {
      setProfile(freshProfile);
    }
  }, [user, fetchProfile]);

  // ============================================
  // Role Utilities
  // ============================================
  const hasRole = useCallback(
    (role: UserRole) => {
      const result = profile?.role === role;
      logger.debug("hasRole check", {
        checkingRole: role,
        profileRole: profile?.role,
        result,
      });
      return result;
    },
    [profile],
  );
  const isAdmin = useCallback(() => hasRole("admin"), [hasRole]);
  const isTeacher = useCallback(() => hasRole("teacher"), [hasRole]);
  const isStudent = useCallback(() => hasRole("student"), [hasRole]);

  // ============================================
  // Context Value
  // ============================================
  const value: AuthContextType = {
    user,
    profile,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshProfile,
    hasRole,
    isAdmin,
    isTeacher,
    isStudent,
    isAuthenticated: !!user && !!profile,
    isActive: profile?.status === "active",
    isRecoverySession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================
// useAuth Hook
// ============================================
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
