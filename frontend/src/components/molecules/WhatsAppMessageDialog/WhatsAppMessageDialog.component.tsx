/**
 * WhatsAppMessageDialog — editable confirmation message + send button.
 *
 * Used by the admin to dispatch the post-registration confirmation
 * message to a newly-registered teacher (or any user with a phone).
 * The message comes from `lib/whatsappTemplates` so it's grep-able and
 * localStorage-persistable.
 *
 * Atomic-design fit:
 *   - atoms: Modal, Button, Textarea, Label, HelpText
 *   - molecule: this dialog, owns its draft state but delegates
 *     persistence to the templates module.
 *
 * Send flow:
 *   - "Send via WhatsApp" → opens `https://wa.me/<digits>?text=<encoded>`
 *     in a new tab. The WhatsApp Business app on the admin's device
 *     handles the link the same way as the consumer app, so no
 *     separate URL scheme is needed.
 *   - "Save as default" persists the draft so the next send starts
 *     from the customized copy.
 *   - "Reset" wipes the localStorage override.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../atoms/Modal';
import { Button } from '../../atoms/Button';
import { Textarea } from '../../atoms/Input';
import { Label, HelpText } from '../../atoms/Text';
import { useTranslation } from '../../../locales/i18n';
import { buildWhatsAppLink } from '../../../lib/utils';
import {
  DEFAULT_TEACHER_CONFIRMATION,
  loadTeacherConfirmationTemplate,
  renderTemplate,
  saveTeacherConfirmationTemplate,
} from '../../../lib/whatsappTemplates';

export interface WhatsAppMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Recipient's phone number, any common format. */
  phone: string | null | undefined;
  /** Recipient's display name (substituted into `{{name}}` placeholders). */
  name?: string;
}

export function WhatsAppMessageDialog({
  isOpen,
  onClose,
  phone,
  name,
}: WhatsAppMessageDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  // Reset the draft from storage every time the dialog opens, so an
  // admin who saved a customization sees their version pre-rendered
  // with the current recipient's name interpolated.
  useEffect(() => {
    if (!isOpen) return;
    const template = loadTeacherConfirmationTemplate();
    setDraft(renderTemplate(template, { name }));
  }, [isOpen, name]);

  const link = useMemo(() => buildWhatsAppLink(phone, draft), [phone, draft]);
  const canSend = Boolean(link && draft.trim().length > 0);

  const handleSend = () => {
    if (!link) return;
    // open in a new tab — works the same for WhatsApp Business as the
    // consumer app; the device decides which one handles `wa.me`.
    window.open(link, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleSaveDefault = () => {
    // Save the template WITHOUT the interpolated name — re-add the
    // {{name}} placeholder if the admin wants it dynamic on future
    // sends. We persist the raw text the admin typed; nothing is
    // automatically un-interpolated.
    saveTeacherConfirmationTemplate(draft);
  };

  const handleReset = () => {
    saveTeacherConfirmationTemplate(null);
    setDraft(renderTemplate(DEFAULT_TEACHER_CONFIRMATION, { name }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('whatsapp.dialogTitle')}
      size="lg"
    >
      <div className="space-y-3">
        <div>
          <Label>{t('whatsapp.messageLabel')}</Label>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={14}
            // dir="auto" lets the browser flip RTL/LTR per paragraph
            // so Arabic + emojis render correctly side-by-side.
            dir="auto"
            placeholder={t('whatsapp.messagePlaceholder')}
          />
          <HelpText>{t('whatsapp.messageHelp')}</HelpText>
        </div>

        {!phone && (
          <p className="text-sm text-destructive">
            {t('whatsapp.noPhone')}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
            >
              {t('whatsapp.reset')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveDefault}
            >
              {t('whatsapp.saveDefault')}
            </Button>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={handleSend}
              disabled={!canSend}
            >
              {t('whatsapp.send')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default WhatsAppMessageDialog;
