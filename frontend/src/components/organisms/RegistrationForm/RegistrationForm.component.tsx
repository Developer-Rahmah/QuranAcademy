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
import {
  COUNTRIES,
  STUDENT_TYPES,
  MEMORIZATION_LEVELS,
  PREFERRED_AUDIENCE,
  STUDENT_TYPE_LABELS,
  LEVEL_LABELS,
  AUDIENCE_LABELS,
} from '../../../lib/constants';
import { isValidEmail, isValidPhone, validatePassword } from '../../../lib/utils';
import { getErrorMessage } from '../../../lib/errorHandler';
import { registrationFormStyles } from './RegistrationForm.style';
import type { StudentFormData, TeacherFormData, FormErrors } from './RegistrationForm.types';
import type { StudentType, MemorizationLevel, PreferredAudience } from '../../../types';

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
    country: '',
    phone: '',
    email: '',
    password: '',
    student_type: STUDENT_TYPES.WOMAN as StudentType,
    memorization_level: '',
    available_times: [],
    agreed: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const handleChange = (field: keyof StudentFormData, value: string | string[] | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
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
    if (!formData.country) newErrors.country = t('validation.countryRequired');
    if (!formData.phone.trim()) {
      newErrors.phone = t('validation.phoneRequired');
    } else if (!isValidPhone(formData.phone)) {
      newErrors.phone = t('validation.phoneInvalid');
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

    const { error } = await signUp(formData.email, formData.password, {
      first_name: formData.first_name,
      second_name: formData.second_name,
      third_name: formData.third_name,
      phone: formData.phone,
      age: parseInt(formData.age),
      country: formData.country,
      role: 'student',
      student_type: formData.student_type,
      memorization_level: formData.memorization_level as MemorizationLevel || undefined,
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

  const countryOptions = COUNTRIES.map((c) => ({ value: c, label: c }));

  const studentTypeOptions = [
    { value: STUDENT_TYPES.WOMAN, label: STUDENT_TYPE_LABELS[STUDENT_TYPES.WOMAN as StudentType] },
    { value: STUDENT_TYPES.CHILD, label: STUDENT_TYPE_LABELS[STUDENT_TYPES.CHILD as StudentType] },
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
        <div className={registrationFormStyles.fieldGroup}>
          <FormField
            label={t('registration.age')}
            name="age"
            type="number"
            required
            value={formData.age}
            onChange={(e) => handleChange('age', e.target.value)}
            error={errors.age}
          />
          <FormField
            label={t('registration.country')}
            name="country"
            type="select"
            required
            options={countryOptions}
            value={formData.country}
            onChange={(e) => handleChange('country', e.target.value)}
            error={errors.country}
          />
        </div>
      </FormSection>

      <FormSection title={t('auth.email')}>
        <FormField
          label={t('registration.phone')}
          name="phone"
          type="tel"
          required
          placeholder="+966501234567"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          error={errors.phone}
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
            onChange={(value) => handleChange('student_type', value as string)}
          />
        </div>
        <div>
          <label className={registrationFormStyles.toggleField.label}>
            {t('registration.memorizationLevel')}
          </label>
          <ToggleGroup
            options={levelOptions}
            value={formData.memorization_level}
            onChange={(value) => handleChange('memorization_level', value as string)}
          />
        </div>
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
    country: '',
    phone: '',
    email: '',
    password: '',
    preferred_audience: PREFERRED_AUDIENCE.BOTH as PreferredAudience,
    teaching_experience: '',
    available_times: [],
    agreed: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const handleChange = (field: keyof TeacherFormData, value: string | string[] | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
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
    if (!formData.country) newErrors.country = t('validation.countryRequired');
    if (!formData.phone.trim()) {
      newErrors.phone = t('validation.phoneRequired');
    } else if (!isValidPhone(formData.phone)) {
      newErrors.phone = t('validation.phoneInvalid');
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

    const { error } = await signUp(formData.email, formData.password, {
      first_name: formData.first_name,
      second_name: formData.second_name,
      third_name: formData.third_name,
      phone: formData.phone,
      age: parseInt(formData.age),
      country: formData.country,
      role: 'teacher',
      preferred_audience: formData.preferred_audience,
      teaching_experience: formData.teaching_experience,
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

  const countryOptions = COUNTRIES.map((c) => ({ value: c, label: c }));

  const audienceOptions = [
    { value: PREFERRED_AUDIENCE.CHILDREN, label: AUDIENCE_LABELS[PREFERRED_AUDIENCE.CHILDREN as PreferredAudience] },
    { value: PREFERRED_AUDIENCE.WOMEN, label: AUDIENCE_LABELS[PREFERRED_AUDIENCE.WOMEN as PreferredAudience] },
    { value: PREFERRED_AUDIENCE.BOTH, label: AUDIENCE_LABELS[PREFERRED_AUDIENCE.BOTH as PreferredAudience] },
  ];

  return (
    <form onSubmit={handleSubmit} className={registrationFormStyles.form}>
      {errors.submit && (
        <div className={registrationFormStyles.error.wrapper}>{errors.submit}</div>
      )}

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
        <div className={registrationFormStyles.fieldGroup}>
          <FormField
            label={t('registration.age')}
            name="age"
            type="number"
            required
            value={formData.age}
            onChange={(e) => handleChange('age', e.target.value)}
            error={errors.age}
          />
          <FormField
            label={t('registration.country')}
            name="country"
            type="select"
            required
            options={countryOptions}
            value={formData.country}
            onChange={(e) => handleChange('country', e.target.value)}
            error={errors.country}
          />
        </div>
      </FormSection>

      <FormSection title={t('auth.email')}>
        <FormField
          label={t('registration.phone')}
          name="phone"
          type="tel"
          required
          placeholder="+966501234567"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          error={errors.phone}
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
            {t('registration.preferredAudience')} <span className={registrationFormStyles.toggleField.required}>*</span>
          </label>
          <ToggleGroup
            options={audienceOptions}
            value={formData.preferred_audience}
            onChange={(value) => handleChange('preferred_audience', value as string)}
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
