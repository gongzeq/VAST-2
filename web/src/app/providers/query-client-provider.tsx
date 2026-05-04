import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

export interface AppQueryProviderProps {
  /** When true, retry on failure is disabled — used in tests. */
  noRetry?: boolean;
  children: ReactNode;
}

export function AppQueryProvider({ noRetry, children }: AppQueryProviderProps) {
  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: noRetry ? false : 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: false,
          },
        },
      }),
    [noRetry],
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
