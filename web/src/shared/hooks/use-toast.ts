import { useContext } from 'react';

import { ToastContextReact } from '@/app/providers/toast-provider';

export function useToast() {
  const ctx = useContext(ToastContextReact);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}
