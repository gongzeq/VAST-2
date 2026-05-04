import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  asAssetGroupId,
  assetGroupSchema,
  type AssetGroup,
} from '@/shared/contracts';

export function useAssetGroup(groupId: string | undefined) {
  return useQuery<AssetGroup, Error>({
    queryKey: queryKeys.assetGroup(asAssetGroupId(groupId ?? '')),
    enabled: typeof groupId === 'string' && groupId.length > 0,
    queryFn: async () =>
      fetchJson(
        `/api/asset-groups/${encodeURIComponent(groupId ?? '')}`,
        assetGroupSchema,
        { method: 'GET' },
      ),
  });
}
