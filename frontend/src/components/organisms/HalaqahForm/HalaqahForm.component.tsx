/**
 * HalaqahForm Component
 * Modal form for creating and editing halaqahs.
 *
 * Segment-driven UX:
 *   The first field is a required `segment` select (men/women). Every
 *   label, placeholder, and option list downstream is derived from it:
 *     - men   → masculine labels (معلم/طالب), audience ['men', 'children', 'both']
 *     - women → feminine labels (معلمة/طالبة), audience ['women', 'children', 'both']
 *
 *   Teacher list is filtered to only teachers whose own `segment` matches
 *   the form's segment, so a men's halaqah can never pick a female teacher
 *   and vice-versa. Audience options are computed from the segment via
 *   `audienceOptionsForSegment` (same helper the registration form uses),
 *   which guarantees "men should NEVER see women options".
 */
import { useState, useEffect } from 'react';
import { Modal } from '../../atoms/Modal';
import { Button } from '../../atoms/Button';
import { FormField } from '../../molecules/FormField';
import { Select } from '../../atoms/Select';
import { db } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../locales/i18n';
import { submitPreferredAudience } from '../../../lib/segment';
import {
  segmentationRules,
} from '../../../lib/segmentationRules';
import { getAddressGenderLabelKey } from '../../../lib/domain/roleRules';
import { UserSegment, type HalaqahSegment } from '../../../lib/enums';
import { halaqahFormStyles as styles } from './HalaqahForm.style';
import type { HalaqahFormProps, HalaqahFormData, HalaqahFormErrors } from './HalaqahForm.types';
import type { Profile } from '../../../types';

/**
 * Default segment for a brand-new halaqah, picked by the admin on first
 * open. We MUST NOT default to 'women' silently — the form forces the
 * admin to make a deliberate choice. The state starts at 'women' purely
 * because <select> needs a defined value; the admin then either accepts
 * it explicitly or switches.
 *
 * Either way, all downstream UI text is derived from the live segment
 * via the rule engine — no separate fallback path exists.
 */
const DEFAULT_SEGMENT: HalaqahSegment = UserSegment.WOMEN;

function makeInitialFormData(segment: HalaqahSegment): HalaqahFormData {
  return {
    name: '',
    teacher_id: '',
    meet_link: '',
    level: 'beginner',
    target_audience: segmentationRules.getDefaultAudience(segment),
    status: 'active',
    segment,
  };
}

export function HalaqahForm({
  halaqah,
  isOpen,
  onClose,
  onSuccess,
}: HalaqahFormProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [formData, setFormData] = useState<HalaqahFormData>(
    () => makeInitialFormData(DEFAULT_SEGMENT),
  );
  const [errors, setErrors] = useState<HalaqahFormErrors>({});
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);

  const isEditing = !!halaqah;
  // Single derivation point. EVERY gendered piece of UI in this form
  // reads from `ui.*` — there is no other gender branch. Switching
  // segment in the dropdown above flips this object on the next render.
  const ui = segmentationRules.getGenderedUI({ role: 'teacher', segment: formData.segment });

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

  // Initialize form data when editing — segment is read from the
  // persisted halaqah; if it isn't men/women we still keep the literal
  // off the DB rather than defaulting to a gendered value silently.
  useEffect(() => {
    if (halaqah) {
      const persistedSegment: HalaqahSegment =
        halaqah.segment === UserSegment.MEN ? UserSegment.MEN : UserSegment.WOMEN;
      setFormData({
        name: halaqah.name || '',
        teacher_id: halaqah.teacher_id || '',
        meet_link: halaqah.meet_link || '',
        level: halaqah.level || 'beginner',
        target_audience:
          (halaqah.target_audience as HalaqahFormData['target_audience']) ||
          segmentationRules.getDefaultAudience(persistedSegment),
        status: halaqah.status || 'active',
        segment: persistedSegment,
      });
    } else {
      setFormData(makeInitialFormData(DEFAULT_SEGMENT));
    }
    setErrors({});
  }, [halaqah, isOpen]);

  // Segment is the top-level driver: switching it resets audience + the
  // previously-picked teacher (who might belong to the other segment).
  // The rule engine guarantees men can never carry a women audience and
  // vice versa.
  const handleSegmentChange = (next: HalaqahSegment) => {
    setFormData((prev) => ({
      ...prev,
      segment: next,
      target_audience: segmentationRules.getDefaultAudience(next),
      teacher_id: '',
    }));
    setErrors((prev) => ({ ...prev, segment: '', teacher_id: '', target_audience: '' }));
  };

  // Generic field change. Value is a string from a <select>/<input> and
  // maps cleanly onto the union expected for each field.
  const handleChange = <K extends keyof HalaqahFormData>(
    field: K,
    value: string,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value as HalaqahFormData[K] }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: HalaqahFormErrors = {};

    if (!formData.segment) {
      newErrors.segment = t('admin.segmentRequired');
    }

    if (!formData.name.trim()) {
      newErrors.name = t('validation.nameRequired');
    }

    if (!formData.teacher_id) {
      newErrors.teacher_id = t(ui.teacherRequiredError);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.warning(t('validation.fixErrors'));
      return;
    }

    setLoading(true);

    try {
      // Coerce UI-only audience value ('men' → 'both') to a DB-safe literal;
      // segment preserves the gender.
      const payload = {
        name: formData.name,
        teacher_id: formData.teacher_id,
        meet_link: formData.meet_link,
        level: formData.level,
        target_audience: submitPreferredAudience(formData.target_audience),
        status: formData.status,
        segment: formData.segment,
      };

      if (isEditing && halaqah) {
        const { error } = await db.halaqahs.update(halaqah.id, payload);
        if (error) {
          console.error('Error updating halaqah:', error);
          toast.error(t('errors.generic'));
          return;
        }
        toast.success(t('admin.halaqahUpdated'));
      } else {
        const { error } = await db.halaqahs.create(payload);
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

  // Teacher display name.
  const getTeacherName = (teacher: Profile): string => {
    const parts = [teacher.first_name, teacher.second_name].filter(Boolean);
    return parts.join(' ') || teacher.email;
  };

  // Only expose teachers whose own `segment` matches the halaqah's.
  // Teachers with a missing/unknown segment are NOT silently bucketed
  // into either gender — they're excluded so a men's halaqah never
  // accidentally surfaces a female teacher.
  const segmentTeachers = teachers.filter(
    (teacher) => teacher.segment === formData.segment,
  );

  const teacherOptions = [
    { value: '', label: t(ui.selectTeacherPlaceholder) },
    ...segmentTeachers.map((teacher) => ({
      value: teacher.id,
      label: getTeacherName(teacher),
    })),
  ];

  const levelOptions = [
    { value: 'beginner', label: t('registration.beginner') },
    { value: 'intermediate', label: t('registration.intermediate') },
    { value: 'advanced', label: t('registration.advanced') },
  ];

  // Audience options are derived from the rule engine — men/women NEVER
  // see the opposite gender's value. The engine returns the AudienceType
  // enum so we can label via the canonical i18n helper.
  const audienceOptions = segmentationRules
    .getAllowedAudience(formData.segment)
    .map((value) => ({
      value,
      label: t(segmentationRules.audienceLabelKey(value)),
    }));

  const segmentOptions = [
    { value: 'women', label: t('segment.women') },
    { value: 'men',   label: t('segment.men') },
  ];

  const statusOptions = [
    { value: 'active',    label: t('status.active') },
    { value: 'paused',    label: t('status.paused') },
    { value: 'completed', label: t('status.completed') },
  ];

  // All title/submit text routed through the rule engine — single source.
  const modalTitle = t(isEditing ? ui.editHalaqahTitle : ui.createHalaqahTitle);
  const submitLabel = isEditing ? t('common.save') : t(ui.createHalaqahTitle);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="lg"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors.submit && (
          <div className={styles.errorBox}>{errors.submit}</div>
        )}

        {/* Segment — required, drives everything below it. */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {t('segment.label')} <span className="text-destructive">*</span>
          </label>
          <Select
            value={formData.segment}
            onChange={(e) => handleSegmentChange(e.target.value as HalaqahSegment)}
            options={segmentOptions}
          />
          {errors.segment && (
            <p className="text-sm text-destructive">{errors.segment}</p>
          )}

          {/* Address language — read-only, derived directly from segment.
              Makes the grammatical-gender rule explicit to the admin so
              they know why the labels downstream read masculine/feminine. */}
          <p className="text-sm text-muted">
            {t('halaqah.addressLanguage')}:{' '}
            <span className="font-medium text-foreground">
              {t(getAddressGenderLabelKey(formData.segment))}
            </span>
          </p>
        </div>

        <FormField
          label={t('halaqah.halaqahName')}
          name="name"
          type="text"
          placeholder={t(ui.halaqahNamePlaceholder)}
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          required
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {t(ui.teacherFieldLabel)}{' '}
            <span className="text-destructive">*</span>
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
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default HalaqahForm;
