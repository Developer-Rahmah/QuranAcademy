/**
 * AdminSettings — /admin/settings
 *
 * Single-form editor for every value exposed through `useSettings()`:
 *   - academy name (AR / EN)
 *   - academy description (AR / EN)
 *   - contact channels (facebook / instagram / whatsapp / email)
 *   - teacher-side slot closures (`completed_slots`, per gender)
 *   - student-side slot availability (`unopened_slots`, per gender)
 *
 * Reads current values from SettingsContext (which in turn hydrates from
 * the `settings` table), writes via `settingsApi.update()`, then calls
 * `reload()` so the rest of the app sees new values immediately.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { DashboardLayout, PageSection } from '../components/templates/DashboardLayout';
import { Card, CardContent } from '../components/molecules/Card';
import { FormField } from '../components/molecules/FormField';
import { Button } from '../components/atoms/Button';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from '../locales/i18n';
import { settingsApi } from '../lib/supabase/api/settings';
import type { SettingsMap } from '../lib/supabase/api/settings';
import { TIME_SLOTS } from '../lib/constants';
import { formatSlotRange } from '../lib/time';
import { cn } from '../lib/utils';

/**
 * Only the string-valued settings fields live in the form. Non-string
 * fields (e.g. `completed_slots`, `unopened_slots`) are managed via
 * their own local state and merged into the save payload separately.
 */
type StringSettingsKey = {
  [K in keyof SettingsMap]-?: SettingsMap[K] extends string | undefined
    ? K
    : never;
}[keyof SettingsMap];

type FormState = {
  [K in StringSettingsKey]-?: string;
};

const EMPTY: FormState = {
  academy_name_ar: '',
  academy_name_en: '',
  academy_description_ar: '',
  academy_description_en: '',
  facebook_url: '',
  instagram_url: '',
  whatsapp_number: '',
  email: '',
  complaints_telegram_username: '',
};

/**
 * SlotToggleCard — one row of the availability grid.
 *
 * Single button so the whole surface is clickable, `aria-pressed`
 * mirrors the draft state for screen readers.
 */
interface SlotToggleCardProps {
  label: string;
  active: boolean;
  activeLabel: string;
  openLabel: string;
  onToggle: () => void;
}

function SlotToggleCard({
  label,
  active,
  activeLabel,
  openLabel,
  onToggle,
}: SlotToggleCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        'group flex items-center justify-between gap-3 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors text-start focus:outline-none focus:ring-2 focus:ring-primary/20',
        active
          ? 'border-warning/60 bg-warning/10 hover:border-warning'
          : 'border-border bg-white hover:border-primary/40',
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground">{label}</span>
        <span
          className={cn(
            'text-[11px] font-semibold uppercase tracking-wide',
            active ? 'text-warning' : 'text-success',
          )}
        >
          {active ? activeLabel : openLabel}
        </span>
      </div>
      <span
        className={cn(
          'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors',
          active
            ? 'bg-warning text-white'
            : 'bg-muted/15 text-muted group-hover:bg-primary/10 group-hover:text-primary',
        )}
        aria-hidden="true"
      >
        {active ? '×' : '+'}
      </span>
    </button>
  );
}

/**
 * SlotAvailabilitySection — reusable per-segment availability editor.
 *
 * Both the teacher-side closures (`completed_slots`, men/women) and
 * the student-side gating (`unopened_slots`, men/women/children)
 * share the same UX: intro panel → segment tabs → summary pills →
 * closed/open groups of toggle cards. The difference is entirely
 * copy (i18n keys) + which segments are present.
 *
 * The section accepts an ordered list of `segments` — each entry
 * carries its own key + draft Set + setter — and drives the tabs
 * dynamically off that list. Teacher closures pass 2 entries;
 * student gating passes 3.
 */
type SegmentKey = 'women' | 'men' | 'children';

interface SegmentDraft {
  key: SegmentKey;
  value: Set<string>;
  setValue: React.Dispatch<React.SetStateAction<Set<string>>>;
}

interface SlotAvailabilitySectionProps {
  /** PageSection title (already translated). */
  title: string;
  /** i18n keys for the intro panel (title + 3 bullets). */
  copy: {
    howTitle: string;
    howBullets: readonly [string, string, string];
    segmentTabsLabel: string;
    summaryClosed: string; // has {{n}} placeholder
    summaryOpen: string; // has {{n}} placeholder
    reopenAll: string;
    groupClosed: string;
    groupOpen: string;
    emptyClosed: string;
    cardActive: string; // pill label when the slot IS on
    cardOpen: string; // pill label when the slot is off
  };
  /** Ordered segment list. First entry becomes the initial active tab. */
  segments: readonly SegmentDraft[];
  /** Locale for slot-range formatting. */
  language: 'ar' | 'en';
}

function SlotAvailabilitySection({
  title,
  copy,
  segments,
  language,
}: SlotAvailabilitySectionProps) {
  const { t } = useTranslation();
  // Section-local UI state — which segment tab is being edited.
  // Purely presentational; not part of the save payload. Defaults
  // to the first segment provided so the tab is always valid.
  const [activeSegment, setActiveSegment] = useState<SegmentKey>(
    segments[0]?.key ?? 'women',
  );
  // Guard against `segments` shrinking under our feet — clamp back
  // to a valid tab if the current one disappears.
  useEffect(() => {
    if (!segments.some((s) => s.key === activeSegment)) {
      setActiveSegment(segments[0]?.key ?? 'women');
    }
  }, [segments, activeSegment]);

  const slotButtons = useMemo(
    () =>
      TIME_SLOTS.map((s) => ({
        id: s.id,
        label: formatSlotRange(s.id, language),
      })),
    [language],
  );

  const activeDraft = segments.find((s) => s.key === activeSegment) ?? segments[0];
  const activeSet = activeDraft?.value ?? new Set<string>();
  const closedSlotButtons = useMemo(
    () => slotButtons.filter((s) => activeSet.has(s.id)),
    [slotButtons, activeSet],
  );
  const openSlotButtons = useMemo(
    () => slotButtons.filter((s) => !activeSet.has(s.id)),
    [slotButtons, activeSet],
  );

  const toggleSlot = (slotId: string) => {
    activeDraft?.setValue((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  };

  // Bulk clear across ALL segments this section owns. For the
  // student section that includes children too.
  const reopenAll = () => {
    for (const seg of segments) seg.setValue(new Set());
  };
  const totalClosed = segments.reduce((sum, seg) => sum + seg.value.size, 0);

  return (
    <PageSection title={title}>
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Context panel — spells out the consequences of toggling. */}
          <div className="rounded-lg bg-muted/5 border border-border p-4 space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              {t(copy.howTitle)}
            </h4>
            <ul className="text-sm text-muted space-y-1.5 list-disc ps-5">
              <li>{t(copy.howBullets[0])}</li>
              <li>{t(copy.howBullets[1])}</li>
              <li>{t(copy.howBullets[2])}</li>
            </ul>
          </div>

          {/* Segment tabs — count chips reveal each segment's state
              at a glance so the admin can spot which side needs
              attention without switching tabs. Tab set is driven
              off the `segments` prop, so teacher closures show 2
              tabs while the student section shows 3. */}
          <div
            role="tablist"
            aria-label={t(copy.segmentTabsLabel)}
            className="inline-flex flex-wrap rounded-lg border border-border bg-muted/5 p-1 gap-1"
          >
            {segments.map((seg) => {
              const isActive = activeSegment === seg.key;
              const count = seg.value.size;
              return (
                <button
                  key={seg.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveSegment(seg.key)}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20',
                    isActive
                      ? 'bg-white text-foreground shadow-sm'
                      : 'text-muted hover:text-foreground',
                  )}
                >
                  <span>{t(`segment.${seg.key}`)}</span>
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[10px] font-semibold',
                      count > 0
                        ? 'bg-warning/15 text-warning'
                        : 'bg-muted/15 text-muted',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Summary pills for the active segment + bulk clear (both
              segments). Reopen-all only surfaces when there's actually
              something to reopen. */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-warning/10 text-warning border border-warning/30">
              {t(copy.summaryClosed).replace(
                '{{n}}',
                String(closedSlotButtons.length),
              )}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-success/10 text-success border border-success/30">
              {t(copy.summaryOpen).replace(
                '{{n}}',
                String(openSlotButtons.length),
              )}
            </span>
            {totalClosed > 0 && (
              <button
                type="button"
                onClick={reopenAll}
                className="text-sm text-primary hover:underline ms-auto focus:outline-none focus:ring-2 focus:ring-primary/20 rounded"
              >
                {t(copy.reopenAll)}
              </button>
            )}
          </div>

          {/* Closed group — surfaced first so the admin sees the
              active state immediately. */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wide font-semibold text-warning">
              {t(copy.groupClosed)} ({closedSlotButtons.length})
            </h4>
            {closedSlotButtons.length === 0 ? (
              <p className="text-sm text-muted">{t(copy.emptyClosed)}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {closedSlotButtons.map((s) => (
                  <SlotToggleCard
                    key={s.id}
                    label={s.label}
                    active
                    activeLabel={t(copy.cardActive)}
                    openLabel={t(copy.cardOpen)}
                    onToggle={() => toggleSlot(s.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Open group — the pool the admin pulls from. */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-wide font-semibold text-muted">
              {t(copy.groupOpen)} ({openSlotButtons.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {openSlotButtons.map((s) => (
                <SlotToggleCard
                  key={s.id}
                  label={s.label}
                  active={false}
                  activeLabel={t(copy.cardActive)}
                  openLabel={t(copy.cardOpen)}
                  onToggle={() => toggleSlot(s.id)}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </PageSection>
  );
}

// Copy config for the teacher-side closures section. Split out as a
// constant so the two sections read side-by-side in the render tree.
const CLOSURES_COPY = {
  howTitle: 'adminSettings.closuresHowTitle',
  howBullets: [
    'adminSettings.closuresHow1',
    'adminSettings.closuresHow2',
    'adminSettings.closuresHow3',
  ],
  segmentTabsLabel: 'adminSettings.closuresSegmentTabsLabel',
  summaryClosed: 'adminSettings.closuresSummaryClosed',
  summaryOpen: 'adminSettings.closuresSummaryOpen',
  reopenAll: 'adminSettings.closuresReopenAll',
  groupClosed: 'adminSettings.closuresGroupClosed',
  groupOpen: 'adminSettings.closuresGroupOpen',
  emptyClosed: 'adminSettings.closuresEmptyClosed',
  cardActive: 'adminSettings.closureOn',
  cardOpen: 'adminSettings.closureOff',
} as const;

// Copy config for the student-side "not yet available" section.
const UNOPENED_COPY = {
  howTitle: 'adminSettings.unopenedHowTitle',
  howBullets: [
    'adminSettings.unopenedHow1',
    'adminSettings.unopenedHow2',
    'adminSettings.unopenedHow3',
  ],
  segmentTabsLabel: 'adminSettings.unopenedSegmentTabsLabel',
  summaryClosed: 'adminSettings.unopenedSummaryClosed',
  summaryOpen: 'adminSettings.unopenedSummaryOpen',
  reopenAll: 'adminSettings.unopenedReopenAll',
  groupClosed: 'adminSettings.unopenedGroupClosed',
  groupOpen: 'adminSettings.unopenedGroupOpen',
  emptyClosed: 'adminSettings.unopenedEmptyClosed',
  cardActive: 'adminSettings.unopenedOn',
  cardOpen: 'adminSettings.unopenedOff',
} as const;

export function AdminSettings() {
  const { t, language } = useTranslation();
  const toast = useToast();
  const { raw, reload } = useSettings();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  // Two independent draft-state pairs — one per settings field.
  // Both are saved atomically alongside the branding/contact form.
  const [menClosedSlots, setMenClosedSlots] = useState<Set<string>>(new Set());
  const [womenClosedSlots, setWomenClosedSlots] = useState<Set<string>>(new Set());
  const [menUnopenedSlots, setMenUnopenedSlots] = useState<Set<string>>(new Set());
  const [womenUnopenedSlots, setWomenUnopenedSlots] = useState<Set<string>>(new Set());
  // Children live on the STUDENT side only. Adult closures are
  // men/women just as before — children teachers aren't gated by
  // closures. The draft still ships in the payload so the API
  // always writes a uniform SegmentedSlotMap shape.
  const [childrenUnopenedSlots, setChildrenUnopenedSlots] = useState<Set<string>>(new Set());

  // Sync form state whenever SettingsContext hydrates or reloads.
  useEffect(() => {
    setForm({
      academy_name_ar:        raw.academy_name_ar ?? '',
      academy_name_en:        raw.academy_name_en ?? '',
      academy_description_ar: raw.academy_description_ar ?? '',
      academy_description_en: raw.academy_description_en ?? '',
      facebook_url:           raw.facebook_url ?? '',
      instagram_url:          raw.instagram_url ?? '',
      whatsapp_number:        raw.whatsapp_number ?? '',
      email:                  raw.email ?? '',
      complaints_telegram_username: raw.complaints_telegram_username ?? '',
    });
    setMenClosedSlots(new Set(raw.completed_slots?.men ?? []));
    setWomenClosedSlots(new Set(raw.completed_slots?.women ?? []));
    setMenUnopenedSlots(new Set(raw.unopened_slots?.men ?? []));
    setWomenUnopenedSlots(new Set(raw.unopened_slots?.women ?? []));
    setChildrenUnopenedSlots(new Set(raw.unopened_slots?.children ?? []));
  }, [raw]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const patch: Partial<SettingsMap> = {};
      for (const key of Object.keys(form) as Array<keyof FormState>) {
        // Empty strings are persisted as NULL so clearing a value in the
        // admin UI actually removes the icon/text from every consumer.
        const value = form[key].trim();
        patch[key] = value === '' ? undefined : value;
      }
      // Both segmented maps ride in the same atomic update so a single
      // save covers branding + contact + closures + unopened. Both
      // segment lists are written together on each field — the API
      // always emits the full object shape so one side is never
      // silently dropped.
      patch.completed_slots = {
        men: Array.from(menClosedSlots),
        women: Array.from(womenClosedSlots),
        // Teacher-side has no children bucket in the UI, but the
        // API expects a uniform SegmentedSlotMap. Always send [].
        children: [],
      };
      patch.unopened_slots = {
        men: Array.from(menUnopenedSlots),
        women: Array.from(womenUnopenedSlots),
        children: Array.from(childrenUnopenedSlots),
      };

      const { error } = await settingsApi.update(patch);
      if (error) {
        toast.error(t('adminSettings.saveError'));
        return;
      }
      await reload();
      toast.success(t('adminSettings.saveSuccess'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      title={t('adminSettings.title')}
      subtitle={t('adminSettings.subtitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <PageSection title={t('adminSettings.branding')}>
          <Card>
            <CardContent className="p-6 space-y-4">
              <FormField
                label={t('adminSettings.academyNameAr')}
                name="academy_name_ar"
                value={form.academy_name_ar}
                onChange={(e) => setField('academy_name_ar', e.target.value)}
              />
              <FormField
                label={t('adminSettings.academyNameEn')}
                name="academy_name_en"
                value={form.academy_name_en}
                onChange={(e) => setField('academy_name_en', e.target.value)}
              />
              <FormField
                label={t('adminSettings.descriptionAr')}
                name="academy_description_ar"
                type="textarea"
                rows={3}
                value={form.academy_description_ar}
                onChange={(e) => setField('academy_description_ar', e.target.value)}
              />
              <FormField
                label={t('adminSettings.descriptionEn')}
                name="academy_description_en"
                type="textarea"
                rows={3}
                value={form.academy_description_en}
                onChange={(e) => setField('academy_description_en', e.target.value)}
              />
            </CardContent>
          </Card>
        </PageSection>

        <PageSection title={t('adminSettings.contact')}>
          <Card>
            <CardContent className="p-6 space-y-4">
              <FormField
                label={t('adminSettings.facebookUrl')}
                name="facebook_url"
                type="url"
                placeholder="https://facebook.com/..."
                value={form.facebook_url}
                onChange={(e) => setField('facebook_url', e.target.value)}
              />
              <FormField
                label={t('adminSettings.instagramUrl')}
                name="instagram_url"
                type="url"
                placeholder="https://instagram.com/..."
                value={form.instagram_url}
                onChange={(e) => setField('instagram_url', e.target.value)}
              />
              <FormField
                label={t('adminSettings.whatsappNumber')}
                name="whatsapp_number"
                type="tel"
                placeholder="+9665..."
                value={form.whatsapp_number}
                onChange={(e) => setField('whatsapp_number', e.target.value)}
              />
              <FormField
                label={t('adminSettings.emailAddress')}
                name="email"
                type="email"
                placeholder="contact@example.com"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
              />
              <FormField
                label={t('adminSettings.complaintsTelegram')}
                name="complaints_telegram_username"
                type="text"
                placeholder="@wahdaynak_support"
                value={form.complaints_telegram_username}
                onChange={(e) =>
                  setField('complaints_telegram_username', e.target.value)
                }
              />
            </CardContent>
          </Card>
        </PageSection>

        {/* Teacher-side closures — a slot's halaqahs are FULL, so
            teacher registration disables that time. Men/women only. */}
        <SlotAvailabilitySection
          title={t('adminSettings.closuresTitle')}
          copy={CLOSURES_COPY}
          segments={[
            { key: 'women', value: womenClosedSlots, setValue: setWomenClosedSlots },
            { key: 'men', value: menClosedSlots, setValue: setMenClosedSlots },
          ]}
          language={language}
        />

        {/* Student-side gating — no halaqah exists at this slot yet,
            so student registration disables it until a teacher
            activates one. Includes the children segment, since the
            children's programme has its own set of halaqahs. */}
        <SlotAvailabilitySection
          title={t('adminSettings.unopenedTitle')}
          copy={UNOPENED_COPY}
          segments={[
            { key: 'women', value: womenUnopenedSlots, setValue: setWomenUnopenedSlots },
            { key: 'men', value: menUnopenedSlots, setValue: setMenUnopenedSlots },
            { key: 'children', value: childrenUnopenedSlots, setValue: setChildrenUnopenedSlots },
          ]}
          language={language}
        />

        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            {t('adminSettings.save')}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
}

export default AdminSettings;
