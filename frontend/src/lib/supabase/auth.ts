/**
 * Thin auth helpers around supabase.auth.
 *
 * Kept intentionally small — only what the app actually uses. Anything more
 * complex (session hydration, profile fetching, recovery-flow bookkeeping)
 * lives in `context/AuthContext`.
 */
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from './client';

export const authApi = {
  signUp: (email: string, password: string, metadata: Record<string, unknown> = {}) =>
    supabase.auth.signUp({ email, password, options: { data: metadata } }),

  signInWithPassword: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  signOut: () => supabase.auth.signOut(),

  getSession: async (): Promise<{ session: Session | null; error: AuthError | null }> => {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  },

  getUser: async (): Promise<{ user: User | null; error: AuthError | null }> => {
    const { data, error } = await supabase.auth.getUser();
    return { user: data.user, error };
  },

  resetPasswordForEmail: (email: string, redirectTo: string) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo }),

  updatePassword: (password: string) => supabase.auth.updateUser({ password }),

  onAuthStateChange: (
    cb: (event: string, session: Session | null) => void,
  ) => supabase.auth.onAuthStateChange(cb),
};
