/**
 * ReportList Component
 * List of reports with items grouped by date.
 *
 * Optionally renders per-row edit/delete actions when the parent
 * passes `onEdit` / `onDelete`. The component is purely presentational
 * — the parent owns the confirmation flow and the API calls. This
 * keeps the list reusable for surfaces (teacher view, admin view)
 * that should NOT expose edit/delete.
 */
import { useTranslation } from '../../../locales/i18n';
import { Card } from '../../molecules/Card';
import { Badge } from '../../atoms/Badge';
import { CalendarIcon, EditIcon, TrashIcon } from '../../atoms/Icon';
import { REPORT_TYPES } from '../../../lib/constants';
import { reportListStyles, reportCardStyles, reportSummaryStyles } from './ReportList.style';
import type { ReportListProps, ReportCardProps, ReportSummaryProps } from './ReportList.types';

/**
 * ReportList - List of reports with items grouped by date
 */
export function ReportList({
  reports = [],
  loading = false,
  onEdit,
  onDelete,
}: ReportListProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Card padding="lg">
        <div className={reportListStyles.loading.wrapper}>
          <div className={reportListStyles.loading.spinner} />
        </div>
      </Card>
    );
  }

  if (reports.length === 0) {
    return (
      <Card padding="lg">
        <p className={reportListStyles.empty}>{t('report.noReports')}</p>
      </Card>
    );
  }

  return (
    <div className={reportListStyles.list}>
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

/**
 * ReportCard - Single report card with items
 */
export function ReportCard({ report, onEdit, onDelete }: ReportCardProps) {
  const { t } = useTranslation();

  const memorizationItems =
    report.items?.filter((item) => item.type === REPORT_TYPES.MEMORIZATION) || [];
  const reviewItems =
    report.items?.filter((item) => item.type === REPORT_TYPES.REVIEW) || [];

  const totalMemorization = memorizationItems.reduce(
    (sum, item) => sum + parseFloat(String(item.pages)),
    0
  );
  const totalReview = reviewItems.reduce(
    (sum, item) => sum + parseFloat(String(item.pages)),
    0
  );

  const showActions = !!onEdit || !!onDelete;

  return (
    <Card padding="md">
      {/* Header with date and badges */}
      <div className={reportCardStyles.header.wrapper}>
        <div className={reportCardStyles.header.date}>
          <CalendarIcon className={reportCardStyles.header.dateIcon} />
          <span className={reportCardStyles.header.dateText}>{report.report_date}</span>
        </div>
        <div className={reportCardStyles.header.badges}>
          {totalMemorization > 0 && (
            <Badge variant="primary">{t('report.memorization')}: {totalMemorization} {t('common.page')}</Badge>
          )}
          {totalReview > 0 && (
            <Badge variant="outline">{t('report.review')}: {totalReview} {t('common.page')}</Badge>
          )}
        </div>
      </div>

      {/* Report items */}
      <div className={reportCardStyles.items}>
        {memorizationItems.map((item, index) => (
          <div key={`mem-${index}`} className={reportCardStyles.item}>
            {item.surah_name} - {item.pages} {t('common.page')} ({t('report.memorization')})
          </div>
        ))}
        {reviewItems.map((item, index) => (
          <div key={`rev-${index}`} className={reportCardStyles.item}>
            {item.surah_name} - {item.pages} {t('common.page')} ({t('report.review')})
          </div>
        ))}
      </div>

      {showActions && (
        <div className={reportCardStyles.actions.wrapper}>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(report)}
              className={`${reportCardStyles.actions.button} ${reportCardStyles.actions.edit}`}
              aria-label={t('common.edit')}
            >
              <EditIcon className={reportCardStyles.actions.icon} />
              <span>{t('common.edit')}</span>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(report)}
              className={`${reportCardStyles.actions.button} ${reportCardStyles.actions.delete}`}
              aria-label={t('common.delete')}
            >
              <TrashIcon className={reportCardStyles.actions.icon} />
              <span>{t('common.delete')}</span>
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * ReportSummary - Summary statistics for reports
 */
export function ReportSummary({ reports = [] }: ReportSummaryProps) {
  const { t } = useTranslation();

  const totals = reports.reduce(
    (acc, report) => {
      report.items?.forEach((item) => {
        if (item.type === REPORT_TYPES.MEMORIZATION) {
          acc.memorization += parseFloat(String(item.pages));
        } else {
          acc.review += parseFloat(String(item.pages));
        }
      });
      return acc;
    },
    { memorization: 0, review: 0 }
  );

  return (
    <Card padding="md" className={reportSummaryStyles.container}>
      <div className={reportSummaryStyles.grid}>
        <div>
          <p className={reportSummaryStyles.stat.label}>{t('progress.memorizationPages')}</p>
          <p className={`${reportSummaryStyles.stat.value} ${reportSummaryStyles.stat.valuePrimary}`}>
            {totals.memorization}
          </p>
          <p className={reportSummaryStyles.stat.unit}>{t('common.page')}</p>
        </div>
        <div>
          <p className={reportSummaryStyles.stat.label}>{t('progress.reviewPages')}</p>
          <p className={`${reportSummaryStyles.stat.value} ${reportSummaryStyles.stat.valueForeground}`}>
            {totals.review}
          </p>
          <p className={reportSummaryStyles.stat.unit}>{t('common.page')}</p>
        </div>
      </div>
    </Card>
  );
}

export default ReportList;
