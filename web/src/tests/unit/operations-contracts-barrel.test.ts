/**
 * PR5 cross-feature consistency: ensure every PR1-introduced contract surfaces
 * via the shared barrel `web/src/shared/contracts/index.ts`.
 */
import { describe, expect, it } from 'vitest';

import * as contracts from '@/shared/contracts';

describe('shared contracts barrel re-exports operations contracts', () => {
  it('dashboard summary schema is exported', () => {
    expect(typeof contracts.dashboardSummarySchema?.parse).toBe('function');
    expect(contracts.dashboardCategoryKinds).toContain('task');
    expect(contracts.dashboardCategoryKinds).toContain('log-attack');
  });

  it('audit log schema is exported with mask-by-contract literals', () => {
    expect(typeof contracts.auditLogEntrySchema?.parse).toBe('function');
    // The mask field must reject any non-literal value:
    expect(() =>
      contracts.auditLogEntrySchema.parse({
        auditLogEntryId: 'a1',
        occurredAt: '2026-05-04T00:00:00Z',
        actorId: 'actor_x',
        roleIds: [],
        action: 'task.create',
        targetKind: 'task',
        targetId: 't1',
        outcome: 'SUCCESS',
        clearTextPassword: 'leak123',
      }),
    ).toThrow();
  });

  it('admin config schemas are exported', () => {
    expect(typeof contracts.llmProviderSchema?.parse).toBe('function');
    expect(typeof contracts.toolConfigSchema?.parse).toBe('function');
    expect(typeof contracts.logSourceSchema?.parse).toBe('function');
    expect(typeof contracts.mailSourceSchema?.parse).toBe('function');
    expect(typeof contracts.killSwitchStateSchema?.parse).toBe('function');
  });

  it('foundation permissionPoints includes the 4 PR1 additions', () => {
    expect(contracts.permissionPoints).toContain('dashboard:view');
    expect(contracts.permissionPoints).toContain('llm_provider:manage');
    expect(contracts.permissionPoints).toContain('tool_config:manage');
    expect(contracts.permissionPoints).toContain('kill_switch:operate');
  });
});
