import { describe, expect, it } from 'vitest';
import { permissionsForRole, presetRoleIds } from '@/shared/auth/roles';

describe('preset role bundles match PRD R2', () => {
  it('exposes the four canonical preset role ids', () => {
    expect(presetRoleIds).toEqual(['security-engineer', 'admin', 'auditor', 'viewer']);
  });

  it('security-engineer can run task verbs and view raw evidence', () => {
    expect(permissionsForRole('security-engineer')).toEqual([
      'task:create',
      'task:confirm',
      'task:cancel',
      'task:yolo_execute',
      'raw_evidence:view',
    ]);
  });

  it('admin manages asset scope, audit log, log sources, LLM providers, tool configs, and kill switch', () => {
    const perms = permissionsForRole('admin');
    expect(perms).toEqual(
      expect.arrayContaining([
        'asset_scope:manage',
        'audit_log:view',
        'log_source:manage',
        'llm_provider:manage',
        'tool_config:manage',
        'kill_switch:operate',
      ]),
    );
    // admin must NOT carry weak-password cleartext export by default
    expect(perms).not.toContain('weak_password:cleartext_export');
  });

  it('auditor can view audit log and raw evidence but cannot mutate configs', () => {
    expect(permissionsForRole('auditor')).toEqual(['audit_log:view', 'raw_evidence:view']);
  });

  it('viewer is dashboard-only', () => {
    const perms = permissionsForRole('viewer');
    expect(perms).toEqual(['dashboard:view']);
    expect(perms).not.toContain('raw_evidence:view');
    expect(perms).not.toContain('audit_log:view');
  });
});
