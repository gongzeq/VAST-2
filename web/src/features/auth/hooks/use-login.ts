import { useMutation } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { actorContextSchema, type ActorContext } from '@/shared/contracts/actor-context.contract';
import type { PresetRoleId } from '@/shared/auth/roles';
import { useCurrentActor } from '@/shared/hooks/use-current-actor';

export interface LoginInput {
  username: string;
  roleId: PresetRoleId;
}

export function useLogin() {
  const { setActor } = useCurrentActor();
  return useMutation<ActorContext, Error, LoginInput>({
    mutationFn: async (input) => {
      return fetchJson('/api/auth/session', actorContextSchema, {
        method: 'POST',
        body: input,
      });
    },
    onSuccess: (actor) => {
      setActor(actor);
    },
  });
}
