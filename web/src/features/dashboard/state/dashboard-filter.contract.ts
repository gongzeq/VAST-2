/**
 * URL state parser/serializer for the dashboard surface.
 *
 * Mirrors the vulnerability-list-filter pattern: a zod schema validates the
 * raw search params at the boundary; bad values fall back to defaults so the
 * page never crashes from a hand-edited URL.
 *
 * The shape feeds two consumers:
 *   - `useDashboardSummary({ scope, assetGroupIds })` — server fetch
 *   - `queryKeys.dashboardSummary({ scope, assetGroupIds })` — TanStack key
 *
 * `assetGroupIds` is sorted before serialization so that {a,b} and {b,a}
 * collapse to the same query key (avoids spurious refetches when the user
 * toggles selections in different orders).
 */
import { z } from 'zod';

import { dashboardScopeSchema } from '@/shared/contracts/dashboard-summary.contract';

export const dashboardFilterSchema = z.object({
  scope: dashboardScopeSchema.default('owned'),
  /**
   * Selected asset-group IDs. Empty array means "all owned" (or "all" when
   * scope=global) — the MSW handler already implements this semantic; the
   * page passes the array through verbatim.
   */
  assetGroupIds: z.array(z.string().min(1)).default([]),
});

export type DashboardFilter = z.infer<typeof dashboardFilterSchema>;

const FALLBACK: DashboardFilter = { scope: 'owned', assetGroupIds: [] };

export function parseDashboardFilter(searchParams: URLSearchParams): DashboardFilter {
  const rawScope = searchParams.get('scope') ?? undefined;
  const rawIds = searchParams.get('assetGroupIds') ?? '';
  const ids = rawIds
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const result = dashboardFilterSchema.safeParse({
    scope: rawScope,
    assetGroupIds: ids,
  });
  if (!result.success) return FALLBACK;

  return {
    scope: result.data.scope,
    assetGroupIds: [...result.data.assetGroupIds].sort(),
  };
}

export function serializeDashboardFilter(filter: DashboardFilter): URLSearchParams {
  const sp = new URLSearchParams();
  if (filter.scope !== 'owned') sp.set('scope', filter.scope);
  if (filter.assetGroupIds.length > 0) {
    sp.set('assetGroupIds', [...filter.assetGroupIds].sort().join(','));
  }
  return sp;
}
