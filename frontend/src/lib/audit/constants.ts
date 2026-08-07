/**
 * Single source of truth for audit-log enum strings.
 *
 * These values are mirrored by the CHECK constraints on
 * `public.status_change_audit` (migration 0019). Adding a new
 * source or reason requires BOTH updating this file AND writing a
 * migration that widens the CHECK — the frontend + DB must always
 * agree byte-for-byte.
 *
 * Naming: snake_case matches the DB text. UI labels come from i18n
 * (see `adminAudit.source.*` / `adminAudit.reason.*` keys).
 */

/**
 * UI / system channel a status transition came through. Each
 * value maps to a specific caller site in the frontend or a
 * documented backend job.
 */
export const AUDIT_SOURCES = [
  'admin_users',
  'halaqah_details',
  'supervisor_dashboard',
  'automatic_scheduler',
  'system',
] as const;

export type AuditSource = (typeof AUDIT_SOURCES)[number];

/**
 * Coarse intent for the transition. Derived server-side when the
 * caller omits it — see `default_status_change_reason` (0020).
 */
export const AUDIT_REASONS = [
  'manual_suspension',
  'manual_activation',
  'automatic_suspension',
  'automatic_reactivation',
] as const;

export type AuditReason = (typeof AUDIT_REASONS)[number];

/**
 * i18n key builders. Kept alongside the enums so a new source /
 * reason gets a translated label by convention: the key path
 * mirrors the union value.
 */
export const auditSourceKey = (s: AuditSource): string =>
  `adminAudit.source.${s}`;

export const auditReasonKey = (r: AuditReason): string =>
  `adminAudit.reason.${r}`;
