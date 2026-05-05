/**
 * PR1 contract verification: dashboard-summary / audit-log / admin-config.
 */
import { describe, expect, it } from 'vitest';

import {
  adminEntityStatusSchema,
  auditLogEntrySchema,
  auditLogListResponseSchema,
  dashboardSummarySchema,
  killSwitchStateSchema,
  killSwitchToggleRequestSchema,
  llmProviderSchema,
  logSourceSchema,
  mailSourceSchema,
  permissionPoints,
  toolConfigSchema,
} from '@/shared/contracts';

describe('foundation permission points (PR1 additions)', () => {
  it('includes the 4 new operations permission points', () => {
    expect(permissionPoints).toContain('dashboard:view');
    expect(permissionPoints).toContain('llm_provider:manage');
    expect(permissionPoints).toContain('tool_config:manage');
    expect(permissionPoints).toContain('kill_switch:operate');
  });
});

describe('dashboardSummarySchema', () => {
  it('accepts a 7-category summary', () => {
    const sample = {
      generatedAt: new Date().toISOString(),
      scope: 'owned',
      assetGroupIds: ['ag_corp_internal'],
      categories: [
        {
          kind: 'task',
          summary: '今日 5 个任务',
          todayTaskCount: 5,
          runningTaskCount: 1,
          byState: [{ state: 'SUCCESS', count: 3 }],
          averageDurationSeconds: 120,
          trend7Days: [],
        },
        {
          kind: 'asset',
          summary: '资产 18',
          authorizedAssetGroupCount: 2,
          discoveredAssetCount: 18,
          liveAssetCount: 14,
          newlyDiscoveredAssetCount: 3,
          exposedPortCount: 27,
          topServices: [],
        },
        {
          kind: 'vulnerability',
          summary: '漏洞 12',
          severityCounts: [{ severity: 'CRITICAL', count: 1 }],
          topTypes: [],
          topRiskAssets: [],
          templateHitTrend: [],
        },
        {
          kind: 'weak-password',
          summary: '弱口令 2',
          weakPasswordAssetCount: 2,
          byServiceType: [],
          trend30Days: [],
        },
        {
          kind: 'mail',
          summary: '邮件 1820',
          todayMailCount: 1820,
          suspectedMailCount: 24,
          riskBucketCounts: [{ bucket: 'clean', count: 1740 }],
          topInduceTypes: [],
          topUrlDomains: [],
          topAttachmentTypes: [],
        },
        {
          kind: 'yolo',
          summary: 'YOLO 4',
          naturalLanguageTaskCount: 18,
          yoloDirectExecutionCount: 4,
          clarificationCount: 5,
          whitelistBlockedCount: 1,
        },
        {
          kind: 'log-attack',
          summary: '日志正常',
          firewallEventCount: 4321,
          webEventCount: 982,
          topAttackTypes: [],
          topSourceIps: [],
          topTargetAssets: [],
          actionDistribution: [],
          topUriPatterns: [],
          httpMethodCounts: [],
          httpStatusCounts: [],
          attackTrend: [],
          spikeAlert: false,
        },
      ],
    };
    expect(() => dashboardSummarySchema.parse(sample)).not.toThrow();
  });

  it('rejects a category with an unknown kind', () => {
    const sample = {
      generatedAt: '2026-05-04T00:00:00Z',
      scope: 'owned',
      assetGroupIds: [],
      categories: [{ kind: 'mystery', summary: 'x' }],
    };
    expect(() => dashboardSummarySchema.parse(sample)).toThrow();
  });
});

describe('auditLogEntrySchema cleartext masking', () => {
  it('accepts an entry where clearTextPassword is the literal redaction marker', () => {
    const entry = {
      auditLogEntryId: 'a1',
      occurredAt: '2026-05-04T00:00:00Z',
      actorId: 'actor_alice',
      roleIds: ['security-engineer'],
      action: 'weak_password.view',
      targetKind: 'task',
      targetId: 'task_x',
      outcome: 'SUCCESS',
      requestPayload: {},
      validationResult: null,
      affectedResources: [],
      clearTextPassword: '[redacted]',
      rawLogBody: null,
      note: null,
    };
    expect(() => auditLogEntrySchema.parse(entry)).not.toThrow();
  });

  it('rejects an entry with an actual cleartext value', () => {
    const entry = {
      auditLogEntryId: 'a1',
      occurredAt: '2026-05-04T00:00:00Z',
      actorId: 'actor_alice',
      roleIds: [],
      action: 'weak_password.view',
      targetKind: 'task',
      targetId: 'task_x',
      outcome: 'SUCCESS',
      clearTextPassword: 'password123',
    };
    expect(() => auditLogEntrySchema.parse(entry)).toThrow();
  });

  it('list response wrapper validates entries and pagination', () => {
    const valid = auditLogListResponseSchema.safeParse({
      entries: [],
      page: 1,
      pageSize: 50,
      total: 0,
    });
    expect(valid.success).toBe(true);
  });
});

describe('admin-config schemas', () => {
  it('llmProviderSchema rejects non-bullet apiKeyMask', () => {
    expect(() =>
      llmProviderSchema.parse({
        llmProviderId: 'l1',
        name: 'x',
        type: 'local',
        status: 'ENABLED',
        baseUrl: 'http://x',
        purposes: [],
        apiKeyMask: 'realkey',
        lastModifiedBy: 'a',
        lastModifiedAt: 'now',
      }),
    ).toThrow();
  });

  it('toolConfigSchema requires all 3 intensity profiles', () => {
    const profile = { concurrency: 1, rateLimitPerSecond: 1, timeoutSeconds: 1, notes: '' };
    expect(() =>
      toolConfigSchema.parse({
        tool: 'nmap',
        version: '1',
        path: '/x',
        intensities: { LOW: profile, MEDIUM: profile, HIGH: profile },
        lastModifiedBy: 'a',
        lastModifiedAt: 'b',
      }),
    ).not.toThrow();
  });

  it('logSourceSchema accepts the seed shape', () => {
    expect(() =>
      logSourceSchema.parse({
        logSourceId: 'l1',
        name: 'x',
        logKind: 'firewall',
        productType: 'p',
        protocol: 'tls-syslog',
        parserFormat: 'syslog',
        assetGroupId: 'ag',
        status: 'ENABLED',
        health: 'HEALTHY',
        listenAddress: '0.0.0.0',
        listenPort: 6514,
        tlsConfigPlaceholder: 'configured',
        allowedSourceIps: [],
        eventRetentionDays: 180,
        metricsRetentionDays: 365,
        lastModifiedBy: 'a',
        lastModifiedAt: 'b',
      }),
    ).not.toThrow();
  });

  it('mailSourceSchema parses', () => {
    expect(() =>
      mailSourceSchema.parse({
        mailSourceId: 'm1',
        name: 'gw',
        upstreamHost: 'a',
        upstreamPort: 25,
        downstreamHost: 'b',
        downstreamPort: 25,
        status: 'ENABLED',
        recentReceivedCount: 0,
        tlsConfigPlaceholder: 'configured',
        maxMessageBytes: 50_000_000,
        failOpenPolicy: 'forward-with-marker',
        lastModifiedBy: 'a',
        lastModifiedAt: 'b',
      }),
    ).not.toThrow();
  });

  it('killSwitchStateSchema parses RUNNING/STOPPED states', () => {
    expect(() =>
      killSwitchStateSchema.parse({
        status: 'RUNNING',
        lastOperatorActorId: null,
        lastOperatedAt: null,
        scopeNote: 'x',
      }),
    ).not.toThrow();
  });

  it('killSwitchToggleRequestSchema rejects wrong confirm tokens', () => {
    expect(() =>
      killSwitchToggleRequestSchema.parse({ confirm: 'confirm', target: 'STOPPED' }),
    ).toThrow();
    expect(() =>
      killSwitchToggleRequestSchema.parse({ confirm: 'CONFIRM', target: 'STOPPED' }),
    ).not.toThrow();
  });

  it('adminEntityStatusSchema is a strict ENABLED|DISABLED enum', () => {
    expect(adminEntityStatusSchema.options).toEqual(['ENABLED', 'DISABLED']);
  });
});
