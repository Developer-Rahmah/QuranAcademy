/**
 * StudentTable Component
 * Table displaying students with their progress
 */
import { useTranslation } from '../../../locales/i18n';
import { Card } from '../../molecules/Card';
import { Button } from '../../atoms/Button';
import { Badge } from '../../atoms/Badge';
import { ProgressBar } from '../../atoms/ProgressBar';
import { DocumentIcon } from '../../atoms/Icon';
import { getDisplayName } from '../../../lib/utils';
import { studentTableStyles, studentCardStyles } from './StudentTable.style';
import type { StudentTableProps, StudentCardProps } from './StudentTable.types';

/**
 * StudentTable - Table displaying students with their progress
 */
export function StudentTable({
  students = [],
  loading = false,
  showReportsButton = true,
  onViewReports,
}: StudentTableProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Card padding="lg">
        <div className={studentTableStyles.loading.wrapper}>
          <div className={studentTableStyles.loading.spinner} />
        </div>
      </Card>
    );
  }

  if (students.length === 0) {
    return (
      <Card padding="lg">
        <p className={studentTableStyles.empty}>{t('student.title')}</p>
      </Card>
    );
  }

  return (
    <Card padding="none" className={studentTableStyles.container}>
      <div className={studentTableStyles.scrollWrapper}>
        <table className={studentTableStyles.table}>
          <thead className={studentTableStyles.thead}>
            <tr className={studentTableStyles.headerRow}>
              {showReportsButton && (
                <th className={studentTableStyles.headerCell}>{t('report.title')}</th>
              )}
              <th className={studentTableStyles.headerCell}>{t('common.progress')}</th>
              <th className={studentTableStyles.headerCell}>{t('student.reviewPages')}</th>
              <th className={studentTableStyles.headerCell}>{t('student.memorizationPages')}</th>
              <th className={studentTableStyles.headerCell}>{t('student.name')}</th>
            </tr>
          </thead>
          <tbody className={studentTableStyles.tbody}>
            {students.map((student, index) => (
              <tr
                key={student.id}
                className={index % 2 === 0 ? studentTableStyles.bodyRowEven : studentTableStyles.bodyRowOdd}
              >
                {showReportsButton && (
                  <td className={studentTableStyles.bodyCell}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewReports?.(student)}
                    >
                      <DocumentIcon className="w-4 h-4" />
                      {t('report.title')}
                    </Button>
                  </td>
                )}
                <td className={studentTableStyles.bodyCell}>
                  <div className={studentTableStyles.progressCell.wrapper}>
                    <span className={studentTableStyles.progressCell.value}>
                      {student.progress || 0}%
                    </span>
                    <ProgressBar
                      value={student.progress || 0}
                      size="sm"
                      className={studentTableStyles.progressCell.bar}
                    />
                  </div>
                </td>
                <td className={studentTableStyles.bodyCell}>
                  <Badge variant="outline">{student.reviewPages || 0} {t('common.page')}</Badge>
                </td>
                <td className={studentTableStyles.bodyCell}>
                  <Badge variant="primary">{student.memorizationPages || 0} {t('common.page')}</Badge>
                </td>
                <td className={studentTableStyles.bodyCellBold}>
                  {getDisplayName(student)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * StudentCard - Card view for student (mobile-friendly)
 */
export function StudentCard({ student, onViewReports }: StudentCardProps) {
  const { t } = useTranslation();

  return (
    <Card padding="md" className={studentCardStyles.container}>
      <div className={studentCardStyles.header.wrapper}>
        <div>
          <p className={studentCardStyles.header.name}>{getDisplayName(student)}</p>
        </div>
        {onViewReports && (
          <Button variant="outline" size="sm" onClick={() => onViewReports(student)}>
            <DocumentIcon className="w-4 h-4" />
            {t('report.title')}
          </Button>
        )}
      </div>

      <div className={studentCardStyles.stats.grid}>
        <div>
          <p className={studentCardStyles.stats.label}>{t('student.memorizationPages')}</p>
          <Badge variant="primary">{student.memorizationPages || 0} {t('common.page')}</Badge>
        </div>
        <div>
          <p className={studentCardStyles.stats.label}>{t('student.reviewPages')}</p>
          <Badge variant="outline">{student.reviewPages || 0} {t('common.page')}</Badge>
        </div>
      </div>

      <div>
        <div className={studentCardStyles.progress.header}>
          <span className={studentCardStyles.progress.label}>{t('common.progress')}</span>
          <span className={studentCardStyles.progress.value}>{student.progress || 0}%</span>
        </div>
        <ProgressBar value={student.progress || 0} size="sm" />
      </div>
    </Card>
  );
}

export default StudentTable;
