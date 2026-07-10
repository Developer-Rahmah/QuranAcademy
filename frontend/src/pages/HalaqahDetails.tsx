import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useHalaqah } from '../hooks/useHalaqah';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { db, api } from '../lib/supabase';
import type { HalaqahSupervisorWithProfile } from '../lib/supabase/api/supervisors';
import { DashboardLayout, PageSection } from '../components/templates/DashboardLayout';
import { Card } from '../components/molecules/Card';
import { StatCard, StatCardRow } from '../components/molecules/StatCard';
import { MeetLinkCard } from '../components/molecules/MeetLinkCard';
import { ClosedSlotBadge } from '../components/molecules/ClosedSlotBadge';
import { StudentTable } from '../components/organisms/StudentTable';
import { HalaqahForm } from '../components/organisms/HalaqahForm';
import { StudentAssignment } from '../components/organisms/StudentAssignment';
import { ProgressBar } from '../components/atoms/ProgressBar';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { ChartIcon, UsersIcon, SaveIcon, PlusIcon, TrashIcon } from '../components/atoms/Icon';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';
import { PaginatedList } from '../components/molecules/Pagination';
import { ROUTES } from '../lib/routes';
import { useTranslation } from '../locales/i18n';
import { getDisplayName } from '../lib/utils';
import { TIME_SLOTS, TOTAL_QURAN_PAGES } from '../lib/constants';
import { formatSlotRange } from '../lib/time';
import { readSlotFromSchedule } from '../lib/autoHalaqah';
import { Select } from '../components/atoms/Select';
import { segmentationRules } from '../lib/segmentationRules';
import { uiText } from '../lib/uiText';
import {
  canManageHalaqah,
  canManageSupervisors,
  canContactStudents,
  canManageStudentActivation,
} from '../lib/permissions';
import type { AccountStatus, Halaqah, StudentWithProgress } from '../types';

interface HalaqahStats {
  totalMemorization: number;
  avgMemorization: number;
  avgProgress: number;
}

/**
 * Halaqah Details Page - Shows detailed info about a halaqah
 */
export function HalaqahDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();

  // Auth-vs-profile id integrity check. The supervisor APIs use
  // profile.id everywhere; if the auth user id ever diverges from the
  // profile id, RLS checks (which run against auth.uid()) and our
  // queries will disagree. Log loudly so the diff is visible.
  useEffect(() => {
    if (user?.id && profile?.id && user.id !== profile.id) {
      console.error('ID MISMATCH (HalaqahDetails)', {
        authId: user.id,
        profileId: profile.id,
      });
    }
  }, [user?.id, profile?.id]);
  // Centralized capability checks — see lib/permissions.ts. admin and
  // supervisor_manager both manage halaqahs (CRUD + students + assigning
  // halaqah supervisors). Other roles never see the management UI.
  const canManage = canManageHalaqah(profile?.role);
  const canManageSupervisorList = canManageSupervisors(profile?.role);
  const { halaqah, members, loading: loadingHalaqah, refetch } = useHalaqah(id);

  const [students, setStudents] = useState<StudentWithProgress[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [activationLoadingId, setActivationLoadingId] = useState<string | null>(null);

  // Toggle a student's account status. The next status flips between
  // 'active' (when previously suspended/pending) and 'suspended' (when
  // currently active). Backend authorization runs in the RPC — we
  // surface its error verbatim so RLS denials show up in the toast
  // instead of being swallowed.
  const handleToggleActivation = async (student: StudentWithProgress) => {
    const next: AccountStatus =
      student.status === 'active' ? 'suspended' : 'active';
    setActivationLoadingId(student.id);
    try {
      const { error } = await api.profiles.setStudentStatus(student.id, next);
      if (error) {
        toast.error(error.message || t('errors.unauthorized'));
        return;
      }
      toast.success(
        next === 'active' ? t('admin.studentActivated') : t('admin.studentSuspended'),
      );
      // Re-pull members so the row's new status reflects in the UI
      // without us having to mirror it locally.
      refetch?.();
      // Self-suspend: refresh own profile so AuthProvider's
      // active-status guard fires immediately and signs the suspending
      // user out. Without this they'd retain a stale 'active' profile
      // until the next visibility change.
      if (student.id === profile?.id && next !== 'active') {
        await refreshProfile();
      }
    } finally {
      setActivationLoadingId(null);
    }
  };
  const [halaqahStats, setHalaqahStats] = useState<HalaqahStats>({
    totalMemorization: 0,
    avgMemorization: 0,
    avgProgress: 0,
  });
  const [showEditForm, setShowEditForm] = useState(false);
  const [showStudentAssignment, setShowStudentAssignment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingHalaqah, setDeletingHalaqah] = useState(false);

  // Backfill state for legacy/manual halaqahs that were saved without
  // a canonical `schedule.slot`. The banner below surfaces the gap
  // and lets the admin pick a slot inline; saving writes it via
  // `db.halaqahs.update` and the matcher immediately starts including
  // this halaqah in auto-assignment.
  const [draftSlot, setDraftSlot] = useState('');
  const [savingSlot, setSavingSlot] = useState(false);
  const currentSlot = halaqah ? readSlotFromSchedule(halaqah.schedule) : null;

  const handleSaveSlot = async () => {
    if (!halaqah?.id || !draftSlot) return;
    setSavingSlot(true);
    try {
      const { error } = await db.halaqahs.update(halaqah.id, {
        // Cast: `schedule` lives in the row's jsonb and the typed
        // facade narrows to `Halaqah['schedule']` which is
        // intentionally loose. The matcher reads back `{ slot }`.
        schedule: { slot: draftSlot } as unknown as Halaqah['schedule'],
      });
      if (error) {
        console.error('Failed to save slot:', error);
        toast.error(t('errors.generic'));
        return;
      }
      toast.success(t('admin.slotSaved'));
      setDraftSlot('');
      await refetch?.();
    } finally {
      setSavingSlot(false);
    }
  };

  // Delete the halaqah. CASCADE on halaqahs.id covers halaqah_members,
  // halaqah_supervisors, and reports — see migration 0001. On success
  // we navigate back to the admin dashboard since this very URL would
  // 404 the next time anyway. RLS still enforces who can run the
  // delete server-side; the UI button is gated by `canManage`.
  const handleDeleteHalaqah = async () => {
    if (!id) return;
    setDeletingHalaqah(true);
    try {
      const { error } = await db.halaqahs.delete(id);
      if (error) {
        console.error('Error deleting halaqah:', error);
        toast.error(t('admin.halaqahDeleteFailed'));
        return;
      }
      toast.success(t('admin.halaqahDeleted'));
      setShowDeleteConfirm(false);
      navigate(ROUTES.admin);
    } finally {
      setDeletingHalaqah(false);
    }
  };

  // Supervisor assignments for this halaqah. The set of `user_id`s drives
  // the per-student "Assign / Remove" toggle.
  const [supervisors, setSupervisors] = useState<HalaqahSupervisorWithProfile[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [supervisorActionId, setSupervisorActionId] = useState<string | null>(null);
  // Search queries for the two supervisor lists rendered further down:
  // the read-only assigned list, and the per-student management picker.
  const [supervisorSearch, setSupervisorSearch] = useState('');
  const [manageSupervisorSearch, setManageSupervisorSearch] = useState('');

  const fetchSupervisors = useCallback(async () => {
    if (!id) return;
    setLoadingSupervisors(true);
    const { data, error } = await api.supervisors.listByHalaqah(id);
    if (!error) setSupervisors(data ?? []);
    setLoadingSupervisors(false);
  }, [id]);

  useEffect(() => {
    void fetchSupervisors();
  }, [fetchSupervisors]);

  // O(1) lookup: is this user already a supervisor of this halaqah?
  const supervisorIds = new Set(supervisors.map((s) => s.user_id));

  // Activation toggle gate.
  //
  // Visible to admin / supervisor_manager / teacher / halaqah_supervisor.
  // The role check covers single-role accounts; the relational
  // `isSupervisor` flag covers the dual-role case (profile.role =
  // 'student' + a row in halaqah_supervisors for THIS halaqah). Without
  // the relational signal, dual-role supervisors land on this page with
  // no activation buttons even though the backend RPC would accept the
  // mutation. Backend RPC re-checks per-student scope so the UI doesn't
  // need to be more conservative than this.
  const isSupervisorOfThisHalaqah =
    !!profile?.id && supervisorIds.has(profile.id);
  const canActivate = canManageStudentActivation(profile?.role, {
    isSupervisor: isSupervisorOfThisHalaqah,
  });

  // Membership lookup: only students currently in this halaqah are
  // eligible for supervisor assignment (per spec).
  const memberIds = new Set((members ?? []).map((m) => m.student_id));

  const handleAssign = async (userId: string) => {
    if (!id) return;
    if (!userId) {
      console.error('handleAssign called without userId');
      toast.error(t('admin.supervisorAssignFailed'));
      return;
    }
    setSupervisorActionId(userId);
    try {
      // assign() throws on failure (RLS denial, network, etc.) so we can
      // surface the real underlying message rather than a generic toast.
      // The userId here is the *target* profile.id of the student being
      // promoted — sourced from `member.student_id` (which is a FK to
      // profiles.id), so the value going into halaqah_supervisors.user_id
      // is always a profile id, never an auth-only id.
      await api.supervisors.assign(userId, id);
      toast.success(t('admin.supervisorAssigned'));
      await fetchSupervisors();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : t('admin.supervisorAssignFailed');
      console.error('handleAssign failed', err);
      toast.error(message);
    } finally {
      setSupervisorActionId(null);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!id) return;
    if (!userId) {
      console.error('handleRemove called without userId');
      toast.error(t('admin.supervisorRemoveFailed'));
      return;
    }
    setSupervisorActionId(userId);
    const { error } = await api.supervisors.remove(userId, id);
    setSupervisorActionId(null);
    if (error) {
      toast.error(t('admin.supervisorRemoveFailed'));
      return;
    }
    toast.success(t('admin.supervisorRemoved'));
    await fetchSupervisors();
  };

  // Fetch student progress data
  useEffect(() => {
    const fetchStudentProgress = async () => {
      if (!members || members.length === 0) {
        setStudents([]);
        setLoadingStudents(false);
        return;
      }

      setLoadingStudents(true);

      try {
        let totalMem = 0;

        const studentData = await Promise.all(
          members.map(async (member) => {
            const { data: progressData } = await db.stats.getStudentProgress(
              member.student_id
            );

            const memPages = progressData?.memorization || 0;
            totalMem += memPages;

            return {
              id: member.student_id,
              first_name: member.student?.first_name ?? '',
              second_name: member.student?.second_name ?? '',
              // third_name + status come from the joined select in
              // members.byHalaqah (now includes both). Fall through
              // gracefully for older shapes that omit them.
              third_name: member.student?.third_name,
              phone: member.student?.phone,
              email: member.student?.email,
              status: member.student?.status,
              memorizationPages: memPages,
              reviewPages: progressData?.review || 0,
              progress: progressData?.progress || 0,
            } as StudentWithProgress;
          })
        );

        setStudents(studentData);

        // Calculate halaqah stats
        const avgMem = studentData.length > 0 ? totalMem / studentData.length : 0;
        const avgProg = Math.round((avgMem / TOTAL_QURAN_PAGES) * 100);

        setHalaqahStats({
          totalMemorization: Math.round(totalMem),
          avgMemorization: Math.round(avgMem),
          avgProgress: avgProg,
        });
      } catch (error) {
        console.error('Error fetching student progress:', error);
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudentProgress();
  }, [members]);

  const isLoading = loadingHalaqah;

  // Single derivation point for every gendered string on this page.
  // Driven entirely by the halaqah's segment — never a hardcoded fallback.
  const ui = segmentationRules.getGenderedUI({
    role: 'teacher',
    segment: halaqah?.segment,
  });

  if (isLoading) {
    return (
      <DashboardLayout title={t(ui.halaqahLabel)}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!halaqah) {
    return (
      <DashboardLayout title={t(ui.halaqahLabel)}>
        <Card padding="lg">
          <p className="text-center text-muted py-8">الحلقة غير موجودة</p>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="تفاصيل الحلقة"
      subtitle="معلومات شاملة عن أداء الحلقة"
    >
      <div className="space-y-8">
        {/* Admin Actions */}
        {canManage && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setShowEditForm(true)} variant="outline">
              {t('admin.editHalaqah')}
            </Button>
            <Button onClick={() => setShowStudentAssignment(true)}>
              <PlusIcon className="w-4 h-4" />
              {t(uiText.getManageStudentsLabel(halaqah?.segment))}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <TrashIcon className="w-4 h-4" />
              {t('admin.deleteHalaqah')}
            </Button>
          </div>
        )}

        {/* Backfill banner for legacy/manual halaqahs whose
            `schedule.slot` is empty. Auto-assignment skips these
            silently — surfacing the gap with an inline picker lets
            the admin fix it in one click without leaving the page.
            Hidden once the halaqah has a slot OR when the viewer
            can't manage halaqahs anyway. */}
        {canManage && !currentSlot && (
          <Card padding="md" variant="bordered" className="border-warning/40 bg-warning/5">
            <h3 className="text-base font-semibold text-foreground mb-1">
              {t('admin.missingTimeSlotTitle')}
            </h3>
            <p className="text-sm text-muted mb-3">
              {t('admin.missingTimeSlotBody')}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <Select
                  value={draftSlot}
                  onChange={(e) => setDraftSlot(e.target.value)}
                  options={[
                    { value: '', label: t('admin.timeSlotNone') },
                    ...TIME_SLOTS.map((s) => ({
                      value: s.id,
                      label: formatSlotRange(s.id, 'ar'),
                    })),
                  ]}
                />
              </div>
              <Button
                onClick={handleSaveSlot}
                loading={savingSlot}
                disabled={!draftSlot}
              >
                {t('admin.saveSlot')}
              </Button>
            </div>
          </Card>
        )}

        {/* Halaqah Info */}
        <Card padding="md" variant="bordered">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="text-center md:text-right">
              <p className="text-sm text-muted mb-1">{t('halaqah.halaqahName')}</p>
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
                <p className="text-lg font-medium text-foreground">
                  {halaqah.name}
                </p>
                <ClosedSlotBadge
                  schedule={halaqah.schedule}
                  segment={halaqah.segment}
                  size="md"
                />
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm text-muted mb-1">{t('halaqah.teacherName')}</p>
              <p className="text-lg font-medium text-foreground">
                {halaqah.teacher
                  ? `${getDisplayName(halaqah.teacher)}`
                  : t('halaqah.notAssigned')}
              </p>
            </div>
          </div>

          {/* Google Meet Link */}
          <MeetLinkCard link={halaqah.meet_link} />
        </Card>

        {/* Progress Card */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted">{t('halaqah.totalProgress')}</span>
            <ChartIcon className="w-5 h-5 text-primary" />
          </div>
          <ProgressBar value={halaqahStats.avgProgress} size="lg" showLabel />
          <p className="text-sm text-muted mt-2 text-center">
            {t('halaqah.avgMemorizationPer')} {halaqahStats.avgMemorization}{' '}
            {t(`halaqah.pagesPerStudent${ui.pronoun === 'male' ? 'Male' : ui.pronoun === 'female' ? 'Female' : 'Neutral'}`)}
          </p>
        </Card>

        {/* Statistics — titles and units come from the rule engine */}
        <StatCardRow>
          <StatCard
            title={t('halaqah.totalMemorizedPages')}
            value={halaqahStats.totalMemorization}
            icon={SaveIcon}
            subtitle={t('halaqah.pageUnit')}
            variant="primary"
          />
          <StatCard
            title={t(
              `halaqah.avgMemorizationPerStudent${
                ui.pronoun === 'male' ? 'Male' : ui.pronoun === 'female' ? 'Female' : 'Neutral'
              }`,
            )}
            value={halaqahStats.avgMemorization}
            icon={ChartIcon}
            subtitle={t('halaqah.pageUnit')}
          />
          <StatCard
            title={t(
              `halaqah.studentsCount${
                ui.pronoun === 'male' ? 'Male' : ui.pronoun === 'female' ? 'Female' : 'Neutral'
              }`,
            )}
            value={students.length}
            icon={UsersIcon}
          />
        </StatCardRow>

        {/* Students Table */}
        <PageSection
          title={`${t(uiText.getStudentLabel(halaqah?.segment, 'plural'))} (${students.length})`}
        >
          <StudentTable
            students={students}
            loading={loadingStudents}
            showReportsButton={false}
            segment={halaqah?.segment}
            showContact={canContactStudents(profile?.role, {
              isSupervisor: isSupervisorOfThisHalaqah,
            })}
            showActivation={canActivate}
            activationLoadingId={activationLoadingId}
            onToggleActivation={handleToggleActivation}
          />
        </PageSection>

        {/* Halaqah supervisors — read-only list, visible to everyone with
            access to the halaqah details. */}
        <PageSection
          title={`${t('admin.halaqahSupervisorsList')} (${supervisors.length})`}
        >
          <Card padding="md">
            {loadingSupervisors ? (
              <p className="text-sm text-muted">{t('common.loading')}</p>
            ) : supervisors.length === 0 ? (
              <p className="text-sm text-muted">
                {t('admin.noSupervisorsAssigned')}
              </p>
            ) : (() => {
              const q = supervisorSearch.trim().toLowerCase();
              const filteredSupervisors = q
                ? supervisors.filter((s) => {
                    const name = s.user ? getDisplayName(s.user).toLowerCase() : '';
                    const email = (s.user?.email || '').toLowerCase();
                    const phone = (s.user?.phone || '').toLowerCase();
                    return (
                      name.includes(q) ||
                      email.includes(q) ||
                      phone.includes(q)
                    );
                  })
                : supervisors;
              return (
                <>
                  <div className="mb-3">
                    <Input
                      type="text"
                      value={supervisorSearch}
                      onChange={(e) => setSupervisorSearch(e.target.value)}
                      placeholder={t('common.search')}
                    />
                  </div>
                  {filteredSupervisors.length === 0 ? (
                    <p className="text-sm text-muted">
                      {t('admin.noSearchResults')}
                    </p>
                  ) : (
                    <PaginatedList items={filteredSupervisors}>
                      {(pageItems) => (
                        <ul className="divide-y divide-border">
                          {pageItems.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between py-3"
                            >
                              <div>
                                <p className="text-base text-foreground">
                                  {s.user
                                    ? getDisplayName(s.user)
                                    : s.user_id}
                                </p>
                                {s.user?.email && (
                                  <p className="text-sm text-muted">{s.user.email}</p>
                                )}
                              </div>
                              {canManageSupervisorList && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRemove(s.user_id)}
                                  loading={supervisorActionId === s.user_id}
                                >
                                  {t('admin.removeSupervisor')}
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </PaginatedList>
                  )}
                </>
              );
            })()}
          </Card>
        </PageSection>

        {/* Manage supervisors — admin/supervisor_manager only. Each row
            is a member of THIS halaqah, with a single toggle button. */}
        {canManageSupervisorList && (() => {
          const q = manageSupervisorSearch.trim().toLowerCase();
          const filteredManageStudents = q
            ? students.filter((s) => {
                const name = getDisplayName(s).toLowerCase();
                const email = (s.email || '').toLowerCase();
                const phone = (s.phone || '').toLowerCase();
                return name.includes(q) || email.includes(q) || phone.includes(q);
              })
            : students;
          return (
          <PageSection title={t('admin.manageSupervisors')}>
            <Card padding="md">
              {students.length === 0 ? (
                <p className="text-sm text-muted">
                  {t(uiText.getEmptyStateText('student', halaqah?.segment))}
                </p>
              ) : (
                <>
                <div className="mb-3">
                  <Input
                    type="text"
                    value={manageSupervisorSearch}
                    onChange={(e) => setManageSupervisorSearch(e.target.value)}
                    placeholder={t('common.search')}
                  />
                </div>
                {filteredManageStudents.length === 0 ? (
                  <p className="text-sm text-muted">{t('admin.noSearchResults')}</p>
                ) : (
                  <PaginatedList items={filteredManageStudents}>
                    {(pageItems) => (
                      <ul className="divide-y divide-border">
                        {pageItems.map((student) => {
                          const isSupervisor = supervisorIds.has(student.id);
                          const isMember = memberIds.has(student.id);
                          return (
                            <li
                              key={student.id}
                              className="flex items-center justify-between py-3"
                            >
                              <span className="text-base text-foreground">
                                {getDisplayName(student)}
                              </span>
                              {isSupervisor ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRemove(student.id)}
                                  loading={supervisorActionId === student.id}
                                >
                                  {t('admin.removeSupervisor')}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleAssign(student.id)}
                                  loading={supervisorActionId === student.id}
                                  disabled={!isMember}
                                  title={
                                    !isMember
                                      ? t('admin.studentNotInHalaqah')
                                      : undefined
                                  }
                                >
                                  {t('admin.assignAsSupervisor')}
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </PaginatedList>
                )}
                </>
              )}
            </Card>
          </PageSection>
          );
        })()}
      </div>

      {/* Edit Halaqah Modal */}
      {canManage && (
        <>
          <HalaqahForm
            halaqah={halaqah}
            isOpen={showEditForm}
            onClose={() => setShowEditForm(false)}
            onSuccess={() => refetch?.()}
          />
          <StudentAssignment
            halaqahId={halaqah.id}
            halaqahName={halaqah.name}
            halaqah={halaqah}
            isOpen={showStudentAssignment}
            onClose={() => setShowStudentAssignment(false)}
            // Refetch BOTH members and supervisors. Removing a student
            // who is also a halaqah supervisor cascades through both
            // tables (see StudentAssignment.removeStudent), so the page
            // must re-derive both lists or the supervisors panel will
            // render a stale badge for a now-removed student.
            onSuccess={() => {
              refetch?.();
              void fetchSupervisors();
            }}
          />
          <ConfirmDialog
            isOpen={showDeleteConfirm}
            onClose={() => {
              if (!deletingHalaqah) setShowDeleteConfirm(false);
            }}
            onConfirm={handleDeleteHalaqah}
            title={t('admin.confirmDeleteHalaqahTitle')}
            body={t('admin.confirmDeleteHalaqahBody')}
            confirmLabel={t('admin.deleteHalaqah')}
            loading={deletingHalaqah}
          />
        </>
      )}
    </DashboardLayout>
  );
}

export default HalaqahDetails;
