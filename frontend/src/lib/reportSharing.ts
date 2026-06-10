/**
 * reportSharing — turn a student's report into a readable Arabic
 * summary the admin / student can paste into their halaqah's
 * WhatsApp group.
 *
 * The academy's `halaqahs.meet_link` column is being repurposed as
 * a WhatsApp **group invite** URL (chat.whatsapp.com/<code>) — those
 * URLs don't accept a `?text=…` query param, so we can't pre-fill
 * the message via the same `wa.me` trick used for direct chats.
 * The dispatcher below works around that with a three-step
 * graceful-degradation flow:
 *
 *   1. `navigator.share()` — the OS share sheet. On phones this lets
 *      the user pick WhatsApp + a group directly with the message
 *      already filled in. Best case.
 *   2. Clipboard copy + open group link in a new tab. The user
 *      pastes manually. Works on any desktop browser.
 *   3. Clipboard-only (when the halaqah has no link). The user can
 *      paste wherever they like.
 *
 * The result tells the caller which path actually ran so the UI can
 * surface the right toast (e.g. "copied — paste it into the group").
 */
import type { Report, ReportItem } from '../types';

interface ReportWithItems extends Report {
  items?: ReportItem[];
}

export interface FormatReportOpts {
  /** Display name of the student. Rendered after "الطالب/ة:". */
  studentName: string;
  /** Optional halaqah name shown in the header. */
  halaqahName?: string;
  /**
   * Academy name shown as the first line. Defaults to "أكاديمية
   * وهديناك لخدمات القرآن الكريم" so callers that don't have access
   * to SettingsContext still produce the canonical header.
   */
  academyName?: string;
}

/** Default Arabic academy header — matches the production brand. */
export const DEFAULT_ACADEMY_NAME =
  'أكاديمية وهديناك لخدمات القرآن الكريم';

/**
 * Render a multi-line Arabic summary of the report. Plain text with
 * emoji separators — paste-friendly into any WhatsApp group. Each
 * item carries explicit labels ("السورة", "مقدار الحفظ" /
 * "مقدار المراجعة") so the message reads cleanly when shared with
 * teachers who skim quickly.
 */
export function formatReportForSharing(
  report: ReportWithItems,
  opts: FormatReportOpts,
): string {
  const mem =
    (report.items ?? []).filter((i) => i.type === 'memorization');
  const rev = (report.items ?? []).filter((i) => i.type === 'review');

  const academyName = opts.academyName?.trim() || DEFAULT_ACADEMY_NAME;

  const lines: string[] = [];
  lines.push(`🌷 ${academyName}`);
  lines.push('');
  lines.push(`📖 الطالب/ة: ${opts.studentName}`);
  lines.push(`📅 التاريخ: ${report.report_date}`);
  if (opts.halaqahName) lines.push(`🌿 الحلقة: ${opts.halaqahName}`);
  lines.push('');

  if (mem.length > 0) {
    lines.push('📚 التسميع:');
    for (const item of mem) {
      lines.push(
        `• السورة: ${item.surah_name} — مقدار الحفظ: ${item.pages} صفحة`,
      );
    }
    lines.push('');
  }

  if (rev.length > 0) {
    lines.push('🔁 المراجعة:');
    for (const item of rev) {
      lines.push(
        `• السورة: ${item.surah_name} — مقدار المراجعة: ${item.pages} صفحة`,
      );
    }
    lines.push('');
  }

  if (report.notes) {
    lines.push(`📝 ${report.notes}`);
  }

  return lines.join('\n').trim();
}

export interface ShareReportOpts {
  text: string;
  /**
   * Halaqah WhatsApp group invite URL. May be empty/null — the
   * dispatcher gracefully degrades to a clipboard-only outcome.
   */
  halaqahLink?: string | null;
}

export type ShareReportOutcome =
  /** OS share sheet completed (user picked a target). */
  | 'shared'
  /** Clipboard write succeeded AND we opened the group link. */
  | 'copied_and_opened'
  /** Clipboard write succeeded but there was no group link to open. */
  | 'copied'
  /** Clipboard failed AND no link to open. */
  | 'unavailable';

/**
 * Dispatch the share. Caller surfaces the outcome via a toast so the
 * user knows what to do next (e.g. "paste it in the group").
 */
export async function shareReportViaWhatsapp(
  opts: ShareReportOpts,
): Promise<ShareReportOutcome> {
  // 1) OS share sheet — the cleanest path on mobile.
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: opts.text });
      return 'shared';
    } catch {
      // User cancelled / unsupported target — fall through to the
      // clipboard+open fallback.
    }
  }

  // 2) Copy to clipboard.
  let copied = false;
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard?.writeText
  ) {
    try {
      await navigator.clipboard.writeText(opts.text);
      copied = true;
    } catch {
      // Permission denied / non-secure context — proceed without copy.
    }
  }

  // 3) Open the group link if we have one.
  const link = opts.halaqahLink?.trim();
  if (link) {
    window.open(link, '_blank', 'noopener,noreferrer');
    return copied ? 'copied_and_opened' : 'shared';
  }

  return copied ? 'copied' : 'unavailable';
}
