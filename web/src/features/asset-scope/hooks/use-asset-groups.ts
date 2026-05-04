import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  assetGroupListResponseSchema,
  type AssetGroupListResponse,
} from '@/shared/contracts';

export function useAssetGroups() {
  return useQuery<AssetGroupListResponse, Error>({
    queryKey: queryKeys.assetGroups(),
    queryFn: async () =>
      fetchJson('/api/asset-groups', assetGroupListResponseSchema, { method: 'GET' }),
  });
}
