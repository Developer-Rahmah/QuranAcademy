-- ============================================================
-- settings.complaints_telegram_username
--
-- Adds the Telegram-username column the FeedbackModal targets as
-- its primary destination (with whatsapp_number as fallback).
-- Idempotent — safe to run multiple times.
--
-- Managed exclusively by admins through /admin/settings; the
-- existing UPDATE policy on `settings` (admin-only) covers writes.
-- ============================================================
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS complaints_telegram_username TEXT;
