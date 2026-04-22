/**
 * Aggregate export for all typed Supabase API modules.
 *
 * Use `api.profiles`, `api.halaqah`, `api.reports` in new code instead of the
 * legacy `db` object re-exported from `lib/supabase`.
 */
export { profilesApi as profiles } from './profiles';
export { halaqahApi  as halaqah }  from './halaqah';
export { reportsApi  as reports }  from './reports';
export { settingsApi as settings } from './settings';
