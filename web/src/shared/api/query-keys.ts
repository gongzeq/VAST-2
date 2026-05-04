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

export interface VulnerabilityGroupFilters {
  assetGroupId?: string;
  severity?: string;
  status?: string;
  q?: string;
  sort: string;
  page: number;
  pageSize: number;
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
  vulnerabilityGroups: (filters: VulnerabilityGroupFilters) =>
    ['vulnerability-groups', filters] as const,
  vulnerabilityGroup: (vulnerabilityId: string) =>
    ['vulnerability-group', vulnerabilityId] as const,
};
