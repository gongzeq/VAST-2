import { useContext } from 'react';

import { ActorContextReact } from '@/app/providers/actor-provider';

export function useCurrentActor() {
  const ctx = useContext(ActorContextReact);
  if (!ctx) {
    throw new Error('useCurrentActor must be used inside <ActorProvider>');
  }
  return ctx;
}
