/**
 * Typed, validated environment access.
 *
 * We read every VITE_* the app depends on exactly once, fail loudly at module
 * load if something is missing, and export the result as a frozen object.
 * Consumers import named values — never `import.meta.env` directly.
 */

interface AppEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  IS_DEV: boolean;
  IS_PROD: boolean;
}

function required(key: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `[env] Missing required environment variable "${key}". ` +
        `Make sure it's set in your .env file (see .env.example).`,
    );
  }
  return value;
}

const raw = import.meta.env;

export const env: Readonly<AppEnv> = Object.freeze({
  SUPABASE_URL: required('VITE_SUPABASE_URL', raw.VITE_SUPABASE_URL),
  SUPABASE_ANON_KEY: required('VITE_SUPABASE_ANON_KEY', raw.VITE_SUPABASE_ANON_KEY),
  IS_DEV: !!raw.DEV,
  IS_PROD: !!raw.PROD,
});
