/**
 * RegistrationForm Component Styles
 * Tailwind classes for Registration Forms
 */

export const registrationFormStyles = {
  form: 'space-y-8',

  error: {
    wrapper: 'p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm',
  },

  fieldGroup: 'grid grid-cols-1 md:grid-cols-2 gap-4',

  toggleField: {
    label: 'block text-sm font-medium text-foreground mb-2',
    required: 'text-destructive',
  },

  timeSlotInfo: 'text-sm text-muted mb-4',

  agreement: {
    wrapper: 'space-y-4',
    error: 'text-sm text-destructive',
  },

  backLink: {
    wrapper: 'text-center text-sm text-muted',
    link: 'text-primary hover:underline',
  },
} as const;
