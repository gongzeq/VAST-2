import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { Button } from './Button';
import { cn } from './class-names';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** When true, focuses the close button initially. */
  initialFocusOnCancel?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  initialFocusOnCancel = true,
}: DialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && initialFocusOnCancel) {
      cancelRef.current?.focus();
    }
  }, [open, initialFocusOnCancel]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div className="w-full max-w-lg rounded bg-white p-6 shadow-xl">
        <div className="mb-3">
          <h2 id="dialog-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          {description !== undefined ? (
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          ) : null}
        </div>
        <div className="text-sm text-gray-800">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onClose}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}
