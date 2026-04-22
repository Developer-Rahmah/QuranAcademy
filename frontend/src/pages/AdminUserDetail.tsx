/**
 * AdminUserDetail — /admin/users/:id
 *
 * Read-only deep view of any non-admin profile. Branches on role:
 *   - student → current halaqah + progress + recent reports
 *   - teacher → assigned halaqahs + certification + recitations
 *
 * Reuses the existing api modules (no new Supabase queries). All UI comes
 * from atoms/molecules/organisms already in the design system.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DashboardLayout, PageSection } from '../components/templates/DashboardLayout';
import { Card, CardContent } from '../components/molecules/Card';
import { StatusBadge, Badge } from '../components/atoms/Badge';
import { Button } from '../components/atoms/Button';
import { ProgressBar } from '../components/atoms/ProgressBar';
import { api } from '../lib/supabase';
import { useTranslation } from '../locales/i18n';
import { ROUTES } from '../lib/routes';
import { TOTAL_QURAN_PAGES, ACADEMY_TIMEZONE } from '../lib/constants';
import { findCountryByIso } from '../lib/countries';
import { getDisplayName } from '../lib/utils';
import { segmentationRules } from '../lib/segmentationRules';
import type {
  Profile,
  HalaqahMember,
  Halaqah,
  Report,
  ProgressStats,
} from '../types';

// ============================================
// Styles
// ============================================
const styles = {
  header: 'flex items-start justify-between mb-8 flex-wrap gap-4',
  identityCard: 'flex items-center gap-4 p-6 bg-card rounded-2xl border border-border shadow-sm flex-1 min-w-[280px]',
  avatar: 'w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-semibold flex-shrink-0',
  identityName: 'text-xl font-semibold text-foreground',
  identityEmail: 'text-base text-muted',
  chips: 'flex flex-wrap items-center gap-2 mt-2',
  grid: 'grid grid-cols-1 md:grid-cols-2 gap-6',
  row: 'flex items-center justify-between py-3 border-b border-border/50 last:border-0',
  rowLabel: 'text-base text-muted',
  rowValue: 'text-base text-foreground font-medium',
  spinner: 'animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto',
  loadingWrap: 'flex items-center justify-center py-12',
  empty: 'text-center text-muted text-base py-4',
  chipRow: 'flex flex-wrap gap-2',
  reportRow: 'flex items-center justify-between py-3 text-base border-b border-border/50 last:border-0',
};

// ============================================
// Helpers
// ============================================
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}

function SegmentLabel({ segment, t }: { segment?: string; t: (k: string) => string }) {
  if (!segment) return <span>-</span>;
  const key = segment === 'non_arab_speakers' ? 'nonArabSpeakers' : segment;
  return <>{t(`segment.${key}`)}</>;
}

/**
 * Language-type display. Reads ONLY from the canonical `language_type`
 * column. We deliberately DO NOT default NULL to 'arabic_speaker' here —
 * that would hide data-flow bugs where registration failed to persist the
 * value. NULL now renders as a translated "Not specified" marker so it's
 * visually distinct from a confirmed Arabic speaker.
 */
function languageTypeKey(profile: { language_type?: string | null }): string | null {
  const v = profile.language_type;
  if (v === 'arabic_speaker') return 'registration.arabicSpeaker';
  if (v === 'non_arabic_speaker') return 'registration.nonArabicSpeaker';
  return null;
}

/**
 * Resolve an ISO-2 country code stored on the profile (e.g. "JO") to its
 * human-readable name via lib/countries. Falls through to the raw value if
 * the code isn't in our table, so no data ever disappears from the UI.
 */
function countryDisplay(raw: string | null | undefined): string {
  if (!raw) return '-';
  const found = findCountryByIso(raw);
  return found?.name ?? raw;
}

/**
 * Render a profile's `available_times` list as human-friendly 24h labels,
 * always annotated with the academy's Mecca timezone.
 *
 * Slot ids follow the `HH-HH` pattern produced by `TIME_SLOTS` (e.g. "09-10").
 * The backend can also hand back an object-shaped schedule keyed by day; we
 * just flatten it into one list of labels for display.
 */
function AvailableTimesList({
  profile,
  t,
}: {
  profile: { available_times?: unknown };
  t: (k: string) => string;
}) {
  const raw = profile.available_times;
  const slots: string[] = Array.isArray(raw)
    ? (raw as unknown[]).filter((s): s is string => typeof s === 'string')
    : raw && typeof raw === 'object'
    ? Object.values(raw as Record<string, unknown>)
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .filter((v): v is string => typeof v === 'string')
    : [];

  if (slots.length === 0) {
    return <p className={styles.empty}>{t('userDetail.noAvailableTimes')}</p>;
  }

  const formatSlot = (id: string): string => {
    // Expected form: "HH-HH". Anything else renders verbatim.
    const m = id.match(/^(\d{1,2})-(\d{1,2})$/);
    if (!m) return id;
    const start = m[1].padStart(2, '0');
    const end = m[2].padStart(2, '0');
    return `${start}:00 - ${end}:00`;
  };

  return (
    <div>
      <ul className={styles.chipRow}>
        {slots.map((s) => (
          <Badge key={s} variant="secondary">
            {formatSlot(s)}
          </Badge>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted">{ACADEMY_TIMEZONE} · Mecca time</p>
    </div>
  );
}

// ============================================
// Component
// ============================================
export function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Student-specific
  const [membership, setMembership] = useState<HalaqahMember | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [progress, setProgress] = useState<ProgressStats | null>(null);

  // Teacher-specific
  const [halaqahs, setHalaqahs] = useState<Halaqah[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const { data: p } = await api.profiles.getById(id);
      if (cancelled) return;
      setProfile(p);
      if (!p) {
        setLoading(false);
        return;
      }

      if (p.role === 'student') {
        const [m, r, pr] = await Promise.all([
          api.halaqah.members.forStudent(p.id),
          api.reports.byStudent(p.id, 20),
          api.reports.stats.studentProgress(p.id),
        ]);
        if (cancelled) return;
        setMembership(m.data);
        setReports(r.data ?? []);
        setProgress(pr.data);
      } else if (p.role === 'teacher') {
        const { data } = await api.halaqah.list({ teacherId: p.id });
        if (cancelled) return;
        setHalaqahs(data ?? []);
      }
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ----- Loading / missing -----
  if (loading) {
    return (
      <DashboardLayout title={t('userDetail.title')}>
        <div className={styles.loadingWrap}>
          <div className={styles.spinner} />
        </div>
      </DashboardLayout>
    );
  }
  if (!profile) {
    return (
      <DashboardLayout title={t('userDetail.title')}>
        <Card>
          <CardContent className="p-6 text-center text-muted">
            {t('common.noData')}
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const isStudent = profile.role === 'student';
  const isTeacher = profile.role === 'teacher';
  const recitations = profile.authorized_recitations ?? [];
  const initials =
    `${profile.first_name?.[0] ?? ''}${profile.second_name?.[0] ?? ''}`.trim() || '?';

  return (
    <DashboardLayout title={t('userDetail.title')} subtitle={profile.email}>
      <div className={styles.header}>
        <div className={styles.identityCard}>
          <div className={styles.avatar} aria-hidden="true">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className={styles.identityName}>{getDisplayName(profile)}</p>
            <p className={styles.identityEmail}>{profile.email}</p>
            <div className={styles.chips}>
              <Badge variant={isTeacher ? 'primary' : 'secondary'}>
                {t(segmentationRules.getUserRoleLabel(profile))}
              </Badge>
              {profile.segment && (
                <Badge variant="outline">
                  <SegmentLabel segment={profile.segment} t={t} />
                </Badge>
              )}
              <StatusBadge status={profile.status} />
            </div>
          </div>
        </div>
        <Link to={ROUTES.adminUsers} className="self-start">
          <Button variant="outline" size="sm">
            {t('userDetail.backToList')}
          </Button>
        </Link>
      </div>

      {/* ---------- Personal + Contact (side-by-side on wide screens) --- */}
      <div className={styles.grid}>
        <PageSection title={t('userDetail.personalInfo')}>
          <Card>
            <CardContent className="p-6">
              <InfoRow label={t('registration.firstName')} value={profile.first_name || '-'} />
              <InfoRow label={t('registration.secondName')} value={profile.second_name || '-'} />
              <InfoRow label={t('registration.thirdName')} value={profile.third_name || '-'} />
              <InfoRow label={t('registration.age')} value={profile.age ?? '-'} />
              <InfoRow
                label={t('segment.label')}
                value={<SegmentLabel segment={profile.segment} t={t} />}
              />
              {/* Language row — supports both the new boolean and any
                  legacy string column like `language_type`. */}
              <InfoRow
                label={t('userDetail.languageType')}
                value={(() => {
                  const key = languageTypeKey(profile);
                  return key ? t(key) : t('userDetail.languageNotSpecified');
                })()}
              />
            </CardContent>
          </Card>
        </PageSection>

        <PageSection title={t('userDetail.contactInfo')}>
          <Card>
            <CardContent className="p-6">
              <InfoRow label={t('auth.email')} value={profile.email} />
              <InfoRow label={t('registration.phone')} value={profile.phone || '-'} />
              {/* ISO-2 → human name, with raw-value fallback. */}
              <InfoRow
                label={t('registration.country')}
                value={countryDisplay(profile.country)}
              />
            </CardContent>
          </Card>
        </PageSection>
      </div>

      {/* ---------- Available times (both roles) ---------- */}
      <PageSection title={t('userDetail.availableTimes')}>
        <Card>
          <CardContent className="p-6">
            <AvailableTimesList profile={profile} t={t} />
          </CardContent>
        </Card>
      </PageSection>

      {/* ---------- Student view ---------- */}
      {isStudent && (
        <>
          <PageSection title={t('userDetail.halaqahInfo')}>
            <Card>
              <CardContent className="p-6">
                {membership?.halaqah ? (
                  <>
                    <InfoRow label={t('halaqah.halaqahName')} value={membership.halaqah.name} />
                    <InfoRow
                      label={t('halaqah.teacherName')}
                      value={
                        membership.halaqah.teacher
                          ? `${membership.halaqah.teacher.first_name} ${membership.halaqah.teacher.second_name}`
                          : t('userDetail.notAssigned')
                      }
                    />
                    <InfoRow
                      label={t('recitation.currentRecitation')}
                      value={profile.recitation || '-'}
                    />
                  </>
                ) : (
                  <p className={styles.empty}>{t('userDetail.notAssigned')}</p>
                )}
              </CardContent>
            </Card>
          </PageSection>

          {progress && (
            <PageSection title={t('progress.summary')}>
              <Card>
                <CardContent className="p-6 space-y-3">
                  <InfoRow
                    label={t('progress.memorizationPages')}
                    value={`${progress.memorization} / ${TOTAL_QURAN_PAGES}`}
                  />
                  <InfoRow
                    label={t('progress.reviewPages')}
                    value={progress.review}
                  />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className={styles.rowLabel}>{t('progress.totalProgress')}</span>
                      <span className={styles.rowValue}>{progress.progress}%</span>
                    </div>
                    <ProgressBar value={progress.progress} size="sm" />
                  </div>
                </CardContent>
              </Card>
            </PageSection>
          )}

          <PageSection title={t('userDetail.reports')}>
            <Card>
              <CardContent className="p-6">
                {reports.length === 0 ? (
                  <p className={styles.empty}>{t('userDetail.noReports')}</p>
                ) : (
                  reports.map((r) => (
                    <div key={r.id} className={styles.reportRow}>
                      <span className="text-muted">{r.report_date}</span>
                      <span className="text-foreground">
                        {(r.items ?? []).length} {t('common.total')}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </PageSection>
        </>
      )}

      {/* ---------- Teacher view ---------- */}
      {isTeacher && (
        <>
          <PageSection title={t('userDetail.academicInfo')}>
            <Card>
              <CardContent className="p-6">
                <InfoRow
                  label={t('userDetail.certified')}
                  value={
                    profile.is_certified ? t('common.yes') : t('common.no')
                  }
                />
                <InfoRow
                  label={t('userDetail.quranPartsTaught')}
                  value={profile.quran_parts_taught ?? '-'}
                />
                <InfoRow
                  label={t('registration.teachingExperience')}
                  value={profile.teaching_experience || '-'}
                />
                <div className={styles.row}>
                  <span className={styles.rowLabel}>
                    {t('recitation.authorizedIn')}
                  </span>
                  <div className={styles.chipRow}>
                    {recitations.length === 0 ? (
                      <span className={styles.rowValue}>-</span>
                    ) : (
                      recitations.map((r) => (
                        <Badge key={r} variant="secondary">
                          {r}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </PageSection>

          <PageSection title={t('userDetail.assignedHalaqahs')}>
            <Card>
              <CardContent className="p-6">
                {halaqahs.length === 0 ? (
                  <p className={styles.empty}>{t('userDetail.noHalaqahs')}</p>
                ) : (
                  halaqahs.map((h) => (
                    <Link
                      key={h.id}
                      to={`/halaqah/${h.id}`}
                      className="block hover:bg-muted/30 rounded-md"
                    >
                      <div className={styles.row}>
                        <span className={styles.rowValue}>{h.name}</span>
                        <StatusBadge status={h.status} />
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </PageSection>
        </>
      )}
    </DashboardLayout>
  );
}

export default AdminUserDetail;
