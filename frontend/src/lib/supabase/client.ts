/**
 * Supabase client singleton.
 *
 * Typed against the canonical `Database` shape so every `.from('x')` / `.rpc('y')`
 * call is checked against the real schema. Env access is centralized through
 * `lib/env` which fails loudly on missing values.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';
import type { Database } from './database.types';

export type AppSupabaseClient = SupabaseClient<Database>;

export const supabase: AppSupabaseClient = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);
