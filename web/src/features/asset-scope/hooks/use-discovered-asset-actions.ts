import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  discoveredAssetRecordSchema,
  type DiscoveredAssetRecord,
} from '@/shared/contracts';

export interface DiscoveredAssetMutationInput {
  discoveredAssetId: string;
}

export function useConfirmDiscoveredAsset() {
  const qc = useQueryClient();
  return useMutation<DiscoveredAssetRecord, Error, DiscoveredAssetMutationInput>({
    mutationFn: async ({ discoveredAssetId }) =>
      fetchJson(
        `/api/discovered-assets/${encodeURIComponent(discoveredAssetId)}/confirm`,
        discoveredAssetRecordSchema,
        { method: 'POST' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.discoveredAssets(undefined) });
      qc.invalidateQueries({ queryKey: ['discovered-assets'] });
      qc.invalidateQueries({ queryKey: queryKeys.assetGroups() });
      qc.invalidateQueries({ queryKey: ['asset-group'] });
    },
  });
}

export function useRejectDiscoveredAsset() {
  const qc = useQueryClient();
  return useMutation<DiscoveredAssetRecord, Error, DiscoveredAssetMutationInput>({
    mutationFn: async ({ discoveredAssetId }) =>
      fetchJson(
        `/api/discovered-assets/${encodeURIComponent(discoveredAssetId)}/reject`,
        discoveredAssetRecordSchema,
        { method: 'POST' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovered-assets'] });
    },
  });
}
