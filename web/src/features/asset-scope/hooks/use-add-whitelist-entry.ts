import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  asAssetGroupId,
  assetGroupSchema,
  type AssetGroup,
  type AssetWhitelistEntry,
} from '@/shared/contracts';

export type WhitelistEntryInput =
  | { kind: 'root_domain'; rootDomain: string; allowSubdomains: boolean }
  | { kind: 'cidr'; cidr: string }
  | { kind: 'ip'; ip: string };

export interface AddWhitelistInput {
  groupId: string;
  entry: WhitelistEntryInput;
}

export function useAddWhitelistEntry() {
  const qc = useQueryClient();
  return useMutation<AssetGroup, Error, AddWhitelistInput>({
    mutationFn: async ({ groupId, entry }) =>
      fetchJson(
        `/api/asset-groups/${encodeURIComponent(groupId)}/whitelist-entries`,
        assetGroupSchema,
        { method: 'POST', body: entry },
      ),
    onSuccess: (group) => {
      qc.invalidateQueries({
        queryKey: queryKeys.assetGroup(asAssetGroupId(group.assetGroupId)),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.assetGroups(),
      });
    },
  });
}

// Re-export the AssetWhitelistEntry type for component callers.
export type { AssetWhitelistEntry };
