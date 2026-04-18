/**
 * HalaqahForm Component
 * Modal form for creating and editing halaqahs
 */
import { useState, useEffect } from 'react';
import { Modal } from '../../atoms/Modal';
import { Button } from '../../atoms/Button';
import { FormField } from '../../molecules/FormField';
import { Select } from '../../atoms/Select';
import { db } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../locales/i18n';
import { halaqahFormStyles as styles } from './HalaqahForm.style';
import type { HalaqahFormProps, HalaqahFormData, HalaqahFormErrors } from './HalaqahForm.types';
import type { Profile } from '../../../types';

const INITIAL_FORM_DATA: HalaqahFormData = {
  name: '',
  teacher_id: '',
  meet_link: '',
  level: 'beginner',
  target_audience: 'women', // Default to 'women' - valid enum value
  status: 'active',
};

export function HalaqahForm({
  halaqah,
  isOpen,
  onClose,
  onSuccess,
}: HalaqahFormProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [formData, setFormData] = useState<HalaqahFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<HalaqahFormErrors>({});
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);

  const isEditing = !!halaqah;

  // Fetch teachers
  useEffect(() => {
    const fetchTeachers = async () => {
      setLoadingTeachers(true);
      try {
        const { data, error } = await db.profiles.getAll({ role: 'teacher', status: 'active' });
        if (error) {
          console.error('Error fetching teachers:', error);
          return;
        }
        setTeachers(data || []);
      } catch (err) {
        console.error('Error fetching teachers:', err);
      } finally {
        setLoadingTeachers(false);
      }
    };

    if (isOpen) {
      fetchTeachers();
    }
  }, [isOpen]);

  // Initialize form data when editing
  useEffect(() => {
    if (halaqah) {
      setFormData({
        name: halaqah.name || '',
        teacher_id: halaqah.teacher_id || '',
        meet_link: halaqah.meet_link || '',
        level: halaqah.level || 'beginner',
        target_audience: halaqah.target_audience || 'both',
        status: halaqah.status || 'active',
      });
    } else {
      setFormData(INITIAL_FORM_DATA);
    }
    setErrors({});
  }, [halaqah, isOpen]);

  // Handle field change
  const handleChange = (field: keyof HalaqahFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: HalaqahFormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t('validation.nameRequired');
    }

    if (!formData.teacher_id) {
      newErrors.teacher_id = t('admin.teacherRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.warning(t('validation.fixErrors'));
      return;
    }

    setLoading(true);

    try {
      if (isEditing && halaqah) {
        // Update existing halaqah
        const { error } = await db.halaqahs.update(halaqah.id, formData);
        if (error) {
          console.error('Error updating halaqah:', error);
          toast.error(t('errors.generic'));
          return;
        }
        toast.success(t('admin.halaqahUpdated'));
      } else {
        // Create new halaqah
        const { error } = await db.halaqahs.create(formData);
        if (error) {
          console.error('Error creating halaqah:', error);
          toast.error(t('errors.generic'));
          return;
        }
        toast.success(t('admin.halaqahCreated'));
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving halaqah:', err);
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  // Get teacher display name
  const getTeacherName = (teacher: Profile): string => {
    const parts = [teacher.first_name, teacher.second_name].filter(Boolean);
    return parts.join(' ') || teacher.email;
  };

  // Options
  const teacherOptions = [
    { value: '', label: t('admin.selectTeacher') },
    ...teachers.map(teacher => ({
      value: teacher.id,
      label: getTeacherName(teacher),
    })),
  ];

  const levelOptions = [
    { value: 'beginner', label: t('registration.beginner') },
    { value: 'intermediate', label: t('registration.intermediate') },
    { value: 'advanced', label: t('registration.advanced') },
  ];

  // Uses preferred_audience enum: children, women, both
  // Run fix_halaqah_target_audience.sql to update the database
  const audienceOptions = [
    { value: 'women', label: t('registration.women') },
    { value: 'children', label: t('registration.children') },
    { value: 'both', label: t('registration.both') },
  ];

  const statusOptions = [
    { value: 'active', label: t('status.active') },
    { value: 'paused', label: t('status.paused') },
    { value: 'completed', label: t('status.completed') },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('admin.editHalaqah') : t('admin.createHalaqah')}
      size="lg"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors.submit && (
          <div className={styles.errorBox}>{errors.submit}</div>
        )}

        <FormField
          label={t('halaqah.halaqahName')}
          name="name"
          type="text"
          placeholder={t('admin.enterHalaqahName')}
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          required
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {t('halaqah.teacherName')} <span className="text-destructive">*</span>
          </label>
          <Select
            value={formData.teacher_id}
            onChange={(e) => handleChange('teacher_id', e.target.value)}
            options={teacherOptions}
            disabled={loadingTeachers}
          />
          {errors.teacher_id && (
            <p className="text-sm text-destructive">{errors.teacher_id}</p>
          )}
        </div>

        <FormField
          label={t('halaqah.meetLink')}
          name="meet_link"
          type="url"
          placeholder="https://meet.google.com/..."
          value={formData.meet_link}
          onChange={(e) => handleChange('meet_link', e.target.value)}
          error={errors.meet_link}
        />

        <div className={styles.row}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {t('admin.level')}
            </label>
            <Select
              value={formData.level}
              onChange={(e) => handleChange('level', e.target.value)}
              options={levelOptions}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {t('admin.targetAudience')}
            </label>
            <Select
              value={formData.target_audience}
              onChange={(e) => handleChange('target_audience', e.target.value)}
              options={audienceOptions}
            />
          </div>
        </div>

        {isEditing && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {t('admin.status')}
            </label>
            <Select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              options={statusOptions}
            />
          </div>
        )}

        <div className={styles.footer}>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? t('common.save') : t('admin.createHalaqah')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default HalaqahForm;
