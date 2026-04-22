-- ============================================================
-- 0007_settings_table
-- Guarantees `public.settings` exists with a single canonical row (id=1)
-- holding both the brand text (academy name + description, AR/EN) and
-- the contact channels (facebook / instagram / whatsapp / email).
--
-- Schema choices:
--   * Single-row shape (id = 1) — simple, predictable, easy RLS.
--   * Ships BOTH the legacy column names used by earlier SettingsContext
--     reads (contact_facebook, academy_name_ar, …) AND the new names from
--     the product spec (facebook_url, whatsapp_number). Frontend reads
--     whichever exists; admin UI writes the new canonical names.
--
-- Idempotent: every statement uses IF NOT EXISTS / ON CONFLICT so the
-- migration is safe to re-run against a populated DB.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.settings (
    id                     INTEGER PRIMARY KEY,
    -- Branding
    academy_name_ar        TEXT,
    academy_name_en        TEXT,
    academy_description_ar TEXT,
    academy_description_en TEXT,
    -- Contact (new canonical names per product spec)
    facebook_url           TEXT,
    instagram_url          TEXT,
    whatsapp_number        TEXT,
    email                  TEXT,
    -- Contact (legacy names kept for backward compatibility with older
    -- SettingsContext reads — same values as above, DB-level mirror).
    contact_facebook       TEXT,
    contact_instagram      TEXT,
    contact_whatsapp       TEXT,
    contact_email          TEXT,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If the table already existed without the full column set, add whatever
-- is missing. These are all nullable so no backfill value is required.
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS academy_name_ar        TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS academy_name_en        TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS academy_description_ar TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS academy_description_en TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS facebook_url           TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS instagram_url          TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS whatsapp_number        TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS email                  TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS contact_facebook       TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS contact_instagram      TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS contact_whatsapp       TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS contact_email          TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure the canonical row exists. ON CONFLICT means rerunning this
-- migration won't wipe any admin edits.
INSERT INTO public.settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- updated_at auto-bump (reuses the helper from 0002).
DROP TRIGGER IF EXISTS settings_updated_at ON public.settings;
CREATE TRIGGER settings_updated_at
    BEFORE UPDATE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ---------------- RLS ----------------------------------------
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_public" ON public.settings;
DROP POLICY IF EXISTS "settings_admin_all"      ON public.settings;

-- Anyone (anon + authenticated) can read settings — the landing page is
-- public, so brand text + contact URLs need to be reachable pre-login.
CREATE POLICY "settings_select_public"
    ON public.settings FOR SELECT
    USING (true);

-- Only admins can write. Uses get_my_role() from 0002 to avoid recursion.
CREATE POLICY "settings_admin_all"
    ON public.settings FOR ALL
    TO authenticated
    USING (get_my_role() = 'admin')
    WITH CHECK (get_my_role() = 'admin');

-- Grants match the RLS above.
GRANT SELECT          ON public.settings TO anon, authenticated;
GRANT INSERT, UPDATE  ON public.settings TO authenticated;
