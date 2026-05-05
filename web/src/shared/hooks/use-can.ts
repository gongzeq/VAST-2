import { hasAnyPermission, hasPermission } from '@/shared/auth/permission-helpers';

import { useCurrentActor } from './use-current-actor';

export function useCanCreateTask(): boolean {
  const { actor } = useCurrentActor();
  return hasPermission(actor, 'task:create');
}

export function useCanConfirmTask(): boolean {
  const { actor } = useCurrentActor();
  return hasPermission(actor, 'task:confirm');
}

export function useCanCancelTask(): boolean {
  const { actor } = useCurrentActor();
  return hasPermission(actor, 'task:cancel');
}

export function useCanYoloExecute(): boolean {
  const { actor } = useCurrentActor();
  return hasPermission(actor, 'task:yolo_execute');
}

export function useCanManageAssetScope(): boolean {
  const { actor } = useCurrentActor();
  return hasPermission(actor, 'asset_scope:manage');
}

export function useCanViewAuditLog(): boolean {
  const { actor } = useCurrentActor();
  return hasPermission(actor, 'audit_log:view');
}

export function useCanViewRawEvidence(): boolean {
  const { actor } = useCurrentActor();
  return hasPermission(actor, 'raw_evidence:view');
}

/**
 * Dashboard is visible to any logged-in actor; per-card masking is enforced
 * via category-specific permission checks (e.g., raw_evidence:view for the
 * vulnerability card). The hook still exists so layout/router code can read a
 * single name without spreading literal strings.
 */
export function useCanViewDashboard(): boolean {
  const { actor } = useCurrentActor();
  return Boolean(actor);
}

export function useCanManageLlmProvider(): boolean {
  const { actor } = useCurrentActor();
  return hasPermission(actor, 'llm_provider:manage');
}

export function useCanManageToolConfig(): boolean {
  const { actor } = useCurrentActor();
  return hasPermission(actor, 'tool_config:manage');
}

export function useCanManageLogSource(): boolean {
  const { actor } = useCurrentActor();
  return hasPermission(actor, 'log_source:manage');
}

/**
 * Mail source has no dedicated permission point in PRD §3; treat any
 * admin-class actor (asset_scope:manage OR log_source:manage OR
 * llm_provider:manage OR tool_config:manage) as authorized.
 */
export function useCanManageMailSource(): boolean {
  const { actor } = useCurrentActor();
  return hasAnyPermission(actor, [
    'asset_scope:manage',
    'log_source:manage',
    'llm_provider:manage',
    'tool_config:manage',
  ]);
}

export function useCanOperateKillSwitch(): boolean {
  const { actor } = useCurrentActor();
  return hasPermission(actor, 'kill_switch:operate');
}

/**
 * Aggregate gate used by the top-level "管理" nav grouping. Returns true if
 * actor can manage any of the 5 admin blocks.
 */
export function useCanManageAdminConfig(): boolean {
  const { actor } = useCurrentActor();
  return hasAnyPermission(actor, [
    'llm_provider:manage',
    'tool_config:manage',
    'log_source:manage',
    'asset_scope:manage',
    'kill_switch:operate',
  ]);
}
