/**
 * HalaqahTable Component
 * Table displaying halaqahs with progress
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../locales/i18n';
import { Card } from '../../molecules/Card';
import { Button } from '../../atoms/Button';
import { ProgressBar } from '../../atoms/ProgressBar';
import { EyeIcon } from '../../atoms/Icon';
import { StatusBadge } from '../../atoms/Badge';
import { getDisplayName } from '../../../lib/utils';
import { halaqahTableStyles } from './HalaqahTable.style';
import type { HalaqahTableProps } from './HalaqahTable.types';

/**
 * HalaqahTable - Table displaying halaqahs with progress
 */
export function HalaqahTable({ halaqahs = [], loading = false, showActions = true }: HalaqahTableProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card padding="lg">
        <div className={halaqahTableStyles.loading.wrapper}>
          <div className={halaqahTableStyles.loading.spinner} />
        </div>
      </Card>
    );
  }

  if (halaqahs.length === 0) {
    return (
      <Card padding="lg">
        <p className={halaqahTableStyles.empty}>{t('halaqah.title')}</p>
      </Card>
    );
  }

  return (
    <Card padding="none" className={halaqahTableStyles.container}>
      <div className={halaqahTableStyles.scrollWrapper}>
        <table className={halaqahTableStyles.table}>
          <thead className={halaqahTableStyles.thead}>
            <tr className={halaqahTableStyles.headerRow}>
              {showActions && (
                <th className={halaqahTableStyles.headerCell}>{t('common.edit')}</th>
              )}
              <th className={halaqahTableStyles.headerCell}>{t('admin.status')}</th>
              <th className={halaqahTableStyles.headerCell}>{t('common.progress')}</th>
              <th className={halaqahTableStyles.headerCell}>{t('halaqah.studentCount')}</th>
              <th className={halaqahTableStyles.headerCell}>{t('halaqah.teacherName')}</th>
              <th className={halaqahTableStyles.headerCell}>{t('halaqah.halaqahName')}</th>
            </tr>
          </thead>
          <tbody className={halaqahTableStyles.tbody}>
            {halaqahs.map((halaqah, index) => (
              <tr
                key={halaqah.id}
                className={index % 2 === 0 ? halaqahTableStyles.bodyRowEven : halaqahTableStyles.bodyRowOdd}
              >
                {showActions && (
                  <td className={halaqahTableStyles.bodyCell}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/halaqah/${halaqah.id}`)}
                    >
                      <EyeIcon className="w-4 h-4" />
                      {t('common.edit')}
                    </Button>
                  </td>
                )}
                <td className={halaqahTableStyles.bodyCell}>
                  {halaqah.status && <StatusBadge status={halaqah.status} />}
                </td>
                <td className={halaqahTableStyles.bodyCell}>
                  <div className={halaqahTableStyles.progressCell.wrapper}>
                    <span className={halaqahTableStyles.progressCell.value}>
                      {halaqah.avgProgress || 0}%
                    </span>
                    <ProgressBar
                      value={halaqah.avgProgress || 0}
                      size="sm"
                      className={halaqahTableStyles.progressCell.bar}
                    />
                  </div>
                </td>
                <td className={halaqahTableStyles.bodyCell}>
                  {halaqah.studentCount || 0}
                </td>
                <td className={halaqahTableStyles.bodyCell}>
                  {halaqah.teacher
                    ? `أ. ${getDisplayName(halaqah.teacher)}`
                    : t('halaqah.notAssigned')}
                </td>
                <td className={halaqahTableStyles.bodyCellBold}>
                  {halaqah.name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default HalaqahTable;
