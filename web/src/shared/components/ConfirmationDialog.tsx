import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { Button } from './Button';

export interface ConfirmationDialogProps {
  open: boolean;
  /**
   * Action description such as "执行高强度任务" — must be free-form text, not
   * an icon, per quality-guidelines.md.
   */
  actionDescription: string;
  /** Target scope summary, e.g. "资产组 ag_corp_internal · 3 个域名". */
  targetScope: string;
  /** Risk level text. Always rendered; never icon-only. */
  riskLevelText: string;
  /** Optional extra body (e.g. a list of tools). */
  children?: ReactNode;
  /** Called when the user clicks the explicit Confirm button. */
  onConfirm: () => void;
  /** Called when the dialog is dismissed without confirming (Cancel/Esc/backdrop). */
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Two-step confirmation. Closing the dialog without explicitly clicking the
 * Confirm button MUST NOT trigger the action. Tests assert this contract.
 */
export function ConfirmationDialog({
  open,
  actionDescription,
  targetScope,
  riskLevelText,
  children,
  onConfirm,
  onCancel,
  confirmLabel = '确认执行',
  cancelLabel = '取消',
}: ConfirmationDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-title"
      data-testid="confirmation-dialog"
    >
      <div className="w-full max-w-lg rounded bg-white p-6 shadow-xl">
        <h2
          id="confirmation-title"
          className="mb-2 text-lg font-semibold text-gray-900"
        >
          确认操作
        </h2>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-gray-500">操作</dt>
            <dd className="text-gray-900">{actionDescription}</dd>
          </div>
          <div>
            <dt className="text-gray-500">目标范围</dt>
            <dd className="text-gray-900">{targetScope}</dd>
          </div>
          <div>
            <dt className="text-gray-500">风险等级</dt>
            <dd className="font-medium text-red-700">{riskLevelText}</dd>
          </div>
        </dl>
        {children !== undefined ? (
          <div className="mt-3 text-sm text-gray-700">{children}</div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onCancel}
            data-testid="confirmation-cancel"
          >
            {cancelLabel}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            data-testid="confirmation-confirm"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
