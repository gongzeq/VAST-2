/**
 * Asset-group filter for the dashboard.
 *
 * - Scope toggle (owned / global). Global is disabled when the actor lacks
 *   `asset_scope:manage` (matches MSW handler gate at
 *   `web/src/app/msw/handlers/dashboard-handlers.ts:43`).
 * - Multi-select listing the actor's owned asset groups (with names from
 *   `useAssetGroups()`). When `scope=global` the full asset-group list is
 *   shown — behaviour aligned with the MSW handler.
 * - State changes flow through `onChange` so the page can write to the URL.
 */
import { useAssetGroups } from '@/features/asset-scope/hooks/use-asset-groups';
import { Select } from '@/shared/components';
import { useCanManageAssetScope } from '@/shared/hooks/use-can';
import { useCurrentActor } from '@/shared/hooks/use-current-actor';

import type { DashboardFilter } from '../state/dashboard-filter.contract';

export interface AssetGroupFilterProps {
  value: DashboardFilter;
  onChange: (next: DashboardFilter) => void;
}

export function AssetGroupFilter({ value, onChange }: AssetGroupFilterProps) {
  const { actor } = useCurrentActor();
  const canGlobal = useCanManageAssetScope();
  const assetGroupsQuery = useAssetGroups();

  const allGroups = assetGroupsQuery.data?.items ?? [];
  // Owned scope only sees actor's groups; global scope sees all.
  const visibleGroups =
    value.scope === 'global'
      ? allGroups
      : allGroups.filter((g) => actor?.assetGroupIds.includes(g.assetGroupId) ?? false);

  const handleScopeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextScope = event.target.value === 'global' ? 'global' : 'owned';
    onChange({ scope: nextScope, assetGroupIds: [] });
  };

  const handleGroupChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(event.target.selectedOptions).map((o) => o.value);
    onChange({ ...value, assetGroupIds: [...selected].sort() });
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end" data-testid="dashboard-asset-group-filter">
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
        范围
        <Select
          aria-label="仪表盘范围"
          value={value.scope}
          onChange={handleScopeChange}
          className="sm:w-40"
        >
          <option value="owned">已授权资产组</option>
          <option value="global" disabled={!canGlobal}>
            {canGlobal ? '全局视图' : '全局视图（需 asset_scope:manage）'}
          </option>
        </Select>
      </label>
      <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-gray-700">
        资产组（多选；为空表示全部）
        <Select
          aria-label="资产组多选"
          multiple
          value={value.assetGroupIds}
          onChange={handleGroupChange}
          className="min-h-20"
        >
          {visibleGroups.map((group) => (
            <option key={group.assetGroupId} value={group.assetGroupId}>
              {group.name}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
