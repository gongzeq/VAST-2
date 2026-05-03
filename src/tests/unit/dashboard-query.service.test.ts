import { describe, expect, it } from 'vitest';

import { type ActorContext } from '../../modules/auth/contracts/actor-context.contract.js';
import { DashboardQueryService } from '../../modules/dashboard/domain/dashboard-query.service.js';
import {
  InMemoryAttackTrendRepository,
  InMemorySecurityLogEventRepository,
} from '../../modules/log-ingestion/persistence/in-memory-log-ingestion-repositories.js';
import { AuthorizationDeniedError } from '../../shared/contracts/foundation.js';

const actor: ActorContext = {
  actorId: 'user_1',
  roleIds: ['security_engineer'],
  permissionPoints: ['log_source:manage'],
  assetGroupIds: ['ag_prod'],
  yoloEnabled: false,
};

describe('DashboardQueryService', () => {
  it('returns redacted events and aggregate metrics only', () => {
    const eventRepository = new InMemorySecurityLogEventRepository();
    const trendRepository = new InMemoryAttackTrendRepository();

    eventRepository.saveMany([
      {
        eventId: 'event_1',
        ingestRef: 'ingest_1',
        sourceId: 'src_1',
        assetGroupId: 'ag_prod',
        logType: 'WAF',
        eventTime: '2026-05-03T09:10:11.000Z',
        receivedAt: '2026-05-03T09:10:12.000Z',
        srcIp: '198.51.100.7',
        srcPort: 51515,
        dstIp: null,
        dstDomain: 'app.example.com',
        dstPort: 443,
        protocol: 'HTTP/1.1',
        action: 'blocked',
        ruleId: 'waf-1',
        ruleName: 'SQLi',
        severity: 'HIGH',
        targetAssetId: 'domain:app.example.com',
        targetAuthorized: true,
        classification: {
          attackType: 'SQL_INJECTION',
          classificationRuleId: 'waf-1',
          confidence: 0.9,
          explanation: 'Matched SQL injection indicator.',
        },
        webFields: {
          httpMethod: 'GET',
          uriPath: '/search',
          statusCode: 403,
          userAgentSummary: 'curl/8.0',
          requestSize: 120,
          responseSize: 512,
        },
        redactedFields: ['uri.query'],
      },
    ]);

    trendRepository.upsertMany([
      {
        bucketId: 'trend_1',
        assetGroupId: 'ag_prod',
        windowStart: '2026-05-03T09:00:00.000Z',
        windowEnd: '2026-05-03T10:00:00.000Z',
        logType: 'WAF',
        attackType: 'SQL_INJECTION',
        severity: 'HIGH',
        srcIpOrCidr: '198.51.100.7',
        targetAssetId: 'domain:app.example.com',
        action: 'blocked',
        eventCount: 1,
      },
    ]);

    const service = new DashboardQueryService({
      eventRepository,
      trendRepository,
    });

    const result = service.readMetrics({
      assetGroupId: 'ag_prod',
      eventLimit: 10,
      trendLimit: 10,
    }, actor);

    expect(result.totalEvents).toBe(1);
    expect(result.blockedEvents).toBe(1);
    expect(result.unresolvedTargets).toBe(0);
    expect(result.topAttackTypes).toEqual([
      {
        attackType: 'SQL_INJECTION',
        eventCount: 1,
      },
    ]);
    expect(result.recentEvents[0]?.webFields?.uriPath).toBe('/search');
    expect(result.recentEvents[0]?.redactedFields).toContain('uri.query');
    expect(result.recentEvents[0]).not.toHaveProperty('payload');
    expect(result.trends).toHaveLength(1);
    expect(service.auditLog.listByResource('ag_prod').map((record) => record.action)).toEqual([
      'LOG_DASHBOARD_VIEWED',
    ]);
  });

  it('blocks dashboard access outside the actor asset-group scope', () => {
    const service = new DashboardQueryService();

    expect(() => service.readMetrics({ assetGroupId: 'ag_other' }, actor)).toThrowError(AuthorizationDeniedError);
  });
});
