/**
 * SupervisorAssignmentDialog
 *
 * Admin surface for assigning a volunteer supervisor (`halaqah_supervisor`)
 * to one, several, or all halaqahs. Assignment is RELATIONAL: each checked
 * halaqah becomes a row in `halaqah_supervisors` via `api.supervisors`.
 * This is NOT a role change — the account's `profile.role` is untouched.
 *
 * Authorization: writes to `halaqah_supervisors` are restricted by RLS to
 * admin / supervisor_manager (migration 0010). The caller additionally
 * gates this dialog behind `canManageSupervisors(viewerRole)` so the button
 * is hidden from everyone else; RLS is the real boundary.
 *
 * "All halaqahs" = an explicit row per existing halaqah (Select all). There
 * is no global-access flag in the schema, so halaqahs created LATER are not
 * auto-included — the admin re-opens this dialog to add them. This keeps
 * access per-row and fully enforceable by RLS (no unrestricted shortcut).
 */
import { useEffect, useState } from 'react';
import { Modal } from '../../atoms/Modal';
import { Button } from '../../atoms/Button';
import { Checkbox } from '../../atoms/Checkbox';
import { Badge } from '../../atoms/Badge';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../locales/i18n';
import { api } from '../../../lib/supabase';
import type { Halaqah } from '../../../types';

export interface SupervisorAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The supervisor profile being assigned. */
  userId: string;
  /** Display name for the dialog title. */
  userName: string;
  /** Called after a successful save so the parent can refresh if needed. */
  onSaved?: () => void;
}

export function SupervisorAssignmentDialog({
  isOpen,
  onClose,
  userId,
  userName,
  onSaved,
}: SupervisorAssignmentDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [halaqahs, setHalaqahs] = useState<Halaqah[]>([]);
  // `original` = assignments as stored when the dialog opened; `selected` =
  // the admin's in-progress choice. The diff between them drives the
  // assign/remove calls on save, so untouched rows cause no writes.
  const [original, setOriginal] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [halaqahsRes, assignmentsRes] = await Promise.all([
        api.halaqah.list(),
        api.supervisors.listByUser(userId),
      ]);
      if (cancelled) return;
      setHalaqahs(halaqahsRes.data ?? []);
      const assigned = new Set((assignmentsRes.data ?? []).map((a) => a.halaqah_id));
      setOriginal(assigned);
      setSelected(new Set(assigned));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, userId]);

  const toggle = (halaqahId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(halaqahId)) next.delete(halaqahId);
      else next.add(halaqahId);
      return next;
    });
  };

  const allSelected = halaqahs.length > 0 && selected.size === halaqahs.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(halaqahs.map((h) => h.id)));
  };

  const handleSave = async () => {
    const toAdd = [...selected].filter((id) => !original.has(id));
    const toRemove = [...original].filter((id) => !selected.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    let failures = 0;
    try {
      for (const id of toAdd) {
        try {
          await api.supervisors.assign(userId, id);
        } catch {
          failures += 1;
        }
      }
      for (const id of toRemove) {
        const { error } = await api.supervisors.remove(userId, id);
        if (error) failures += 1;
      }
    } finally {
      setSaving(false);
    }

    if (failures > 0) {
      toast.error(t('admin.assignmentsSaveFailed'));
    } else {
      toast.success(t('admin.assignmentsSaved'));
    }
    onSaved?.();
    onClose();
  };

  const segmentBadge = (segment?: string) => {
    if (segment === 'men') return <Badge variant="secondary">{t('segment.men')}</Badge>;
    if (segment === 'women') return <Badge variant="secondary">{t('segment.women')}</Badge>;
    return null;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('admin.assignHalaqahsTitle', { name: userName })}
      size="md"
    >
      <p className="text-sm text-muted mb-4">{t('admin.assignHalaqahsHelp')}</p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : halaqahs.length === 0 ? (
        <p className="text-center text-muted py-8">{t('admin.noHalaqahsAvailable')}</p>
      ) : (
        <>
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
            <span className="text-sm text-muted">
              {t('admin.assignedCount', {
                n: selected.size,
                total: halaqahs.length,
              })}
            </span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-sm text-primary hover:underline"
            >
              {allSelected ? t('admin.clearAllHalaqahs') : t('admin.selectAllHalaqahs')}
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {halaqahs.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between gap-2 py-1.5 px-1 rounded hover:bg-muted/20"
              >
                <Checkbox
                  label={h.name}
                  checked={selected.has(h.id)}
                  onChange={() => toggle(h.id)}
                />
                {segmentBadge(h.segment)}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-3 justify-end mt-6">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={loading}>
          {t('common.save')}
        </Button>
      </div>
    </Modal>
  );
}

export default SupervisorAssignmentDialog;
