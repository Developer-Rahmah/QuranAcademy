-- ============================================================================
-- cleanup_for_production.sql
--
-- Wipes all USER-GENERATED data while keeping the schema, RLS policies,
-- functions, migrations, and a single admin account intact.
--
--   PRESERVED:
--     - every table, column, constraint, index, RLS policy, function, trigger
--     - public.settings rows (academy config — uncomment Phase 5 to wipe)
--     - the admin user identified by `admin@admin.com` and its `profiles` row
--
--   DELETED:
--     - every report_item, report, halaqah_member, halaqah_supervisor row
--     - every halaqah row (teacher_id ON DELETE SET NULL means deleting the
--       teacher's profile leaves halaqahs orphaned, so we wipe them
--       explicitly to avoid carrying ghost halaqahs into production)
--     - every public.profiles row except admin's
--     - every auth.users row except admin's
--
-- Earlier revisions of this script used a temp table (`_keep_admin`) to
-- stage the admin id. The Supabase SQL Editor effectively runs each
-- top-level statement in its own session so the temp table did not
-- persist across statements (`ERROR: relation "_keep_admin" does not
-- exist`). The current version inlines the admin lookup as a subquery
-- in every DELETE so it works correctly in BOTH the SQL Editor AND
-- psql / `supabase db execute`.
-- ============================================================================
-- ⚠  WARNING — IRREVERSIBLE
-- ============================================================================
-- BEFORE you run this:
--
--   1. Take a Supabase project backup (Project Settings → Database →
--      Backups → "Create backup"). On free-tier projects, run
--      `pg_dump` against the connection string in Settings → Database.
--   2. Confirm `admin@admin.com` exists in `auth.users`. The pre-flight
--      check at the top of this script aborts (RAISE EXCEPTION) if the
--      admin is missing or duplicated — DO NOT remove that guard.
--   3. Run this script in the Supabase SQL Editor or via psql. The
--      whole thing is wrapped in BEGIN ... COMMIT so a mid-script
--      failure rolls back cleanly with zero rows deleted.
--   4. After running, inspect the verification NOTICEs (in the SQL
--      Editor's "Notices" tab, or psql's stderr). If any row count
--      looks wrong, restore from backup immediately.
--
-- This script does NOT:
--   - drop tables / columns / indexes
--   - alter constraints, RLS policies, or functions
--   - touch the migrations history
--   - modify storage buckets or storage objects (handle those separately
--     via the Supabase Storage admin UI if you have uploaded files)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Pre-flight: refuse to run if admin@admin.com is missing or duplicated.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    admin_count integer;
BEGIN
    SELECT COUNT(*) INTO admin_count
      FROM auth.users
     WHERE email = 'admin@admin.com';

    IF admin_count = 0 THEN
        RAISE EXCEPTION
          'Admin user admin@admin.com not found in auth.users — refusing to wipe data. '
          'Create the admin first, then re-run this script.';
    END IF;

    IF admin_count > 1 THEN
        RAISE EXCEPTION
          'Found % rows for admin@admin.com — expected exactly 1. '
          'Resolve the duplicate before running cleanup.', admin_count;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- Phase 1 — Child tables first.
--
-- These are leaves of the FK graph; deleting them in this order means
-- no FK violations even if cascades were disabled. The current schema
-- has CASCADE on most paths, but the explicit order keeps the script
-- reviewable and survives future schema changes that swap CASCADE for
-- RESTRICT on any one edge.
-- ---------------------------------------------------------------------

-- 1a. report_items → reports → profiles
DELETE FROM public.report_items;

-- 1b. reports → halaqahs / profiles
DELETE FROM public.reports;

-- 1c. halaqah_members → halaqahs / profiles
DELETE FROM public.halaqah_members;

-- 1d. halaqah_supervisors → halaqahs / profiles
DELETE FROM public.halaqah_supervisors;

-- ---------------------------------------------------------------------
-- Phase 2 — Halaqahs.
--
-- Wiped unconditionally. teacher_id has ON DELETE SET NULL, so leaving
-- halaqahs around after deleting their teacher would produce orphan
-- rows; we'd rather start production with zero halaqahs.
-- ---------------------------------------------------------------------
DELETE FROM public.halaqahs;

-- ---------------------------------------------------------------------
-- Phase 3 — Profiles.
--
-- Keep only the admin. Every reference to the admin id is an inline
-- subquery against auth.users — no temp tables, no session-bound
-- state. Phase 1 already emptied the cascading children, so removing
-- non-admin profiles touches no other rows.
-- ---------------------------------------------------------------------
DELETE FROM public.profiles
 WHERE id <> (SELECT id FROM auth.users WHERE email = 'admin@admin.com');

-- ---------------------------------------------------------------------
-- Phase 4 — auth.users.
--
-- Source of truth for accounts. Email comparison is exact and case-
-- sensitive (auth.users.email is stored lowercased by Supabase, so
-- 'admin@admin.com' matches the canonical form).
--
-- Cascades into auth.identities, auth.sessions, auth.refresh_tokens
-- via Supabase's own FK setup. For projects using OAuth / external
-- IdPs, prefer `supabase.auth.admin.deleteUser(id)` so the IdP
-- linkage cleans up too — for plain email/password (this project)
-- direct DELETE is supported and equivalent.
-- ---------------------------------------------------------------------
DELETE FROM auth.users
 WHERE email <> 'admin@admin.com';

-- ---------------------------------------------------------------------
-- Phase 5 — (OPTIONAL) reset academy settings.
--
-- `settings` is configuration, not user data. By default we keep it so
-- the production app comes up with the academy name, contact links,
-- and complaints Telegram username already populated. Uncomment the
-- next line ONLY if you want to start with a blank settings row.
-- ---------------------------------------------------------------------
-- DELETE FROM public.settings;

-- ---------------------------------------------------------------------
-- Phase 6 — Sanity checks.
--
-- These RAISE NOTICE rows show in the SQL Editor's "Notices" tab. If
-- the admin is missing or counts are wrong, the second RAISE EXCEPTION
-- rolls back the whole transaction.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    n_users         integer;
    n_profiles      integer;
    n_halaqahs      integer;
    n_members       integer;
    n_supervisors   integer;
    n_reports       integer;
    n_report_items  integer;
    admin_present   boolean;
BEGIN
    SELECT COUNT(*) INTO n_users        FROM auth.users;
    SELECT COUNT(*) INTO n_profiles     FROM public.profiles;
    SELECT COUNT(*) INTO n_halaqahs     FROM public.halaqahs;
    SELECT COUNT(*) INTO n_members      FROM public.halaqah_members;
    SELECT COUNT(*) INTO n_supervisors  FROM public.halaqah_supervisors;
    SELECT COUNT(*) INTO n_reports      FROM public.reports;
    SELECT COUNT(*) INTO n_report_items FROM public.report_items;
    SELECT EXISTS (
        SELECT 1 FROM auth.users WHERE email = 'admin@admin.com'
    ) INTO admin_present;

    RAISE NOTICE 'auth.users:                 % (expected: 1)',   n_users;
    RAISE NOTICE 'public.profiles:            % (expected: 1)',   n_profiles;
    RAISE NOTICE 'public.halaqahs:            % (expected: 0)',   n_halaqahs;
    RAISE NOTICE 'public.halaqah_members:     % (expected: 0)',   n_members;
    RAISE NOTICE 'public.halaqah_supervisors: % (expected: 0)',   n_supervisors;
    RAISE NOTICE 'public.reports:             % (expected: 0)',   n_reports;
    RAISE NOTICE 'public.report_items:        % (expected: 0)',   n_report_items;
    RAISE NOTICE 'admin@admin.com present:    % (expected: t)',   admin_present;

    IF NOT admin_present THEN
        RAISE EXCEPTION 'Admin missing after cleanup — aborting!';
    END IF;
    IF n_users <> 1 OR n_profiles <> 1 THEN
        RAISE EXCEPTION
          'Unexpected row counts (users=%, profiles=%) — aborting.',
          n_users, n_profiles;
    END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- Post-commit verification — run this in a separate query to inspect
-- the surviving admin row directly.
-- ---------------------------------------------------------------------
-- SELECT u.id, u.email, u.created_at, p.role, p.status
--   FROM auth.users u
--   LEFT JOIN public.profiles p ON p.id = u.id
--  WHERE u.email = 'admin@admin.com';
