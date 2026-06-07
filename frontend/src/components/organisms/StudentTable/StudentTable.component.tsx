/**
 * StudentTable Component
 * Table displaying students with their progress
 */
import { useMemo, useState } from 'react';
import { useTranslation } from '../../../locales/i18n';
import { Card } from '../../molecules/Card';
import { Button } from '../../atoms/Button';
import { Badge } from '../../atoms/Badge';
import { Input } from '../../atoms/Input';
import { ProgressBar } from '../../atoms/ProgressBar';
import { DocumentIcon } from '../../atoms/Icon';
import { Pagination } from '../../molecules/Pagination';
import { usePagination } from '../../../hooks/usePagination';
import { getDisplayName, getFullName, buildWhatsAppLink } from '../../../lib/utils';
import { uiText } from '../../../lib/uiText';
import { studentTableStyles, studentCardStyles } from './StudentTable.style';
import type { StudentTableProps, StudentCardProps } from './StudentTable.types';

/**
 * StudentTable - Table displaying students with their progress
 */
export function StudentTable({
  students = [],
  loading = false,
  showReportsButton = true,
  showContact = false,
  showActivation = false,
  onToggleActivation,
  activationLoadingId = null,
  onViewReports,
  segment,
  searchable = true,
}: StudentTableProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  // Filter against the displayed name + contact columns so the search
  // matches whatever the user can see on the row.
  const filtered = useMemo(() => {
    if (!searchable) return students;
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const display = getDisplayName(s).toLowerCase();
      const full = getFullName(s).toLowerCase();
      const email = (s.email || '').toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      return (
        display.includes(q) ||
        full.includes(q) ||
        email.includes(q) ||
        phone.includes(q)
      );
    });
  }, [students, query, searchable]);

  // Paginate the FILTERED list, not the raw `students` prop — so search
  // and pagination compose: typing into the search narrows the dataset,
  // and `usePagination` clamps the page to a valid value after the
  // filter shrinks it (see the effect inside the hook).
  const { page, setPage, pageItems, pageCount } = usePagination(filtered);

  const searchBar = searchable && students.length > 0 ? (
    <div className="mb-3">
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('common.search')}
      />
    </div>
  ) : null;

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
        <p className={studentTableStyles.empty}>
          {t(uiText.getEmptyStateText('student', segment))}
        </p>
      </Card>
    );
  }

  // Search active but nothing matches: keep the input visible above the
  // empty-state so the user can clear the query without losing context.
  if (filtered.length === 0) {
    return (
      <div>
        {searchBar}
        <Card padding="lg">
          <p className={studentTableStyles.empty}>
            {t('admin.noSearchResults')}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {searchBar}
      <Card padding="none" className={studentTableStyles.container}>
      <div className={studentTableStyles.scrollWrapper}>
        <table className={studentTableStyles.table}>
          <thead className={studentTableStyles.thead}>
            <tr className={studentTableStyles.headerRow}>
              {showReportsButton && (
                <th className={studentTableStyles.headerCell}>{t('report.title')}</th>
              )}
              {showActivation && (
                <th className={studentTableStyles.headerCell}>{t('student.activation')}</th>
              )}
              {showContact && (
                <th className={studentTableStyles.headerCell}>{t('student.contact')}</th>
              )}
              <th className={studentTableStyles.headerCell}>{t('common.progress')}</th>
              <th className={studentTableStyles.headerCell}>{t('student.reviewPages')}</th>
              <th className={studentTableStyles.headerCell}>{t('student.memorizationPages')}</th>
              <th className={studentTableStyles.headerCell}>{t('student.name')}</th>
            </tr>
          </thead>
          <tbody className={studentTableStyles.tbody}>
            {pageItems.map((student, index) => (
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
                {showActivation && (
                  <td className={studentTableStyles.bodyCell}>
                    {(() => {
                      // We compute the next-status label per row so the
                      // button reads "Deactivate" for active students
                      // and "Activate" otherwise. Suspended/pending
                      // both flip to active on click — symmetrical
                      // with how AdminUsers handles the toggle.
                      const isActive = student.status === 'active';
                      const loading = activationLoadingId === student.id;
                      return (
                        <Button
                          size="sm"
                          variant={isActive ? 'destructive' : 'success'}
                          loading={loading}
                          onClick={() => onToggleActivation?.(student)}
                        >
                          {isActive
                            ? t('admin.suspend')
                            : t('admin.activate')}
                        </Button>
                      );
                    })()}
                  </td>
                )}
                {showContact && (
                  <td className={studentTableStyles.bodyCell}>
                    {(() => {
                      // Build a single contact cell containing the full
                      // three-part name (when present), phone-as-WhatsApp
                      // link (when present), and email-as-mailto (when
                      // present). Each line falls through gracefully if
                      // the column is null at the data layer.
                      const link = buildWhatsAppLink(student.phone);
                      const fullName =
                        getFullName(student) || getDisplayName(student);
                      return (
                        <div className="flex flex-col gap-1 items-end max-w-[220px]">
                          <span className="text-sm font-medium text-foreground truncate w-full text-end">
                            {fullName}
                          </span>
                          {link ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-primary hover:underline truncate w-full text-end"
                            >
                              {student.phone}
                            </a>
                          ) : (
                            <span className="text-sm text-muted">
                              {t('student.noPhone')}
                            </span>
                          )}
                          {student.email && (
                            <a
                              href={`mailto:${student.email}`}
                              className="text-xs text-muted hover:text-primary truncate w-full text-end"
                              title={student.email}
                            >
                              {student.email}
                            </a>
                          )}
                        </div>
                      );
                    })()}
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
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
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
