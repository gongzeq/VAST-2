import { describe, expect, it } from 'vitest';

import { hasPermission, hasAnyPermission } from '@/shared/auth/permission-helpers';
import {
  buildActorContextFromRole,
  permissionsForRole,
  presetRoleIds,
} from '@/shared/auth/roles';

describe('permission helpers', () => {
  it('returns false when actor is null', () => {
    expect(hasPermission(null, 'task:create')).toBe(false);
  });

  it('rejects unknown permission point gracefully', () => {
    const actor = buildActorContextFromRole('alice', 'security-engineer');
    // Type-cast a known-bad point. Helper should still return false.
    expect(hasPermission(actor, 'log_event:export')).toBe(false);
  });

  describe.each(presetRoleIds)('preset role %s', (role) => {
    const actor = buildActorContextFromRole('user', role);
    const perms = permissionsForRole(role);

    it('grants exactly the documented permission points', () => {
      for (const p of perms) {
        expect(hasPermission(actor, p)).toBe(true);
      }
    });

    it('denies points not in the role bundle', () => {
      const denied = (
        [
          'task:create',
          'task:confirm',
          'task:cancel',
          'task:yolo_execute',
          'asset_scope:manage',
          'audit_log:view',
          'log_source:manage',
          'report:export',
        ] as const
      ).filter((p) => !perms.includes(p));
      for (const p of denied) {
        expect(hasPermission(actor, p)).toBe(false);
      }
    });
  });

  it('hasAnyPermission returns true if any matches', () => {
    const actor = buildActorContextFromRole('alice', 'security-engineer');
    expect(hasAnyPermission(actor, ['report:export', 'task:create'])).toBe(true);
    expect(hasAnyPermission(actor, ['report:export', 'log_event:export'])).toBe(false);
  });

  it('viewer role is dashboard-only', () => {
    expect(permissionsForRole('viewer')).toEqual(['dashboard:view']);
  });

  it('security-engineer has the four task permissions plus raw evidence', () => {
    expect(new Set(permissionsForRole('security-engineer'))).toEqual(
      new Set([
        'task:create',
        'task:confirm',
        'task:cancel',
        'task:yolo_execute',
        'raw_evidence:view',
      ]),
    );
  });

  it('admin has asset_scope:manage and log_source:manage', () => {
    const perms = new Set(permissionsForRole('admin'));
    expect(perms.has('asset_scope:manage')).toBe(true);
    expect(perms.has('log_source:manage')).toBe(true);
    expect(perms.has('task:create')).toBe(false);
  });
});
