/**
 * FeedbackModal — "الشكاوى والاقتراحات".
 *
 * Telegram-only complaints/suggestions flow.
 *
 *   1. Reads the destination from `api.settings.getComplaintsTargets()`,
 *      which exposes `telegram` (the configured username) plus a legacy
 *      `whatsapp` field that this modal intentionally ignores.
 *   2. On submit, builds a multi-line Arabic message containing the
 *      user's full name, role, halaqah, and their typed complaint or
 *      suggestion.
 *   3. URL-encodes the message and opens the Telegram chat in a new tab.
 *      WhatsApp is no longer supported as a feedback channel — admins
 *      MUST configure a Telegram username before the feature will send.
 *
 * No backend write — the message is delivered straight to the academy
 * via Telegram, never persisted server-side.
 */
import { useEffect, useState } from 'react';
import { Modal } from '../../atoms/Modal';
import { Button } from '../../atoms/Button';
import { api } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../locales/i18n';
import { useStudentHalaqah } from '../../../hooks/useHalaqah';
import { buildTelegramLink, getFullName } from '../../../lib/utils';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { profile } = useAuth();
  // Halaqah is only meaningful for students; for other roles the
  // membership lookup just returns null and we render "لا يوجد".
  const { halaqah } = useStudentHalaqah(
    profile?.role === 'student' ? profile.id : undefined,
  );

  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [telegram, setTelegram] = useState<string | null>(null);

  // Resolve destination once when the modal opens. Cached across opens —
  // settings don't change often, and a stale read just re-resolves on
  // the next open.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const { data } = await api.settings.getComplaintsTargets();
      if (cancelled) return;
      setTelegram(data.telegram);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error(t('feedback.messageRequired'));
      return;
    }

    // Build the structured message body. Field labels are i18n-keyed so
    // the recipient (academy admin) sees Arabic regardless of the
    // sender's UI language.
    const fullName = profile ? getFullName(profile) : '';
    const roleKey = profile?.role
      ? `auth.${profile.role === 'halaqah_supervisor' ? 'halaqahSupervisor' : profile.role === 'supervisor_manager' ? 'supervisorManager' : profile.role}`
      : '';
    const roleLabel = roleKey ? t(roleKey) : '';
    const halaqahLabel = halaqah?.name || t('feedback.noHalaqah');
    const body = [
      t('feedback.bodyHeader'),
      '',
      `${t('feedback.fieldName')}: ${fullName}`,
      `${t('feedback.fieldRole')}: ${roleLabel}`,
      `${t('feedback.fieldHalaqah')}: ${halaqahLabel}`,
      '',
      `${t('feedback.fieldMessage')}:`,
      trimmed,
    ].join('\n');

    // Telegram-only. If admin hasn't configured the username yet, refuse
    // rather than silently fall back to anything else.
    const url = buildTelegramLink(telegram, body);
    if (!url) {
      toast.error(t('feedback.telegramMissing'));
      return;
    }

    setSubmitting(true);
    window.open(url, '_blank', 'noopener,noreferrer');
    setSubmitting(false);
    setMessage('');
    toast.success(t('feedback.openedTelegram'));
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('feedback.title')}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">{t('feedback.subtitle')}</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          placeholder={t('feedback.placeholder')}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !message.trim()}
          >
            {t('feedback.send')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default FeedbackModal;
