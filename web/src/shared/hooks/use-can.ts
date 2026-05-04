import { hasPermission } from '@/shared/auth/permission-helpers';

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
