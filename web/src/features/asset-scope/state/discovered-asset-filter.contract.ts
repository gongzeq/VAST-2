import { z } from 'zod';

import { assetDiscoveryStateSchema } from '@/shared/contracts/foundation';

export const discoveredAssetFilterSchema = z.object({
  state: assetDiscoveryStateSchema.optional(),
});

export type DiscoveredAssetFilter = z.infer<typeof discoveredAssetFilterSchema>;

export function parseDiscoveredAssetFilter(
  searchParams: URLSearchParams,
): DiscoveredAssetFilter {
  const obj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  const parsed = discoveredAssetFilterSchema.safeParse(obj);
  return parsed.success ? parsed.data : {};
}

export function serializeDiscoveredAssetFilter(
  filter: DiscoveredAssetFilter,
): URLSearchParams {
  const sp = new URLSearchParams();
  if (filter.state) sp.set('state', filter.state);
  return sp;
}
