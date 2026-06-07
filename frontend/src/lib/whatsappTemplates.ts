/**
 * whatsappTemplates — default + admin-customizable message templates for
 * the WhatsApp confirmation flow.
 *
 * Frontend-only. The default text lives here so it's grep-able and
 * code-reviewable. Admin overrides persist in `localStorage` (per
 * browser, not per user) so customizations survive a refresh without
 * touching the database.
 *
 * Templates support `{{name}}` interpolation — the only variable
 * currently used. Add new placeholders by extending `TemplateVars` and
 * `renderTemplate`.
 */

const STORAGE_KEY = 'wahdaynak:whatsapp:teacherConfirmation';

/**
 * Default Arabic message sent to teachers after registration.
 * Mirrors the academy's voice and the volunteer-only disclosure
 * required up front. The `{{name}}` slot is optional — admins can
 * remove it from the template if they prefer a fully generic message.
 */
export const DEFAULT_TEACHER_CONFIRMATION = `السلام عليكم ورحمة الله وبركاته 🌷

نشكر لكم تسجيلكم في أكاديمية وهديناك لخدمات القرآن الكريم.

نود التأكيد أن التدريس في الأكاديمية تطوعي بالكامل وغير مدفوع الأجر، احتسابًا للأجر والثواب عند الله تعالى.

وبحسب البيانات التي قمتم بتسجيلها، ستكون الحلقات المتاحة لكم خلال الأيام التالية:

📅 الأحد، الإثنين، الثلاثاء، الأربعاء، الخميس
🕐 وفق الأوقات التي قمتم باختيارها عند التسجيل.

نرجو الرد بأحد الخيارين:

✅ أؤكد استمراري وانضمامي للأكاديمية، مع كتابة الأوقات المناسبة والمتاحة لديّ للتدريس.

❌ أعتذر عن عدم الاستمرار.

جزاكم الله خيرًا، وبارك في علمكم وعملكم.`;

export interface TemplateVars {
  /** Recipient display name. Substituted into `{{name}}` placeholders. */
  name?: string;
}

/**
 * Load the admin's saved template, falling back to the default when
 * localStorage is empty, unreachable (SSR/prerender), or holds a
 * non-string value.
 */
export function loadTeacherConfirmationTemplate(): string {
  if (typeof window === 'undefined') return DEFAULT_TEACHER_CONFIRMATION;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return typeof stored === 'string' && stored.length > 0
      ? stored
      : DEFAULT_TEACHER_CONFIRMATION;
  } catch {
    return DEFAULT_TEACHER_CONFIRMATION;
  }
}

/**
 * Persist a customized template. Pass `null` (or the default verbatim)
 * to clear the override and revert to the built-in copy.
 */
export function saveTeacherConfirmationTemplate(template: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (template === null || template === DEFAULT_TEACHER_CONFIRMATION) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, template);
  } catch {
    // Storage quota / privacy mode — non-fatal. The admin can still
    // edit the message in the dialog for the current send.
  }
}

/** Substitute `{{name}}` (and future placeholders) into `template`. */
export function renderTemplate(template: string, vars: TemplateVars = {}): string {
  let out = template;
  if (vars.name !== undefined) {
    out = out.replace(/\{\{\s*name\s*\}\}/g, vars.name);
  }
  return out;
}
