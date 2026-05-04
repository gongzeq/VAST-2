import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

import { fetchJson } from '@/shared/api/fetch-json';
import { useCurrentActor } from '@/shared/hooks/use-current-actor';

export function useLogout() {
  const { clearActor } = useCurrentActor();
  return useMutation<null, Error, void>({
    mutationFn: async () => {
      await fetchJson('/api/auth/session', z.null(), { method: 'DELETE' });
      return null;
    },
    onSuccess: () => {
      clearActor();
    },
  });
}
