/**
 * MatchingBadge — clickable "✓ N matching" chip + popover.
 *
 * Surfaces the result of `findMatches(subject, pool)` on a single
 * AdminUsers row (and inside AdminUserDetail). The badge shows the
 * count; clicking it opens a popover listing the matched users with
 * their shared time slots so the admin can decide who to pair.
 *
 * Pure presentational — the parent computes `matches` (typically
 * `useMemo` over the buildMatchIndex result). The popover navigates to
 * each user's detail page via `to` (consumer supplies it), so the
 * molecule stays route-agnostic.
 *
 * RTL-safe: popover uses logical `end-0`; check + chevron use
 * `currentColor` so theming carries through.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../../locales/i18n';
import { Badge } from '../../atoms/Badge';
import { CheckIcon } from '../../atoms/Icon';
import { formatSlotRange } from '../../../lib/time';
import { getDisplayName } from '../../../lib/utils';
import type { SlotMatch } from '../../../lib/matching';

export interface MatchingBadgeProps {
  /** Pre-computed matches for the subject. */
  matches: readonly SlotMatch[];
  /**
   * Subject's role drives the popover heading: a student row shows
   * "Matching teachers", a teacher row shows "Matching students".
   * Optional — defaults to a neutral "Matches" heading when omitted.
   */
  subjectRole?: 'student' | 'teacher' | null;
  /** Build the detail-page URL for a matched user. */
  to?: (userId: string) => string;
  /** Hide the popover entirely. Useful inside an already-open modal. */
  inline?: boolean;
}

export function MatchingBadge({
  matches,
  subjectRole,
  to,
  inline = false,
}: MatchingBadgeProps) {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click. Mirror the SearchableSelect pattern so
  // both popovers behave identically across the admin surface.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const count = matches.length;
  const lang: 'ar' | 'en' = language === 'en' ? 'en' : 'ar';

  // Label text. "Matching teachers" / "Matching students" / neutral.
  const oppositeLabelKey =
    subjectRole === 'student'
      ? 'matching.teacherMatchesCount'
      : subjectRole === 'teacher'
        ? 'matching.studentMatchesCount'
        : 'matching.matchesCount';
  const headingKey =
    subjectRole === 'student'
      ? 'matching.matchingTeachers'
      : subjectRole === 'teacher'
        ? 'matching.matchingStudents'
        : 'matching.matches';

  if (count === 0) {
    return (
      <Badge variant="muted" size="sm" className="opacity-70">
        {t('matching.noMatches')}
      </Badge>
    );
  }

  const labelText = t(oppositeLabelKey).replace('{{n}}', String(count));

  if (inline) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">
          {t(headingKey)} ({count})
        </h4>
        <MatchList matches={matches} to={to} lang={lang} t={t} />
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          // Stop the click from bubbling to the row's navigate-on-click
          // handler (AdminUsers rows are clickable).
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/15 transition-colors"
      >
        <CheckIcon className="w-3 h-3" />
        {labelText}
      </button>

      {open && (
        <div
          // The popover sits below the badge, aligned to the inline-end
          // edge so it doesn't push the row layout. z-30 keeps it above
          // sibling rows without fighting the toast layer (z-50).
          role="dialog"
          onClick={(e) => e.stopPropagation()}
          className="absolute z-30 mt-1 end-0 w-80 max-w-[90vw] rounded-lg border border-border bg-white shadow-lg p-3"
        >
          <h4 className="text-sm font-medium text-foreground mb-2">
            {t(headingKey)} ({count})
          </h4>
          <MatchList matches={matches} to={to} lang={lang} t={t} />
        </div>
      )}
    </div>
  );
}

interface MatchListProps {
  matches: readonly SlotMatch[];
  to?: (userId: string) => string;
  lang: 'ar' | 'en';
  t: (key: string) => string;
}

function MatchList({ matches, to, lang, t }: MatchListProps) {
  return (
    <ul className="max-h-60 overflow-y-auto divide-y divide-border text-base">
      {matches.map(({ user, shared }) => {
        const name = getDisplayName(user);
        const href = to?.(user.id);
        return (
          <li key={user.id} className="py-2 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-2">
              {href ? (
                <Link
                  to={href}
                  className="text-sm font-medium text-foreground hover:text-primary hover:underline truncate"
                >
                  {name}
                </Link>
              ) : (
                <span className="text-sm font-medium text-foreground truncate">
                  {name}
                </span>
              )}
              <span className="text-xs text-muted shrink-0">
                {t('matching.sharedSlotCount').replace('{{n}}', String(shared.length))}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {shared.map((s) => (
                <Badge key={s} variant="secondary" size="sm">
                  {formatSlotRange(s, lang)}
                </Badge>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default MatchingBadge;
