/**
 * ConfirmDialog Molecule
 *
 * Reusable yes/no confirmation built on the existing Modal atom +
 * Button atom. Used for destructive actions (e.g. report delete) where
 * an accidental click would be costly.
 *
 * Atomic-design fit:
 *   - atoms used: Modal, Button
 *   - exposes a controlled `isOpen` prop so the caller owns the state
 *
 * The confirm button renders as `destructive` by default but can be
 * swapped to any variant — keeps the molecule reusable for non-delete
 * confirmations later.
 */
import { useTranslation } from '../../../locales/i18n';
import { Modal } from '../../atoms/Modal';
import { Button } from '../../atoms/Button';
import type { ButtonVariant } from '../../atoms/Button/Button.types';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  confirmVariant = 'destructive',
  loading = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        {body && <p className="text-sm text-muted leading-relaxed">{body}</p>}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            size="md"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel ?? t('common.delete')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
