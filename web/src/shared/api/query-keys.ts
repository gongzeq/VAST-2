/**
 * Central registry of TanStack Query keys. Keeps domain boundaries explicit
 * and prevents accidental key collisions across features.
 */
import type { AssetDiscoveryState } from '@/shared/contracts/foundation';
import type {
  AssetGroupId,
  DiscoveredAssetId,
  LlmProviderId,
  LogSourceId,
  MailSourceId,
  TaskId,
} from '@/shared/contracts/branded-ids';
import type { ToolName } from '@/shared/contracts/admin-config.contract';
import type {
  AuditAction,
  AuditOutcome,
  AuditTargetKind,
} from '@/shared/contracts/audit-log.contract';
import type { DashboardScope } from '@/shared/contracts/dashboard-summary.contract';

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

export interface DashboardSummaryFilters {
  scope: DashboardScope;
  /** Sorted asset-group IDs to keep query keys stable across re-renders. */
  assetGroupIds: string[];
}

export interface AuditLogFilters {
  actorIds: string[];
  actions: AuditAction[];
  outcomes: AuditOutcome[];
  targetKind?: AuditTargetKind;
  targetIdQuery?: string;
  since?: string;
  until?: string;
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
  dashboardSummary: (filters: DashboardSummaryFilters) =>
    ['dashboard-summary', filters] as const,
  auditLog: (filters: AuditLogFilters) => ['audit-log', filters] as const,
  llmProviders: () => ['llm-providers'] as const,
  llmProvider: (id: LlmProviderId) => ['llm-provider', id] as const,
  toolConfigs: () => ['tool-configs'] as const,
  toolConfig: (tool: ToolName) => ['tool-config', tool] as const,
  logSources: () => ['log-sources'] as const,
  logSource: (id: LogSourceId) => ['log-source', id] as const,
  mailSources: () => ['mail-sources'] as const,
  mailSource: (id: MailSourceId) => ['mail-source', id] as const,
  killSwitchState: () => ['kill-switch-state'] as const,
};
