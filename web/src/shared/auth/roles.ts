/**
 * Preset role bundles used by mock login + dev actor switcher.
 * Permission point names mirror src/shared/contracts/foundation.ts exactly.
 */
import type { ActorContext, PermissionPoint } from '@/shared/contracts';

export type PresetRoleId = 'security-engineer' | 'admin' | 'auditor' | 'viewer';

export const presetRoleIds: readonly PresetRoleId[] = [
  'security-engineer',
  'admin',
  'auditor',
  'viewer',
];

const ROLE_PERMISSIONS: Record<PresetRoleId, PermissionPoint[]> = {
  'security-engineer': [
    'task:create',
    'task:confirm',
    'task:cancel',
    'task:yolo_execute',
    'raw_evidence:view',
  ],
  admin: [
    'asset_scope:manage',
    'audit_log:view',
    'log_source:manage',
    'llm_provider:manage',
    'tool_config:manage',
    'kill_switch:operate',
  ],
  auditor: ['audit_log:view', 'raw_evidence:view'],
  viewer: ['dashboard:view'],
};

const ROLE_LABELS: Record<PresetRoleId, string> = {
  'security-engineer': '安全工程师',
  admin: '平台管理员',
  auditor: '安全审计员',
  viewer: '管理层只读用户',
};

export function permissionsForRole(roleId: PresetRoleId): PermissionPoint[] {
  return [...ROLE_PERMISSIONS[roleId]];
}

export function labelForRole(roleId: PresetRoleId): string {
  return ROLE_LABELS[roleId];
}

export function isPresetRoleId(value: unknown): value is PresetRoleId {
  return typeof value === 'string' && presetRoleIds.includes(value as PresetRoleId);
}

export function buildActorContextFromRole(
  username: string,
  roleId: PresetRoleId,
): ActorContext {
  return {
    actorId: `actor_${username || roleId}`,
    roleIds: [roleId],
    permissionPoints: permissionsForRole(roleId),
    // Preset asset groups; the MSW DB exposes the same ids in fixtures.
    assetGroupIds: ['ag_corp_internal', 'ag_corp_public'],
    yoloEnabled: false,
  };
}
