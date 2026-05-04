/**
 * Central registry of TanStack Query keys. Keeps domain boundaries explicit
 * and prevents accidental key collisions across features.
 */
import type { AssetDiscoveryState } from '@/shared/contracts/foundation';
import type {
  AssetGroupId,
  DiscoveredAssetId,
  TaskId,
} from '@/shared/contracts/branded-ids';

export interface TaskListFilters {
  workflowType?: string;
  lifecycleStage?: string;
  assignee?: string;
  page: number;
  pageSize: number;
  sort?: string;
}

export const queryKeys = {
  authSession: () => ['auth-session'] as const,
  taskList: (filters: TaskListFilters) =>
    ['task-list', filters] as const,
  taskDetail: (taskId: TaskId) => ['task-detail', taskId] as const,
  assetGroups: () => ['asset-groups'] as const,
  assetGroup: (assetGroupId: AssetGroupId) =>
    ['asset-group', assetGroupId] as const,
  discoveredAssets: (state: AssetDiscoveryState | undefined) =>
    ['discovered-assets', state ?? null] as const,
  discoveredAsset: (id: DiscoveredAssetId) =>
    ['discovered-asset', id] as const,
};
