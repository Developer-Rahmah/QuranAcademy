/**
 * Context Index - Exports all context providers and hooks
 */

// Auth Context
export { AuthProvider, useAuth } from './AuthContext';
export type { default as AuthContext } from './AuthContext';

// Toast Context
export { ToastProvider, useToast } from './ToastContext';
export type { Toast, ToastType } from './ToastContext';

// Settings Context
export { SettingsProvider, useSettings } from './SettingsContext';
export type { ContactSettings } from './SettingsContext';
