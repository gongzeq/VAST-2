import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  type AssetDiscoveryState,
  discoveredAssetListResponseSchema,
  type DiscoveredAssetListResponse,
} from '@/shared/contracts';

export interface UseDiscoveredAssetsArgs {
  state?: AssetDiscoveryState;
}

export function useDiscoveredAssets({ state }: UseDiscoveredAssetsArgs = {}) {
  return useQuery<DiscoveredAssetListResponse, Error>({
    queryKey: queryKeys.discoveredAssets(state),
    queryFn: async () => {
      const url =
        state !== undefined
          ? `/api/discovered-assets?state=${encodeURIComponent(state)}`
          : '/api/discovered-assets';
      return fetchJson(url, discoveredAssetListResponseSchema, { method: 'GET' });
    },
  });
}
