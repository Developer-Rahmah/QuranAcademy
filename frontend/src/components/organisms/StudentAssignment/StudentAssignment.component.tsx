/**
 * StudentAssignment Component
 * Modal for assigning students to a halaqah
 */
import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../../atoms/Modal';
import { Button } from '../../atoms/Button';
import { Input } from '../../atoms/Input';
import { Badge } from '../../atoms/Badge';
import { PlusIcon, UsersIcon } from '../../atoms/Icon';
import { db } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../locales/i18n';
import { canStudentJoinHalaqah } from '../../../lib/domain/roleRules';
import { uiText } from '../../../lib/uiText';
import { studentAssignmentStyles as styles } from './StudentAssignment.style';
import type { StudentAssignmentProps, StudentWithMembership } from './StudentAssignment.types';
import type { Profile } from '../../../types';

export function StudentAssignment({
  halaqahId,
  halaqahName,
  halaqah,
  isOpen,
  onClose,
  onSuccess,
}: StudentAssignmentProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [students, setStudents] = useState<StudentWithMembership[]>([]);
  const [assignedStudents, setAssignedStudents] = useState<StudentWithMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all students and their assignment status
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      // Get all active students
      const { data: allStudents, error: studentsError } = await db.profiles.getAll({
        role: 'student',
        status: 'active',
      });

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        toast.error(t('errors.generic'));
        return;
      }

      // Get current halaqah members
      const { data: members, error: membersError } = await db.members.getByHalaqah(halaqahId);

      if (membersError) {
        console.error('Error fetching members:', membersError);
      }

      const memberIds = new Set((members || []).map(m => m.student_id));

      // Categorize students
      const studentsWithStatus: StudentWithMembership[] = (allStudents || []).map(student => ({
        ...student,
        isAssigned: memberIds.has(student.id),
        membership: (members || []).find(m => m.student_id === student.id),
      }));

      const assigned = studentsWithStatus.filter(s => s.isAssigned);
      const unassigned = studentsWithStatus.filter(s => !s.isAssigned);

      setAssignedStudents(assigned);
      setStudents(unassigned);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [halaqahId, toast, t]);

  useEffect(() => {
    if (isOpen) {
      fetchStudents();
      setSearchQuery('');
    }
  }, [isOpen, fetchStudents]);

  // Assign student to halaqah
  const assignStudent = async (studentId: string) => {
    // Defensive guard — the Assign button is disabled for incompatible
    // students, but we also block a programmatic call just in case a
    // consumer calls this directly.
    const target = students.find((s) => s.id === studentId);
    if (target && halaqah && !canStudentJoinHalaqah(target, halaqah)) {
      toast.error(t('assignment.incompatibleGender'));
      return;
    }

    setActionLoading(studentId);
    try {
      const { error } = await db.members.add(halaqahId, studentId);

      if (error) {
        console.error('Error assigning student:', error);
        toast.error(t('errors.generic'));
        return;
      }

      toast.success(t('admin.studentAssigned'));
      await fetchStudents();
      onSuccess();
    } catch (err) {
      console.error('Error assigning student:', err);
      toast.error(t('errors.generic'));
    } finally {
      setActionLoading(null);
    }
  };

  // Remove student from halaqah
  const removeStudent = async (memberId: string) => {
    setActionLoading(memberId);
    try {
      const { error } = await db.members.remove(memberId);

      if (error) {
        console.error('Error removing student:', error);
        toast.error(t('errors.generic'));
        return;
      }

      toast.success(t('admin.studentRemoved'));
      await fetchStudents();
      onSuccess();
    } catch (err) {
      console.error('Error removing student:', err);
      toast.error(t('errors.generic'));
    } finally {
      setActionLoading(null);
    }
  };

  // Get student display name
  const getDisplayName = (student: Profile): string => {
    const parts = [student.first_name, student.second_name, student.third_name].filter(Boolean);
    return parts.join(' ') || student.email;
  };

  // Filter students by search query AND audience compatibility.
  // Compatibility-hiding: mismatched students are hidden entirely so the
  // admin can't see them as options. This enforces the rule both visually
  // and logically — no disabled rows, no fallback list. The defensive
  // `assignStudent` guard remains as belt-and-braces.
  const filteredUnassigned = students.filter(student => {
    if (halaqah && !canStudentJoinHalaqah(student, halaqah)) return false;
    const name = getDisplayName(student).toLowerCase();
    const email = (student.email || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t(uiText.getManageStudentsLabel(halaqah?.segment))} - ${halaqahName}`}
      size="lg"
    >
      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
        </div>
      ) : (
        <div className={styles.container}>
          {/* Currently Assigned Students */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <UsersIcon className="w-4 h-4" />
              {t(uiText.getAssignedParticipantsLabel(halaqah?.segment))}
              <span className={styles.sectionCount}>{assignedStudents.length}</span>
            </h3>

            {assignedStudents.length === 0 ? (
              <div className={styles.emptyState}>
                {t(uiText.getEmptyStateText('student', halaqah?.segment))}
              </div>
            ) : (
              <div className={styles.studentList}>
                {assignedStudents.map(student => (
                  <div key={student.id} className={styles.studentItem}>
                    <div className={styles.studentInfo}>
                      <div className={styles.studentName}>{getDisplayName(student)}</div>
                      <div className={styles.studentMeta}>
                        <span>{student.email}</span>
                        {student.phone && <span>{student.phone}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => student.membership && removeStudent(student.membership.id)}
                      loading={actionLoading === student.membership?.id}
                    >
                      {t('admin.remove')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.divider} />

          {/* Available Students to Assign */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <PlusIcon className="w-4 h-4" />
              {t(uiText.getAvailableParticipantsLabel(halaqah?.segment))}
              <span className={styles.sectionCount}>{students.length}</span>
            </h3>

            {/* Search */}
            <Input
              type="text"
              placeholder={t(uiText.getSearchStudentLabel(halaqah?.segment))}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />

            {filteredUnassigned.length === 0 ? (
              <div className={styles.emptyState}>
                {searchQuery
                  ? t('admin.noSearchResults')
                  : t(uiText.getEmptyStateText('student', halaqah?.segment))}
              </div>
            ) : (
              <div className={styles.studentList}>
                {filteredUnassigned.map((student) => {
                  // By this point `filteredUnassigned` already excludes
                  // audience-incompatible students, so every row here is
                  // assignable. The defensive guard inside `assignStudent`
                  // remains in place for programmatic safety.
                  return (
                    <div key={student.id} className={styles.studentItem}>
                      <div className={styles.studentInfo}>
                        <div className={styles.studentName}>
                          {getDisplayName(student)}
                        </div>
                        <div className={styles.studentMeta}>
                          <span>{student.email}</span>
                          {student.memorization_level && (
                            <Badge variant="secondary" size="sm">
                              {t(`registration.${student.memorization_level}`)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => assignStudent(student.id)}
                        loading={actionLoading === student.id}
                      >
                        <PlusIcon className="w-4 h-4" />
                        {t('admin.assign')}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles.footer}>
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default StudentAssignment;
