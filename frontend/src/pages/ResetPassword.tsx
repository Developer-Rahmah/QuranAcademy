/**
 * Reset Password Page - completes the password-recovery email flow.
 *
 * Supabase delivers the recovery tokens in the URL hash (`#access_token=...&type=recovery`).
 * The supabase client (created with `detectSessionInUrl: true`) consumes the hash on
 * mount and fires a PASSWORD_RECOVERY event, which AuthContext uses to set
 * `isRecoverySession`. This page verifies a live session exists before letting the
 * user submit a new password.
 */
import { useEffect, useRef, useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { AuthLayout, AuthCard } from '../components/templates/AuthLayout';
import { FormField } from '../components/molecules/FormField';
import { Button } from '../components/atoms/Button';
import { getErrorMessage } from '../lib/utils';

const MIN_PASSWORD_LENGTH = 6;
const SUCCESS_REDIRECT_MS = 2000;
// Supabase needs a moment to parse the recovery hash after first load.
const HASH_PARSE_DELAY_MS = 300;

type Status = 'checking' | 'ready' | 'invalid' | 'success';

export function ResetPassword() {
  const navigate = useNavigate();
  const toast = useToast();
  const { updatePassword, signOut } = useAuth();

  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Once we reach success, nothing downstream may downgrade the status —
  // in particular the SIGNED_OUT event fired by our own signOut() must not
  // flip the page back to "invalid".
  const hasSucceededRef = useRef(false);
  const setStatusSafe = (next: Status) => {
    if (hasSucceededRef.current) return;
    setStatus(next);
  };

  // Verify the recovery session exactly once, on mount. We intentionally
  // do NOT depend on auth-context state here because later flips (e.g.
  // SIGNED_OUT after a successful reset) would otherwise race the success UI.
  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (window.location.hash.includes('type=recovery')) {
        await new Promise((r) => setTimeout(r, HASH_PARSE_DELAY_MS));
      }

      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error || !data?.session) {
        setStatusSafe('invalid');
        return;
      }

      setStatusSafe('ready');
    };

    verify();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (): boolean => {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      setFieldError(`كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`);
      return false;
    }
    if (password !== confirmPassword) {
      setFieldError('كلمتا المرور غير متطابقتين');
      return false;
    }
    setFieldError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!validate()) return;

    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);

    if (error) {
      const msg = getErrorMessage(error);
      setSubmitError(msg);
      toast.error(msg);
      return;
    }

    // Success is sticky — lock it in BEFORE calling signOut() so the
    // resulting SIGNED_OUT event can't flip the UI back to an error state.
    hasSucceededRef.current = true;
    setSubmitError('');
    setStatus('success');
    toast.success('تم تحديث كلمة المرور بنجاح');

    // Let the user read the success message, then terminate the recovery
    // session and hand them off to the login page.
    setTimeout(async () => {
      try {
        await signOut();
      } finally {
        navigate('/login', { replace: true });
      }
    }, SUCCESS_REDIRECT_MS);
  };

  if (status === 'checking') {
    return (
      <AuthLayout title="إعادة تعيين كلمة المرور">
        <AuthCard>
          <div className="flex justify-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (status === 'invalid') {
    return (
      <AuthLayout title="رابط غير صالح">
        <AuthCard>
          <div className="text-center space-y-4">
            <p className="text-sm text-destructive">
              انتهت صلاحية رابط إعادة التعيين أو أنه غير صالح
            </p>
            <p className="text-sm text-muted">
              يرجى طلب رابط جديد لإعادة تعيين كلمة المرور
            </p>
            <Link to="/forgot-password">
              <Button size="full">طلب رابط جديد</Button>
            </Link>
            <Link to="/login" className="block text-sm text-primary hover:underline">
              العودة إلى تسجيل الدخول
            </Link>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (status === 'success') {
    return (
      <AuthLayout title="تم تحديث كلمة المرور">
        <AuthCard>
          <div className="text-center space-y-4">
            <p className="text-sm text-foreground">
              تم تحديث كلمة المرور بنجاح
            </p>
            <p className="text-sm text-muted">
              سيتم توجيهك إلى صفحة تسجيل الدخول خلال لحظات...
            </p>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="إعادة تعيين كلمة المرور"
      subtitle="أدخل كلمة المرور الجديدة"
    >
      <AuthCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {submitError && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {submitError}
            </div>
          )}

          <FormField
            label="كلمة المرور الجديدة"
            name="password"
            type="password"
            placeholder="أدخل كلمة المرور الجديدة"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldError) setFieldError('');
            }}
            error={fieldError && !confirmPassword ? fieldError : ''}
          />

          <FormField
            label="تأكيد كلمة المرور"
            name="confirmPassword"
            type="password"
            placeholder="أعد إدخال كلمة المرور"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (fieldError) setFieldError('');
            }}
            error={fieldError && confirmPassword ? fieldError : ''}
          />

          <Button type="submit" size="full" loading={submitting}>
            تحديث كلمة المرور
          </Button>

          <p className="text-center text-sm text-muted">
            <Link to="/login" className="text-primary hover:underline">
              العودة إلى تسجيل الدخول
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}

export default ResetPassword;
