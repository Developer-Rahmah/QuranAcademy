/**
 * FeedbackModal — "الشكاوى والاقتراحات".
 *
 * In-app complaints / suggestions / bug reports.
 *
 *   1. The user picks a type (complaint / suggestion / bug) and types
 *      a message (≤ 500 chars).
 *   2. We POST `{ name, type, message }` to the backend complaints
 *      service (`backend/complaints-api/`) at
 *      `${VITE_COMPLAINTS_API_URL}/api/complaint`.
 *   3. The backend forwards the payload to the Telegram admin chats it
 *      knows about. The frontend never sees a token, a chat id, or a
 *      Telegram URL.
 *   4. On success: toast + close. On failure: toast with a localized,
 *      reason-specific message; the modal stays open so the user can
 *      retry without re-typing.
 *
 * `name` is sourced from the authenticated profile (`getFullName`) so
 * the user doesn't have to retype their identity. The modal lives
 * inside the dashboard header, behind auth guards, so `profile` is
 * always defined when this renders.
 */
import { useState, useMemo, useEffect } from 'react';
import { Modal } from '../../atoms/Modal';
import { Button } from '../../atoms/Button';
import { ToggleGroup } from '../../molecules/ToggleGroup';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../locales/i18n';
import { getFullName, getDisplayName } from '../../../lib/utils';
import {
  COMPLAINT_MESSAGE_MAX,
  COMPLAINT_TYPES,
  submitComplaint,
  type ComplaintType,
} from '../../../lib/complaints';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_LABEL_KEY: Record<ComplaintType, string> = {
  complaint: 'feedback.typeComplaint',
  suggestion: 'feedback.typeSuggestion',
  bug: 'feedback.typeBug',
};

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { profile } = useAuth();

  const [type, setType] = useState<ComplaintType>('complaint');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset transient state when the modal closes so re-opening shows a
  // fresh form. Type defaults back to 'complaint' (the most common
  // case, matching the dropdown's first option).
  useEffect(() => {
    if (!isOpen) {
      setMessage('');
      setType('complaint');
      setSubmitting(false);
    }
  }, [isOpen]);

  const typeOptions = useMemo(
    () =>
      COMPLAINT_TYPES.map((value) => ({
        value,
        label: t(TYPE_LABEL_KEY[value]),
      })),
    [t],
  );

  const trimmed = message.trim();
  const tooLong = trimmed.length > COMPLAINT_MESSAGE_MAX;
  // Disable submit when the message is empty / too long. We don't
  // pre-check `name` here because the auth-derived name is always
  // populated for an authenticated user; the backend will surface a
  // validation error in the unlikely edge case it isn't.
  const canSubmit = !!trimmed && !tooLong && !submitting;

  const handleSubmit = async () => {
    if (!trimmed) {
      toast.error(t('feedback.messageRequired'));
      return;
    }
    if (tooLong) {
      toast.error(t('feedback.messageTooLong'));
      return;
    }

    // Pull the name from the auth profile. `getFullName` falls through
    // to the display name if the three-part name isn't fully
    // populated, and finally empty — at which point the backend will
    // 400 and the catch-all branch surfaces the localized message.
    const name = profile
      ? getFullName(profile) || getDisplayName(profile)
      : '';

    setSubmitting(true);
    const result = await submitComplaint({ name, type, message: trimmed });
    setSubmitting(false);

    if (result.ok) {
      toast.success(t('feedback.submitSuccess'));
      onClose();
      return;
    }

    if (result.reason === 'not_configured') {
      toast.error(t('feedback.serviceUnavailable'));
      return;
    }
    if (result.reason === 'validation') {
      toast.error(t('feedback.submitInvalid'));
      return;
    }
    if (result.reason === 'delivery') {
      // Backend accepted the request but no admin chat received the
      // Telegram message. We keep the modal open so the user can
      // retry later (their text isn't lost) and surface a specific
      // toast so they don't think it succeeded.
      toast.error(t('feedback.submitDeliveryFailed'));
      return;
    }
    // 'network' or any other failure mode — generic retry message.
    toast.error(t('feedback.submitFailed'));
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

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t('feedback.typeLabel')}
          </label>
          <ToggleGroup
            options={typeOptions}
            value={type}
            onChange={(v) => setType(v as ComplaintType)}
            disabled={submitting}
            size="sm"
          />
        </div>

        <div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={COMPLAINT_MESSAGE_MAX}
            disabled={submitting}
            placeholder={t('feedback.placeholder')}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          />
          <p
            className={`mt-1 text-xs ${
              tooLong ? 'text-destructive' : 'text-muted'
            }`}
          >
            {t('feedback.messageCounter').replace(
              '{{n}}',
              String(trimmed.length),
            )}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          >
            {submitting ? t('feedback.sending') : t('feedback.send')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default FeedbackModal;
