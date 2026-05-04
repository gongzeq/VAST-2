import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
}

export interface ToastContextValue {
  toasts: Toast[];
  pushToast: (tone: ToastTone, message: string) => void;
  dismissToast: (id: string) => void;
}

export const ToastContextReact = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-800',
};

export interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((tone: ToastTone, message: string) => {
    toastIdCounter += 1;
    const id = `toast_${toastIdCounter}`;
    setToasts((prev) => [...prev, { id, tone, message }]);
    // Auto-dismiss after 4s.
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, pushToast, dismissToast }),
    [toasts, pushToast, dismissToast],
  );

  return (
    <ToastContextReact.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        data-testid="toast-region"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded border px-3 py-2 text-sm shadow ${TONE_CLASS[toast.tone]}`}
            role="status"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContextReact.Provider>
  );
}
