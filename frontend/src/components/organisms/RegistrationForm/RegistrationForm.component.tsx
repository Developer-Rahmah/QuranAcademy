/**
 * RegistrationForm Component
 * Student and Teacher registration forms with toast notifications
 */
import { useState, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../locales/i18n';
import { Button } from '../../atoms/Button';
import { Checkbox } from '../../atoms/Checkbox';
import { FormField, FormSection } from '../../molecules/FormField';
import { ToggleGroup } from '../../molecules/ToggleGroup';
import { TimeSlotSelector } from '../../molecules/TimeSlotSelector';
import { PhoneField, toE164 } from '../../molecules/PhoneField';
import { RecitationField } from '../../molecules/RecitationField';
import {
  MEMORIZATION_LEVELS,
  LEVEL_LABELS,
  USER_SEGMENTS,
} from '../../../lib/constants';
import { DEFAULT_COUNTRY_ISO } from '../../../lib/countries';
import { isValidEmail, validatePassword } from '../../../lib/utils';
import { getErrorMessage } from '../../../lib/errorHandler';
import {
  defaultStudentTypeForSegment,
  studentTypeOptionsForSegment,
  studentTypeLabelKey,
  submitStudentType,
  submitPreferredAudience,
  registrationTitleKey,
  type StudentTypeUI,
  type PreferredAudienceUI,
} from '../../../lib/segment';
import { segmentationRules } from '../../../lib/segmentationRules';

// NOTE: language_type normalization lives inline at each submit site as
// a ternary returning 'arabic_speaker' | 'non_arabic_speaker'. Keeping it
// inline makes the submit payload's language value visible in the same
// block as the signUp call, so nobody can drop or rename the key silently.
import { registrationFormStyles } from './RegistrationForm.style';
import type { StudentFormData, TeacherFormData, FormErrors } from './RegistrationForm.types';
import type { MemorizationLevel, UserSegment } from '../../../types';

// ============================================
// Student Registration Form
// ============================================
export function StudentRegistrationForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signUp, loading } = useAuth();
  const toast = useToast();

  const [formData, setFormData] = useState<StudentFormData>({
    first_name: '',
    second_name: '',
    third_name: '',
    age: '',
    phoneField: { country: DEFAULT_COUNTRY_ISO, local: '' },
    email: '',
    password: '',
    student_type: 'woman',
    memorization_level: '',
    segment: USER_SEGMENTS.WOMEN as UserSegment,
    language_type: 'arabic_speaker',
    recitation: '',
    available_times: [],
    agreed: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const handleChange = <K extends keyof StudentFormData>(
    field: K,
    value: StudentFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors((prev) => ({ ...prev, [field as string]: '' }));
    }
  };

  // Segment drives role label + enforced defaults (student_type).
  // Cascading here keeps the form from submitting an invalid combination
  // like segment='men' + student_type='woman'.
  const handleSegmentChange = (next: UserSegment) => {
    setFormData((prev) => ({
      ...prev,
      segment: next,
      student_type: defaultStudentTypeForSegment(next),
    }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.first_name.trim()) newErrors.first_name = t('validation.nameRequired');
    if (!formData.second_name.trim()) newErrors.second_name = t('validation.nameRequired');
    if (!formData.third_name.trim()) newErrors.third_name = t('validation.nameRequired');

    const age = parseInt(formData.age);
    if (!formData.age || age < 5 || age > 100) {
      newErrors.age = t('validation.ageRequired');
    }
    if (!formData.phoneField.country) {
      newErrors.phoneField = t('validation.countryRequired');
    } else if (!formData.phoneField.local.trim() || formData.phoneField.local.length < 6) {
      newErrors.phoneField = t('validation.phoneInvalid');
    }
    if (!formData.email.trim()) {
      newErrors.email = t('validation.emailRequired');
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = t('validation.emailInvalid');
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.message;
    }

    if (!formData.recitation.trim()) {
      newErrors.recitation = t('validation.nameRequired');
    }

    if (formData.available_times.length === 0) {
      newErrors.available_times = t('validation.timeSlotsRequired');
    }

    if (!formData.agreed) {
      newErrors.agreed = t('validation.agreementRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.warning(t('validation.fixErrors'));
      return;
    }

    // Coerce UI-only values ('man', 'men') to DB-valid values. Gender
    // itself is carried by `segment`.
    const submittedStudentType = submitStudentType(formData.student_type);

    // Final normalization for language_type, spelled out as a literal
    // ternary so the only two possible outputs are visible at the submit
    // site. Guarantees `raw_user_meta_data.language_type` is never null.
    const languageType: 'arabic_speaker' | 'non_arabic_speaker' =
      formData.language_type === 'non_arabic_speaker'
        ? 'non_arabic_speaker'
        : 'arabic_speaker';

    const { error } = await signUp(formData.email, formData.password, {
      first_name: formData.first_name,
      second_name: formData.second_name,
      third_name: formData.third_name,
      phone: toE164(formData.phoneField),
      country: formData.phoneField.country,
      age: parseInt(formData.age),
      role: 'student',
      student_type: submittedStudentType ?? undefined,
      memorization_level: (formData.memorization_level as MemorizationLevel) || undefined,
      segment: formData.segment,
      language_type: languageType,
      recitation: formData.recitation,
      available_times: formData.available_times,
    });

    if (error) {
      const errorMessage = getErrorMessage(error);
      setErrors({ submit: errorMessage });
      toast.error(errorMessage);
      return;
    }

    // Success!
    toast.success(t('registration.successMessage'));
    navigate('/success');
  };

  // Segment is now strictly gender/age; language moved to its own radio.
  const segmentOptions = [
    { value: USER_SEGMENTS.WOMEN,    label: t('segment.women') },
    { value: USER_SEGMENTS.MEN,      label: t('segment.men') },
    { value: USER_SEGMENTS.CHILDREN, label: t('segment.children') },
  ];

  // student_type options come from the segment so we never show an invalid
  // pairing like segment='men' + student_type='woman'.
  const studentTypeOptions = studentTypeOptionsForSegment(formData.segment).map((v) => ({
    value: v,
    label: t(studentTypeLabelKey(v)),
  }));

  // Radio values ARE the DB literals — no translation layer, so whatever
  // the user clicks is what lands in `formData.language_type` and, after
  // submit normalization, in Supabase `raw_user_meta_data.language_type`.
  const languageOptions = [
    { value: 'arabic_speaker',     label: t('registration.arabicSpeaker') },
    { value: 'non_arabic_speaker', label: t('registration.nonArabicSpeaker') },
  ];

  const levelOptions = [
    { value: MEMORIZATION_LEVELS.BEGINNER, label: LEVEL_LABELS[MEMORIZATION_LEVELS.BEGINNER as MemorizationLevel] },
    { value: MEMORIZATION_LEVELS.INTERMEDIATE, label: LEVEL_LABELS[MEMORIZATION_LEVELS.INTERMEDIATE as MemorizationLevel] },
    { value: MEMORIZATION_LEVELS.ADVANCED, label: LEVEL_LABELS[MEMORIZATION_LEVELS.ADVANCED as MemorizationLevel] },
  ];

  return (
    <form onSubmit={handleSubmit} className={registrationFormStyles.form}>
      {errors.submit && (
        <div className={registrationFormStyles.error.wrapper}>{errors.submit}</div>
      )}

      {/* Segment-aware live title — flips between gendered variants
          (طالب / طالبة) the moment the segment changes. */}
      <h2 className="text-xl font-medium text-foreground text-center">
        {t(registrationTitleKey('student', formData.segment))}
      </h2>

      <FormSection title={t('segment.label')}>
        <FormField
          label={t('segment.label')}
          name="segment"
          type="select"
          required
          options={segmentOptions}
          value={formData.segment}
          onChange={(e) => handleSegmentChange((e.target as HTMLSelectElement).value as UserSegment)}
        />
      </FormSection>

      <FormSection title={t('registration.firstName')}>
        <FormField
          label={t('registration.firstName')}
          name="first_name"
          required
          value={formData.first_name}
          onChange={(e) => handleChange('first_name', e.target.value)}
          error={errors.first_name}
        />
        <FormField
          label={t('registration.secondName')}
          name="second_name"
          required
          value={formData.second_name}
          onChange={(e) => handleChange('second_name', e.target.value)}
          error={errors.second_name}
        />
        <FormField
          label={t('registration.thirdName')}
          name="third_name"
          required
          value={formData.third_name}
          onChange={(e) => handleChange('third_name', e.target.value)}
          error={errors.third_name}
        />
        <FormField
          label={t('registration.age')}
          name="age"
          type="number"
          required
          value={formData.age}
          onChange={(e) => handleChange('age', e.target.value)}
          error={errors.age}
        />
      </FormSection>

      <FormSection title={t('auth.email')}>
        <PhoneField
          label={t('registration.phone')}
          name="phone"
          required
          value={formData.phoneField}
          onChange={(v) => handleChange('phoneField', v)}
          error={errors.phoneField}
        />
        <FormField
          label={t('auth.email')}
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          error={errors.email}
        />
        <FormField
          label={t('auth.password')}
          name="password"
          type="password"
          required
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
          error={errors.password}
        />
      </FormSection>

      <FormSection title={t('registration.studentType')}>
        <div>
          <label className={registrationFormStyles.toggleField.label}>
            {t('registration.studentType')} <span className={registrationFormStyles.toggleField.required}>*</span>
          </label>
          <ToggleGroup
            options={studentTypeOptions}
            value={formData.student_type}
            onChange={(value) => handleChange('student_type', value as StudentTypeUI)}
          />
        </div>
        <div>
          <label className={registrationFormStyles.toggleField.label}>
            {t('registration.languageLabel')} <span className={registrationFormStyles.toggleField.required}>*</span>
          </label>
          <ToggleGroup
            options={languageOptions}
            value={formData.language_type}
            onChange={(value) =>
              handleChange(
                'language_type',
                value === 'non_arabic_speaker'
                  ? 'non_arabic_speaker'
                  : 'arabic_speaker',
              )
            }
          />
        </div>
        <div>
          <label className={registrationFormStyles.toggleField.label}>
            {t('registration.memorizationLevel')}
          </label>
          <ToggleGroup
            options={levelOptions}
            value={formData.memorization_level}
            onChange={(value) => handleChange('memorization_level', value as MemorizationLevel | '')}
          />
        </div>
        <RecitationField
          label={t('recitation.currentRecitation')}
          name="recitation"
          required
          value={formData.recitation}
          onChange={(v) => handleChange('recitation', v)}
          error={errors.recitation}
        />
      </FormSection>

      <FormSection title={t('registration.availableTimes')}>
        <p className={registrationFormStyles.timeSlotInfo}>
          {t('registration.selectAvailableTimes')}
        </p>
        <TimeSlotSelector
          value={formData.available_times}
          onChange={(value) => handleChange('available_times', value)}
          error={errors.available_times}
        />
      </FormSection>

      <div className={registrationFormStyles.agreement.wrapper}>
        <Checkbox
          label={t('registration.agreement')}
          checked={formData.agreed}
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('agreed', e.target.checked)}
          error={!!errors.agreed}
        />
        {errors.agreed && (
          <p className={registrationFormStyles.agreement.error}>{errors.agreed}</p>
        )}
      </div>

      <Button type="submit" size="full" loading={loading}>
        {t('registration.submitRegistration')}
      </Button>

      <p className={registrationFormStyles.backLink.wrapper}>
        <button
          type="button"
          onClick={() => navigate('/signup')}
          className={registrationFormStyles.backLink.link}
        >
          {t('registration.backToSignup')}
        </button>
      </p>
    </form>
  );
}

// ============================================
// Teacher Registration Form
// ============================================
export function TeacherRegistrationForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signUp, loading } = useAuth();
  const toast = useToast();

  const [formData, setFormData] = useState<TeacherFormData>({
    first_name: '',
    second_name: '',
    third_name: '',
    age: '',
    phoneField: { country: DEFAULT_COUNTRY_ISO, local: '' },
    email: '',
    password: '',
    preferred_audience: segmentationRules.getDefaultAudience(USER_SEGMENTS.WOMEN) as PreferredAudienceUI,
    teaching_experience: '',
    segment: USER_SEGMENTS.WOMEN as UserSegment,
    language_type: 'arabic_speaker',
    quran_parts_taught: '',
    is_certified: false,
    authorized_recitations: [],
    available_times: [],
    agreed: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const handleChange = <K extends keyof TeacherFormData>(
    field: K,
    value: TeacherFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors((prev) => ({ ...prev, [field as string]: '' }));
    }
  };

  // Teacher audience is constrained by segment (see lib/segment.ts).
  // Switching segment resets the audience to a valid default so the form
  // never carries a stale value like 'women' after selecting 'men'.
  const handleSegmentChange = (next: UserSegment) => {
    setFormData((prev) => ({
      ...prev,
      segment: next,
      preferred_audience: segmentationRules.getDefaultAudience(next) as PreferredAudienceUI,
    }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.first_name.trim()) newErrors.first_name = t('validation.nameRequired');
    if (!formData.second_name.trim()) newErrors.second_name = t('validation.nameRequired');
    if (!formData.third_name.trim()) newErrors.third_name = t('validation.nameRequired');

    const age = parseInt(formData.age);
    if (!formData.age || age < 18 || age > 100) {
      newErrors.age = t('validation.ageRequired');
    }
    if (!formData.phoneField.country) {
      newErrors.phoneField = t('validation.countryRequired');
    } else if (!formData.phoneField.local.trim() || formData.phoneField.local.length < 6) {
      newErrors.phoneField = t('validation.phoneInvalid');
    }
    if (!formData.email.trim()) {
      newErrors.email = t('validation.emailRequired');
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = t('validation.emailInvalid');
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.message;
    }

    if (!formData.teaching_experience.trim()) {
      newErrors.teaching_experience = t('validation.nameRequired');
    }

    const parts = parseInt(formData.quran_parts_taught, 10);
    if (!formData.quran_parts_taught || Number.isNaN(parts) || parts < 1 || parts > 30) {
      newErrors.quran_parts_taught = t('validation.nameRequired');
    }

    if (formData.authorized_recitations.length === 0) {
      newErrors.authorized_recitations = t('validation.nameRequired');
    }

    if (formData.available_times.length === 0) {
      newErrors.available_times = t('validation.timeSlotsRequired');
    }

    if (!formData.agreed) {
      newErrors.agreed = t('validation.agreementRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.warning(t('validation.fixErrors'));
      return;
    }

    // Explicit normalization, parallel to the student submit. Output can
    // only ever be one of the two DB literals.
    const languageType: 'arabic_speaker' | 'non_arabic_speaker' =
      formData.language_type === 'non_arabic_speaker'
        ? 'non_arabic_speaker'
        : 'arabic_speaker';

    const { error } = await signUp(formData.email, formData.password, {
      first_name: formData.first_name,
      second_name: formData.second_name,
      third_name: formData.third_name,
      phone: toE164(formData.phoneField),
      country: formData.phoneField.country,
      age: parseInt(formData.age),
      role: 'teacher',
      // UI-only 'men' is collapsed to the DB-valid 'both'; segment tag
      // preserves the men/women distinction authoritatively.
      preferred_audience: submitPreferredAudience(formData.preferred_audience),
      teaching_experience: formData.teaching_experience,
      segment: formData.segment,
      language_type: languageType,
      quran_parts_taught: parseInt(formData.quran_parts_taught, 10),
      is_certified: formData.is_certified,
      authorized_recitations: formData.authorized_recitations,
      available_times: formData.available_times,
    });

    if (error) {
      const errorMessage = getErrorMessage(error);
      setErrors({ submit: errorMessage });
      toast.error(errorMessage);
      return;
    }

    // Success!
    toast.success(t('registration.successMessage'));
    navigate('/success');
  };

  const teacherSegmentOptions = [
    { value: USER_SEGMENTS.WOMEN,    label: t('segment.women') },
    { value: USER_SEGMENTS.MEN,      label: t('segment.men') },
    { value: USER_SEGMENTS.CHILDREN, label: t('segment.children') },
  ];

  // Restrict audience options to those compatible with the current segment:
  //   men   → men | children | both
  //   women → women | children | both
  //   children → children | women | both
  // Audience option list comes from the rule engine — same source as
  // HalaqahForm. Men → [men, children, both]; women → [women, children,
  // both]. The opposite gender NEVER appears here.
  const audienceOptions = segmentationRules
    .getAllowedAudience(formData.segment)
    .map((value) => ({
      value,
      label: t(segmentationRules.audienceLabelKey(value)),
    }));

  // Same deal as the student form: toggle values ARE the DB literals.
  const teacherLanguageOptions = [
    { value: 'arabic_speaker',     label: t('registration.arabicSpeaker') },
    { value: 'non_arabic_speaker', label: t('registration.nonArabicSpeaker') },
  ];

  return (
    <form onSubmit={handleSubmit} className={registrationFormStyles.form}>
      {errors.submit && (
        <div className={registrationFormStyles.error.wrapper}>{errors.submit}</div>
      )}

      <h2 className="text-xl font-medium text-foreground text-center">
        {t(registrationTitleKey('teacher', formData.segment))}
      </h2>

      <FormSection title={t('segment.label')}>
        <FormField
          label={t('segment.label')}
          name="segment"
          type="select"
          required
          options={teacherSegmentOptions}
          value={formData.segment}
          onChange={(e) => handleSegmentChange((e.target as HTMLSelectElement).value as UserSegment)}
        />
      </FormSection>

      <FormSection title={t('registration.firstName')}>
        <FormField
          label={t('registration.firstName')}
          name="first_name"
          required
          value={formData.first_name}
          onChange={(e) => handleChange('first_name', e.target.value)}
          error={errors.first_name}
        />
        <FormField
          label={t('registration.secondName')}
          name="second_name"
          required
          value={formData.second_name}
          onChange={(e) => handleChange('second_name', e.target.value)}
          error={errors.second_name}
        />
        <FormField
          label={t('registration.thirdName')}
          name="third_name"
          required
          value={formData.third_name}
          onChange={(e) => handleChange('third_name', e.target.value)}
          error={errors.third_name}
        />
        <FormField
          label={t('registration.age')}
          name="age"
          type="number"
          required
          value={formData.age}
          onChange={(e) => handleChange('age', e.target.value)}
          error={errors.age}
        />
      </FormSection>

      <FormSection title={t('auth.email')}>
        <PhoneField
          label={t('registration.phone')}
          name="phone"
          required
          value={formData.phoneField}
          onChange={(v) => handleChange('phoneField', v)}
          error={errors.phoneField}
        />
        <FormField
          label={t('auth.email')}
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          error={errors.email}
        />
        <FormField
          label={t('auth.password')}
          name="password"
          type="password"
          required
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
          error={errors.password}
        />
      </FormSection>

      <FormSection title={t('registration.preferredAudience')}>
        <div>
          <label className={registrationFormStyles.toggleField.label}>
            {t('registration.languageLabel')} <span className={registrationFormStyles.toggleField.required}>*</span>
          </label>
          <ToggleGroup
            options={teacherLanguageOptions}
            value={formData.language_type}
            onChange={(value) =>
              handleChange(
                'language_type',
                value === 'non_arabic_speaker'
                  ? 'non_arabic_speaker'
                  : 'arabic_speaker',
              )
            }
          />
        </div>
        <div>
          <label className={registrationFormStyles.toggleField.label}>
            {t('registration.preferredAudience')} <span className={registrationFormStyles.toggleField.required}>*</span>
          </label>
          <ToggleGroup
            options={audienceOptions}
            value={formData.preferred_audience}
            onChange={(value) => handleChange('preferred_audience', value as PreferredAudienceUI)}
          />
        </div>
        <FormField
          label={t('registration.teachingExperience')}
          name="teaching_experience"
          type="textarea"
          required
          value={formData.teaching_experience}
          onChange={(e) => handleChange('teaching_experience', e.target.value)}
          error={errors.teaching_experience}
        />
        <FormField
          label={t('teacherFields.quranPartsTaught')}
          name="quran_parts_taught"
          type="number"
          required
          help={t('teacherFields.quranPartsHint')}
          value={formData.quran_parts_taught}
          onChange={(e) => handleChange('quran_parts_taught', (e.target as HTMLInputElement).value)}
          error={errors.quran_parts_taught}
        />
        <div>
          <Checkbox
            label={t('teacherFields.isCertified')}
            checked={formData.is_certified}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('is_certified', e.target.checked)}
          />
        </div>
        <RecitationField
          mode="multi"
          label={t('teacherFields.authorizedRecitations')}
          required
          value={formData.authorized_recitations}
          onChange={(v) => handleChange('authorized_recitations', v)}
          error={errors.authorized_recitations}
        />
      </FormSection>

      <FormSection title={t('registration.availableTimes')}>
        <p className={registrationFormStyles.timeSlotInfo}>
          {t('registration.selectAvailableTimes')}
        </p>
        <TimeSlotSelector
          value={formData.available_times}
          onChange={(value) => handleChange('available_times', value)}
          error={errors.available_times}
        />
      </FormSection>

      <div className={registrationFormStyles.agreement.wrapper}>
        <Checkbox
          label={t('registration.agreement')}
          checked={formData.agreed}
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('agreed', e.target.checked)}
          error={!!errors.agreed}
        />
        {errors.agreed && (
          <p className={registrationFormStyles.agreement.error}>{errors.agreed}</p>
        )}
      </div>

      <Button type="submit" size="full" loading={loading}>
        {t('registration.submitRegistration')}
      </Button>

      <p className={registrationFormStyles.backLink.wrapper}>
        <button
          type="button"
          onClick={() => navigate('/signup')}
          className={registrationFormStyles.backLink.link}
        >
          {t('registration.backToSignup')}
        </button>
      </p>
    </form>
  );
}

export default StudentRegistrationForm;
