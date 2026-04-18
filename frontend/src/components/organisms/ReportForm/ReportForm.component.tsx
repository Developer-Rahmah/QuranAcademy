/**
 * ReportForm Component
 * Form for submitting daily memorization/review reports
 * With proper profile guards and toast notifications
 */
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../locales/i18n';
import { useCreateReport } from '../../../hooks/useReports';
import { useStudentHalaqah } from '../../../hooks/useHalaqah';
import { Button } from '../../atoms/Button';
import { Select } from '../../atoms/Select';
import { Input } from '../../atoms/Input';
import { Card, CardContent } from '../../molecules/Card';
import { PlusIcon, SaveIcon, RefreshIcon } from '../../atoms/Icon';
import { SURAHS, REPORT_TYPES, MIN_PAGES } from '../../../lib/constants';
import { cn, formatDateISO, validatePages, generateId } from '../../../lib/utils';
import { getErrorMessage } from '../../../lib/errorHandler';
import { reportFormStyles } from './ReportForm.style';
import type { ReportItem, FormErrors, ReportFormProps } from './ReportForm.types';
import type { ReportType } from '../../../types';

// ============================================
// ReportForm Component
// ============================================
export function ReportForm({ className }: ReportFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const { membership, loading: loadingHalaqah } = useStudentHalaqah(profile?.id);
  const { createReport, loading: submitting } = useCreateReport();

  // Form state
  const [reportDate, setReportDate] = useState(formatDateISO(new Date()));
  const [memorizationItems, setMemorizationItems] = useState<ReportItem[]>([
    { id: generateId(), surah_name: '', pages: '' },
  ]);
  const [reviewItems, setReviewItems] = useState<ReportItem[]>([]);
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
            newErrors[`memorization_${item.id}_pages`] = validation.message;
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
            newErrors[`review_${item.id}_pages`] = validation.message;
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
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    // Validate form
    if (!validate()) {
      toast.warning(t('validation.fixErrors'));
      return;
    }

    // CRITICAL: Check profile and membership exist
    if (!profile?.id) {
      const errorMsg = t('errors.notAuthenticated');
      setSubmitError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (!membership?.halaqah_id) {
      const errorMsg = t('errors.noHalaqah');
      setSubmitError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Prepare items
    const items = [
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

    // Create report
    const { error } = await createReport(
      {
        student_id: profile.id,
        halaqah_id: membership.halaqah_id,
        report_date: reportDate,
      },
      items
    );

    if (error) {
      const errorMsg = getErrorMessage(error);
      setSubmitError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Success!
    toast.success(t('report.submitSuccess'));
    navigate('/dashboard');
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
  if (loadingHalaqah) {
    return (
      <div className={reportFormStyles.loading.wrapper}>
        <div className={reportFormStyles.loading.spinner} />
      </div>
    );
  }

  // ============================================
  // No Halaqah State
  // ============================================
  if (!membership && !loadingHalaqah) {
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

      {/* Date Field */}
      <Card>
        <CardContent className={reportFormStyles.dateSection}>
          <label className={reportFormStyles.dateLabel}>{t('report.reportDate')}</label>
          <Input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            max={formatDateISO(new Date())}
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

      {/* Action Buttons */}
      <div className={reportFormStyles.actions.wrapper}>
        <Button
          type="submit"
          size="lg"
          loading={submitting}
          className={reportFormStyles.actions.submit}
        >
          {t('report.submitReport')}
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
    </form>
  );
}

export default ReportForm;
