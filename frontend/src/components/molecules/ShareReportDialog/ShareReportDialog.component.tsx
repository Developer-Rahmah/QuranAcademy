/**
 * ShareReportDialog — preview + edit + send the WhatsApp share message
 * for a report.
 *
 * Used in two places:
 *   1. ReportForm (create flow) — the dialog's confirm handler is the
 *      "save + share" atomic action: the report row gets written,
 *      then the share dispatcher fires with the (possibly edited)
 *      message text.
 *   2. StudentDashboard per-row share — the report is already saved,
 *      so the confirm handler dispatches the share only.
 *
 * Atomic-design fit:
 *   - atoms used: Modal, Button, Textarea, Label, WhatsappIcon
 *   - the molecule owns its draft state and delegates the actual
 *     work to the parent's `onSend(text)` callback so it can be
 *     reused across surfaces without duplicating save/share logic.
 *
 * The textarea is dir="auto" so Arabic + emoji + Latin glyphs all
 * render in the right direction per-paragraph.
 */
import { useEffect, useState } from 'react';
import { Modal } from '../../atoms/Modal';
import { Button } from '../../atoms/Button';
import { Textarea } from '../../atoms/Input';
import { Label, HelpText } from '../../atoms/Text';
import { WhatsappIcon } from '../../atoms/Icon';
import { useTranslation } from '../../../locales/i18n';

export interface ShareReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Default message text — populated when the dialog opens. Caller
   * builds this via `formatReportForSharing(...)`.
   */
  defaultText: string;
  /**
   * Send handler. Receives the (possibly edited) draft text. The
   * parent is responsible for saving the report (if needed) AND
   * dispatching the share via `shareReportViaWhatsapp`. Returning a
   * Promise keeps the spinner running until both succeed/fail.
   */
  onSend: (text: string) => Promise<void> | void;
  /** Disables the close path + shows the spinner on the send button. */
  loading?: boolean;
}

export function ShareReportDialog({
  isOpen,
  onClose,
  defaultText,
  onSend,
  loading = false,
}: ShareReportDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  // Reset every time the dialog opens so a previous draft from an
  // earlier report doesn't leak into the current preview.
  useEffect(() => {
    if (isOpen) setDraft(defaultText);
  }, [isOpen, defaultText]);

  const canSend = draft.trim().length > 0 && !loading;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!loading) onClose();
      }}
      title={t('report.shareDialogTitle')}
      size="lg"
    >
      <div className="space-y-3">
        <div>
          <Label>{t('report.shareDialogPreview')}</Label>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={14}
            dir="auto"
            disabled={loading}
          />
          <HelpText>{t('report.shareDialogHint')}</HelpText>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="success"
            onClick={() => void onSend(draft)}
            loading={loading}
            disabled={!canSend}
          >
            <WhatsappIcon className="w-4 h-4" />
            {t('report.share')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ShareReportDialog;
