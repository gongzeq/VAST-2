import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  actorContextSchema,
  type ActorContext,
} from '@/shared/contracts/actor-context.contract';

const STORAGE_KEY = 'sap.web.actor';

export interface ActorContextValue {
  actor: ActorContext | null;
  setActor: (actor: ActorContext) => void;
  clearActor: () => void;
}

export const ActorContextReact = createContext<ActorContextValue | null>(null);

function loadFromStorage(): ActorContext | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = actorContextSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface ActorProviderProps {
  /**
   * Initial actor for tests; in production, the storage layer is consulted.
   */
  initialActor?: ActorContext | null;
  children: ReactNode;
}

export function ActorProvider({ initialActor, children }: ActorProviderProps) {
  const [actor, setActorState] = useState<ActorContext | null>(() => {
    if (initialActor !== undefined) return initialActor;
    if (typeof window !== 'undefined') return loadFromStorage();
    return null;
  });

  // Hydrate from storage on mount in case SSR-like environments delay.
  useEffect(() => {
    if (initialActor !== undefined || actor !== null) return;
    const stored = loadFromStorage();
    if (stored !== null) setActorState(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActor = useCallback((next: ActorContext) => {
    setActorState(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // sessionStorage might be unavailable (private mode, tests). Continue.
    }
  }, []);

  const clearActor = useCallback(() => {
    setActorState(null);
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<ActorContextValue>(
    () => ({ actor, setActor, clearActor }),
    [actor, setActor, clearActor],
  );

  return (
    <ActorContextReact.Provider value={value}>
      {children}
    </ActorContextReact.Provider>
  );
}
