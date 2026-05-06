import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  killSwitchStateSchema,
  type KillSwitchState,
  type KillSwitchToggleRequest,
} from '@/shared/contracts';

import { useAdminMutation } from './use-admin-mutation';

export function useKillSwitchState() {
  return useQuery({
    queryKey: queryKeys.killSwitchState(),
    queryFn: () => fetchJson('/api/admin/kill-switch', killSwitchStateSchema),
  });
}

export function useToggleKillSwitch() {
  return useAdminMutation<KillSwitchToggleRequest, KillSwitchState>({
    mutationFn: (input) =>
      fetchJson('/api/admin/kill-switch/toggle', killSwitchStateSchema, {
        method: 'POST',
        body: input,
      }),
    // Invalidate the kill switch query; audit-log query keys depend on the
    // current filters so consumers should manually refetch if they care.
    invalidateKeys: [queryKeys.killSwitchState()],
    successMessage: 'Kill Switch 状态已更新',
  });
}
