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
import { supabase } from "../lib/supabase/client";
import { api } from "../lib/supabase";
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
  // Auth-session hydration flag (separate from profileLoading).
  const [loading, setLoading] = useState(true);
  // Profile-fetch hydration flag. True whenever a `profiles` SELECT is in
  // flight; false once the current attempt has resolved (regardless of
  // whether it found a row). Guards use it to hold a spinner without
  // blocking the auth session itself.
  const [profileLoading, setProfileLoading] = useState(false);
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
  // Mirrors isRecoverySession so the long-lived onAuthStateChange closure
  // always reads the current value without being recreated.
  const isRecoverySessionRef = useRef(isRecoverySession);
  useEffect(() => {
    isRecoverySessionRef.current = isRecoverySession;
  }, [isRecoverySession]);

  // ============================================
  // Fetch Profile — delegates to api.profiles.getById, which owns the
  // trigger-delay retry loop and RLS-recursion short-circuit.
  // ============================================
  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      if (!userId) return null;
      logger.info("Fetching profile", { userId });
      const { data, error: fetchError } = await api.profiles.getById(userId);
      if (fetchError) {
        logger.error("Profile fetch failed", fetchError);
        return null;
      }
      if (!data) {
        logger.error("Profile not found after retries");
        return null;
      }
      return data;
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
        setProfileLoading(false);
        setLoading(false);
        return;
      }

      const sessionUser = session.user;
      logger.info("Session user found", { userId: sessionUser.id });

      // Announce the session immediately so guards stop blocking on auth.
      // The profile fetch happens in the background below.
      setUser(sessionUser as unknown as User);
      setLoading(false);

      setProfileLoading(true);
      const userProfile = await fetchProfile(sessionUser.id);
      // Never overwrite an already-loaded profile with null — a transient
      // fetch failure here must not clobber a good profile set by a
      // concurrent path (e.g. signIn). The "no profile" case is signaled
      // by profileLoading flipping to false while profile stays null, and
      // guards handle that explicitly.
      if (userProfile) {
        setProfile(userProfile);
      }
      setProfileLoading(false);
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
          setProfileLoading(false);
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
              setProfileLoading(false);
              setLoading(false);
              break;

            case "SIGNED_IN":
            case "TOKEN_REFRESHED":
            case "USER_UPDATED":
              if (!sessionUser) {
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
              setProfileLoading(false);
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
      setProfileLoading(true);
      logger.info("Attempting sign in", { email });

      try {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });

        if (signInError) {
          logger.error("Sign in failed", signInError);
          throw signInError;
        }

        if (!data.user) {
          throw new Error("لم يتم إرجاع بيانات المستخدم");
        }

        logger.info("Sign in successful", { userId: data.user.id });

        // Set the session immediately so guards see `user` without waiting.
        setUser(data.user as unknown as User);

        // Then resolve the profile inline. Awaiting here means the caller
        // (Login.tsx) can safely navigate once `signIn` returns — by then
        // both `user` and `profile` are populated in context, so
        // DashboardDispatcher renders the target page on its first paint
        // instead of showing a spinner that requires a refresh to break.
        const userProfile = await fetchProfile(data.user.id);
        if (userProfile) {
          setProfile(userProfile);
        }

        return { data, error: null };
      } catch (err) {
        const errorMessage = (err as Error).message;
        setError(errorMessage);
        return { data: null, error: err as Error };
      } finally {
        setProfileLoading(false);
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

      // Lock language_type into a valid literal at the boundary. The form
      // already normalizes; this is defense-in-depth so any future caller
      // can't accidentally send undefined / null to Supabase and leave
      // the column NULL.
      const languageType =
        profileData.language_type === 'non_arabic_speaker'
          ? 'non_arabic_speaker'
          : 'arabic_speaker';
      logger.info("Registration language_type resolved", {
        incoming: profileData.language_type,
        persisted: languageType,
      });

      // Build the metadata payload as a single object so we can log the
      // exact bytes Supabase will receive. This is the value that lands
      // in `auth.users.raw_user_meta_data` and that the trigger reads.
      // Field names here MUST match the column names the trigger expects
      // — no transformation, no key renaming.
      const signupMetadata = {
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
        // Segmentation + riwayah + teacher extensions (0005).
        segment: profileData.segment,
        recitation: profileData.recitation ?? undefined,
        quran_parts_taught: profileData.quran_parts_taught ?? undefined,
        is_certified: profileData.is_certified ?? false,
        authorized_recitations: JSON.stringify(profileData.authorized_recitations || []),
        // CRITICAL: key MUST be exactly `language_type`. The trigger reads
        // raw_user_meta_data->>'language_type'. Any rename here breaks
        // persistence silently. Defense-in-depth: `languageType` is
        // normalized to a literal above, so this is always either
        // 'arabic_speaker' or 'non_arabic_speaker' (never null/undefined).
        language_type: languageType,
      };

      // Unmissable diagnostic printed with the exact label the product
      // spec asked for. This is what `options.data` will be in the
      // supabase.auth.signUp call immediately below — if `language_type`
      // is missing from this log, it is missing from the network request
      // and therefore missing from `raw_user_meta_data`.
      console.log('SIGNUP META', signupMetadata);
      // Also keep a structured log for server-log tooling.
      logger.info("signUp metadata sent to Supabase", {
        keys: Object.keys(signupMetadata),
        language_type: signupMetadata.language_type,
      });

      try {
        // Create auth user with metadata. The database trigger
        // (handle_new_user) reads from raw_user_meta_data and inserts
        // into profiles. Whatever lands in `data` here lands in
        // `auth.users.raw_user_meta_data` verbatim.
        const { data: authData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              data: signupMetadata,
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

        // DIRECT WRITE — authoritative path for `language_type`.
        // The handle_new_user trigger sometimes fires before
        // raw_user_meta_data is fully populated, leaving language_type
        // NULL. We no longer rely on it: we UPDATE the profile row
        // ourselves with the normalized literal right after signup.
        // The trigger remains as a fallback for the other fields; it
        // will also set language_type if it can, but this UPDATE wins.
        try {
          const { error: langError } = await api.profiles.update(userId, {
            language_type: languageType,
          });
          if (langError) {
            logger.error("Direct language_type update failed", langError);
          } else {
            logger.info("language_type written directly", {
              userId,
              language_type: languageType,
            });
          }
        } catch (langErr) {
          logger.error("Direct language_type update threw", langErr);
        }

        const profile = await fetchProfile(userId);
        if (!profile) {
          logger.error("Profile not created by trigger - attempting manual creation");
          // Fallback: Try manual insert if trigger failed
          const { error: profileError } = await api.profiles.create({
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
            segment: profileData.segment,
            recitation: profileData.recitation,
            quran_parts_taught: profileData.quran_parts_taught,
            is_certified: profileData.is_certified,
            authorized_recitations: profileData.authorized_recitations,
            language_type: languageType,
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
        const { data, error: updateError } = await api.profiles.update(
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
    profileLoading,
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
