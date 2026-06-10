/**
 * ReportForm Component
 * Form for submitting OR editing daily memorization/review reports.
 *
 * Two modes, single component:
 *   - create (default): no `report` prop, builds a fresh row.
 *   - edit:             pass `report`, fields pre-fill, submit
 *                       patches the row + replaces its items.
 *
 * Reusing one form keeps validation, item layout, surah catalog, and
 * date-cap rules in lockstep between the two flows.
 */
import { useState, useMemo, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../locales/i18n';
import { useCreateReport, useUpdateReport } from '../../../hooks/useReports';
import { useStudentHalaqah } from '../../../hooks/useHalaqah';
import { Button } from '../../atoms/Button';
import { Select } from '../../atoms/Select';
import { Input } from '../../atoms/Input';
import { Card, CardContent } from '../../molecules/Card';
import { ShareReportDialog } from '../../molecules/ShareReportDialog';
import { PlusIcon, SaveIcon, RefreshIcon, WhatsappIcon } from '../../atoms/Icon';
import { SURAHS, REPORT_TYPES, MIN_PAGES } from '../../../lib/constants';
import {
  cn,
  getDisplayName,
  getTodayLocalDate,
  validatePages,
  generateId,
} from '../../../lib/utils';
import { getErrorMessage } from '../../../lib/errorHandler';
import {
  formatReportForSharing,
  shareReportViaWhatsapp,
} from '../../../lib/reportSharing';
import { reportFormStyles } from './ReportForm.style';
import type { ReportItem, FormErrors, ReportFormProps } from './ReportForm.types';
import type { ReportType, ReportItem as DomainReportItem } from '../../../types';

// ============================================
// Helpers
// ============================================
function toFormItems(items: DomainReportItem[] | undefined, type: ReportType): ReportItem[] {
  return (items ?? [])
    .filter((it) => it.type === type)
    .map((it) => ({
      id: generateId(),
      surah_name: it.surah_name,
      pages: String(it.pages),
    }));
}

// ============================================
// ReportForm Component
// ============================================
export function ReportForm({ className, report = null }: ReportFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const { academyName } = useSettings();
  const { membership, loading: loadingHalaqah } = useStudentHalaqah(profile?.id);
  const { createReport, loading: creating } = useCreateReport();
  const { updateReport, loading: updating } = useUpdateReport();

  const isEditMode = !!report;
  const submitting = creating || updating;

  // Share-preview dialog state. The dialog opens AFTER validation
  // succeeds but BEFORE the save lands; clicking Send inside the
  // dialog runs the atomic save-then-share flow.
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDraftText, setShareDraftText] = useState('');
  const [sharing, setSharing] = useState(false);

  // Form state.
  //
  // Default `reportDate` is TODAY in the user's LOCAL timezone — read
  // via `getTodayLocalDate()`, which builds the YYYY-MM-DD string from
  // `getFullYear / getMonth / getDate` so users in positive UTC offsets
  // (KSA UTC+3) don't see tomorrow when filing late at night.
  //
  // A previous attempt fixed the off-by-one by adding +1 day to
  // `new Date()` — that masked a UTC shift in `formatDateISO`. Once
  // `formatDateISO` was switched to local components the +1 hack began
  // rendering tomorrow. The hack is gone; this is the canonical source.
  const today = getTodayLocalDate();

  const initialMemorization = useMemo(
    () =>
      isEditMode
        ? toFormItems(report?.items, REPORT_TYPES.MEMORIZATION as ReportType)
        : [{ id: generateId(), surah_name: '', pages: '' }],
    // We only want to seed once per `report.id` — re-running on every
    // render would clobber unsaved input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report?.id],
  );
  const initialReview = useMemo(
    () =>
      isEditMode
        ? toFormItems(report?.items, REPORT_TYPES.REVIEW as ReportType)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report?.id],
  );
  // Memorization needs at least one editable row even in edit mode in
  // case the original report had only review items — the form's
  // remove-row guard already enforces a minimum of 1.
  const seededMemorization =
    initialMemorization.length > 0
      ? initialMemorization
      : [{ id: generateId(), surah_name: '', pages: '' }];

  const [reportDate, setReportDate] = useState(report?.report_date ?? today);
  const [memorizationItems, setMemorizationItems] = useState<ReportItem[]>(seededMemorization);
  const [reviewItems, setReviewItems] = useState<ReportItem[]>(initialReview);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState('');

  const surahOptions = SURAHS.map((s) => ({ value: s.name, label: s.name }));

  // ============================================
  // Item Management
  // ============================================
  const addItem = (type: 'memorization' | 'review') => {
    const newItem: ReportItem = { id: generateId(), surah_name: '', pages: '' };
    if (type === 'memorization') {
      setMemorizationItems((prev) => [...prev, newItem]);
    } else {
      setReviewItems((prev) => [...prev, newItem]);
    }
  };

  const removeItem = (type: 'memorization' | 'review', id: string) => {
    if (type === 'memorization') {
      if (memorizationItems.length > 1) {
        setMemorizationItems((prev) => prev.filter((item) => item.id !== id));
      }
    } else {
      setReviewItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const updateItem = (
    type: 'memorization' | 'review',
    id: string,
    field: keyof ReportItem,
    value: string
  ) => {
    const updateFn = (items: ReportItem[]) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item));

    if (type === 'memorization') {
      setMemorizationItems(updateFn);
    } else {
      setReviewItems(updateFn);
    }

    // Clear specific error
    const errorKey = `${type}_${id}_${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: '' }));
    }
  };

  // ============================================
  // Validation
  // ============================================
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    // Future dates are blocked at the picker (max=today) AND here, so
    // pasted / typed values can't slip past. RLS enforces the same
    // constraint server-side.
    if (reportDate && reportDate > today) {
      newErrors.report_date = t('validation.reportDateFuture');
    }

    // Validate memorization items
    memorizationItems.forEach((item) => {
      if (item.surah_name || item.pages) {
        if (!item.surah_name) {
          newErrors[`memorization_${item.id}_surah_name`] = t('validation.nameRequired');
        }
        if (!item.pages) {
          newErrors[`memorization_${item.id}_pages`] = t('validation.nameRequired');
        } else {
          const validation = validatePages(item.pages);
          if (!validation.isValid) {
            newErrors[`memorization_${item.id}_pages`] = t(validation.messageKey);
          }
        }
      }
    });

    // Validate review items
    reviewItems.forEach((item) => {
      if (item.surah_name || item.pages) {
        if (!item.surah_name) {
          newErrors[`review_${item.id}_surah_name`] = t('validation.nameRequired');
        }
        if (!item.pages) {
          newErrors[`review_${item.id}_pages`] = t('validation.nameRequired');
        } else {
          const validation = validatePages(item.pages);
          if (!validation.isValid) {
            newErrors[`review_${item.id}_pages`] = t(validation.messageKey);
          }
        }
      }
    });

    // Check at least one valid item
    const validMemorization = memorizationItems.filter(
      (item) => item.surah_name && item.pages
    );
    const validReview = reviewItems.filter((item) => item.surah_name && item.pages);

    if (validMemorization.length === 0 && validReview.length === 0) {
      newErrors.general = t('report.atLeastOneItem');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================
  // Submit Handler
  // ============================================
  // Shared preparation: validates the form, checks auth + halaqah,
  // and returns the canonical item list. Returns null when something
  // failed (toast already raised) so callers can short-circuit.
  const prepareSubmission = ():
    | Array<{ surah_name: string; pages: number; type: ReportType }>
    | null => {
    setSubmitError('');

    if (!validate()) {
      toast.warning(t('validation.fixErrors'));
      return null;
    }

    if (!profile?.id) {
      const errorMsg = t('errors.notAuthenticated');
      setSubmitError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    // Edit mode reuses the report's existing halaqah_id, so a student
    // who has been moved between halaqahs can still fix yesterday's
    // report even if they no longer belong to the original halaqah
    // record. Create mode still requires an active membership.
    if (!isEditMode && !membership?.halaqah_id) {
      const errorMsg = t('errors.noHalaqah');
      setSubmitError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    return [
      ...memorizationItems
        .filter((item) => item.surah_name && item.pages)
        .map((item) => ({
          surah_name: item.surah_name,
          pages: parseFloat(item.pages),
          type: REPORT_TYPES.MEMORIZATION as ReportType,
        })),
      ...reviewItems
        .filter((item) => item.surah_name && item.pages)
        .map((item) => ({
          surah_name: item.surah_name,
          pages: parseFloat(item.pages),
          type: REPORT_TYPES.REVIEW as ReportType,
        })),
    ];
  };

  // Performs the actual DB write. Returns true on success so the
  // caller can decide whether to also trigger the share flow.
  const performSave = async (
    items: Array<{ surah_name: string; pages: number; type: ReportType }>,
  ): Promise<boolean> => {
    if (isEditMode && report) {
      const { error } = await updateReport(
        report.id,
        { report_date: reportDate },
        items,
      );
      if (error) {
        const errorMsg = getErrorMessage(error);
        setSubmitError(errorMsg);
        toast.error(errorMsg);
        return false;
      }
      return true;
    }

    const { error } = await createReport(
      {
        student_id: profile!.id,
        halaqah_id: membership!.halaqah_id,
        report_date: reportDate,
      },
      items,
    );
    if (error) {
      const errorMsg = getErrorMessage(error);
      setSubmitError(errorMsg);
      toast.error(errorMsg);
      return false;
    }
    return true;
  };

  // Existing "Save only" button path — keeps the original behaviour
  // intact for users who don't want to share.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const items = prepareSubmission();
    if (!items) return;
    const ok = await performSave(items);
    if (!ok) return;
    toast.success(t(isEditMode ? 'report.updateSuccess' : 'report.submitSuccess'));
    navigate('/dashboard');
  };

  // Primary "Send via WhatsApp" path. Validates the form first, then
  // opens the preview dialog with the formatted message pre-filled.
  // The actual save + share happens when the admin confirms inside
  // the dialog (handleShareConfirm).
  const handleOpenShareDialog = () => {
    const items = prepareSubmission();
    if (!items) return;
    // Build a transient report shape from the in-form data so the
    // formatter can produce the preview — `id` doesn't matter here,
    // we never persist this transient object.
    const previewReport = {
      id: '',
      student_id: profile?.id ?? '',
      halaqah_id: membership?.halaqah_id ?? '',
      report_date: reportDate,
      notes: '',
      created_at: '',
      updated_at: '',
      items: items.map((it, idx) => ({
        id: `tmp-${idx}`,
        report_id: '',
        surah_name: it.surah_name,
        pages: it.pages,
        type: it.type,
        created_at: '',
        updated_at: '',
      })),
    };
    const studentName = profile ? getDisplayName(profile) : '';
    const text = formatReportForSharing(previewReport, {
      studentName,
      halaqahName: membership?.halaqah?.name,
      academyName,
    });
    setShareDraftText(text);
    setShareDialogOpen(true);
  };

  // Atomic "save then share" — the dialog's confirm handler. Both
  // succeed → toast + navigate; save fails → keep the dialog open so
  // the admin can retry without losing the draft.
  const handleShareConfirm = async (text: string) => {
    const items = prepareSubmission();
    if (!items) return;
    setSharing(true);
    try {
      const saved = await performSave(items);
      if (!saved) return;

      const outcome = await shareReportViaWhatsapp({
        text,
        halaqahLink: membership?.halaqah?.meet_link,
      });
      // The save already succeeded — surface the save toast first
      // (it's the primary success signal) and the share outcome
      // second (informational, since the share path is best-effort).
      toast.success(
        t(isEditMode ? 'report.updateSuccess' : 'report.submitSuccess'),
      );
      switch (outcome) {
        case 'shared':
          break;
        case 'copied_and_opened':
          toast.info(t('report.shareCopiedAndOpened'));
          break;
        case 'copied':
          toast.info(t('report.shareCopiedNoLink'));
          break;
        case 'unavailable':
          toast.warning(t('report.shareUnavailable'));
          break;
      }
      setShareDialogOpen(false);
      navigate('/dashboard');
    } finally {
      setSharing(false);
    }
  };

  // ============================================
  // Render Item Row
  // ============================================
  const renderItemRow = (item: ReportItem, type: 'memorization' | 'review') => {
    const surahError = errors[`${type}_${item.id}_surah_name`];
    const pagesError = errors[`${type}_${item.id}_pages`];

    return (
      <div key={item.id} className={reportFormStyles.item.wrapper}>
        <div className={reportFormStyles.item.grid}>
          <div>
            <label className={reportFormStyles.item.label}>
              {t('report.surahName')}
            </label>
            <Select
              options={surahOptions}
              value={item.surah_name}
              onChange={(e) => updateItem(type, item.id, 'surah_name', e.target.value)}
              error={!!surahError}
            />
            {surahError && <p className={reportFormStyles.item.error}>{surahError}</p>}
          </div>

          <div>
            <label className={reportFormStyles.item.label}>
              {t('report.pagesCount')}
            </label>
            <Input
              type="number"
              step="0.25"
              min={MIN_PAGES}
              placeholder={t('report.enterPages')}
              value={item.pages}
              onChange={(e) => updateItem(type, item.id, 'pages', e.target.value)}
              error={!!pagesError}
            />
            {pagesError && <p className={reportFormStyles.item.error}>{pagesError}</p>}
            <p className={reportFormStyles.item.help}>{t('common.page')}</p>
          </div>
        </div>

        {!(type === 'memorization' && memorizationItems.length === 1) && (
          <button
            type="button"
            onClick={() => removeItem(type, item.id)}
            className={reportFormStyles.item.remove}
          >
            {t('report.removeItem')}
          </button>
        )}
      </div>
    );
  };

  // ============================================
  // Loading State
  // ============================================
  // In edit mode the halaqah lookup isn't required (we use the report's
  // own halaqah_id), so we don't gate the render on that fetch.
  if (!isEditMode && loadingHalaqah) {
    return (
      <div className={reportFormStyles.loading.wrapper}>
        <div className={reportFormStyles.loading.spinner} />
      </div>
    );
  }

  // ============================================
  // No Halaqah State
  // ============================================
  if (!isEditMode && !membership && !loadingHalaqah) {
    return (
      <Card>
        <CardContent className={reportFormStyles.noHalaqah}>
          <p className={reportFormStyles.noHalaqah}>{t('errors.noHalaqah')}</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            {t('common.backToDashboard')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ============================================
  // Render Form
  // ============================================
  return (
    <form onSubmit={handleSubmit} className={cn(reportFormStyles.form, className)}>
      {/* Error Messages */}
      {submitError && <div className={reportFormStyles.error}>{submitError}</div>}
      {errors.general && <div className={reportFormStyles.error}>{errors.general}</div>}
      {errors.report_date && (
        <div className={reportFormStyles.error}>{errors.report_date}</div>
      )}

      {/* Date Field */}
      <Card>
        <CardContent className={reportFormStyles.dateSection}>
          <label className={reportFormStyles.dateLabel}>{t('report.reportDate')}</label>
          <Input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            // Cap at TODAY (local). No future-dated reports.
            max={today}
          />
        </CardContent>
      </Card>

      {/* Memorization Section */}
      <Card>
        <CardContent className={reportFormStyles.section.content}>
          <div className={reportFormStyles.section.header}>
            <div className={reportFormStyles.section.titleWrapper}>
              <SaveIcon className={reportFormStyles.section.titleIcon} />
              <span className={reportFormStyles.section.title}>
                {t('report.memorization')}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addItem('memorization')}
            >
              <PlusIcon className="w-4 h-4" />
              {t('report.addItem')}
            </Button>
          </div>

          <div className={reportFormStyles.section.items}>
            {memorizationItems.map((item) => renderItemRow(item, 'memorization'))}
          </div>
        </CardContent>
      </Card>

      {/* Review Section */}
      <Card>
        <CardContent className={reportFormStyles.section.content}>
          <div className={reportFormStyles.section.header}>
            <div className={reportFormStyles.section.titleWrapper}>
              <RefreshIcon className={reportFormStyles.section.titleIcon} />
              <span className={reportFormStyles.section.title}>
                {t('report.review')}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addItem('review')}
            >
              <PlusIcon className="w-4 h-4" />
              {t('report.addItem')}
            </Button>
          </div>

          {reviewItems.length === 0 ? (
            <p className={reportFormStyles.section.empty}>{t('report.noReviewItems')}</p>
          ) : (
            <div className={reportFormStyles.section.items}>
              {reviewItems.map((item) => renderItemRow(item, 'review'))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons.
          Create flow: WhatsApp share is the PRIMARY action (most
          students share to their halaqah group); "Save only" is the
          secondary path for those who don't want to share. Edit flow
          keeps the existing single Save button — the share is offered
          per-row on the dashboard for any saved report. */}
      <div className={reportFormStyles.actions.wrapper}>
        {!isEditMode && (
          <Button
            type="button"
            size="lg"
            variant="success"
            onClick={handleOpenShareDialog}
            loading={submitting || sharing}
            className={reportFormStyles.actions.submit}
          >
            <WhatsappIcon className="w-5 h-5" />
            {t('report.sendViaWhatsapp')}
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          variant={isEditMode ? 'primary' : 'outline'}
          loading={submitting}
          className={reportFormStyles.actions.submit}
        >
          {isEditMode ? t('report.saveChanges') : t('report.saveOnly')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => navigate('/dashboard')}
        >
          {t('common.cancel')}
        </Button>
      </div>

      <ShareReportDialog
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        defaultText={shareDraftText}
        onSend={handleShareConfirm}
        loading={sharing || submitting}
      />
    </form>
  );
}

export default ReportForm;
