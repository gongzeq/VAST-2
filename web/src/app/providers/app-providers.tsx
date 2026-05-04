import type { ReactNode } from 'react';

import type { ActorContext } from '@/shared/contracts/actor-context.contract';

import { ActorProvider } from './actor-provider';
import { AppQueryProvider } from './query-client-provider';
import { ToastProvider } from './toast-provider';

export interface AppProvidersProps {
  initialActor?: ActorContext | null;
  noRetry?: boolean;
  children: ReactNode;
}

export function AppProviders({ initialActor, noRetry, children }: AppProvidersProps) {
  return (
    <AppQueryProvider noRetry={noRetry}>
      <ActorProvider initialActor={initialActor}>
        <ToastProvider>{children}</ToastProvider>
      </ActorProvider>
    </AppQueryProvider>
  );
}
