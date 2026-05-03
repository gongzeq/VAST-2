import { describe, expect, it } from 'vitest';

import { type ActorContext } from '../../modules/auth/contracts/actor-context.contract.js';
import { type AssetWhitelistEntry } from '../../modules/asset-scope/contracts/asset-authorization.contract.js';
import { LogIngestionService } from '../../modules/log-ingestion/domain/log-ingestion.service.js';
import { LogSourceManagementService } from '../../modules/log-ingestion/domain/log-source-management.service.js';
import {
  InMemoryAttackTrendRepository,
  InMemoryLogIngestRecordRepository,
  InMemoryLogSourceRepository,
  InMemorySecurityLogEventRepository,
} from '../../modules/log-ingestion/persistence/in-memory-log-ingestion-repositories.js';

const actor: ActorContext = {
  actorId: 'user_1',
  roleIds: ['security_engineer'],
  permissionPoints: ['log_source:manage'],
  assetGroupIds: ['ag_prod'],
  yoloEnabled: false,
};

const whitelistEntries: AssetWhitelistEntry[] = [
  {
    kind: 'root_domain',
    assetGroupId: 'ag_prod',
    rootDomain: 'example.com',
    allowSubdomains: true,
  },
];

describe('LogIngestionService', () => {
  it('persists metadata plus redacted events and aggregates without retaining raw payload', () => {
    const logSourceRepository = new InMemoryLogSourceRepository();
    const ingestRecordRepository = new InMemoryLogIngestRecordRepository();
    const eventRepository = new InMemorySecurityLogEventRepository();
    const trendRepository = new InMemoryAttackTrendRepository();

    const sourceManagement = new LogSourceManagementService({ repository: logSourceRepository });
    sourceManagement.upsertSource({
      sourceId: 'src_waf',
      logType: 'WAF',
      productType: 'edge-waf',
      ingestProtocol: 'SYSLOG_TLS',
      parserFormat: 'JSON',
      assetGroupId: 'ag_prod',
      enabled: true,
      retentionEventsDays: 180,
      retentionAggregatesDays: 365,
      receiver: {
        transport: 'TLS',
        listenHost: '0.0.0.0',
        listenPort: 6514,
        tlsCertRef: 'cert_1',
        allowedSourceIps: ['10.0.0.10'],
      },
    }, actor);

    const service = new LogIngestionService({
      sourceRepository: logSourceRepository,
      ingestRecordRepository,
      eventRepository,
      trendRepository,
    });

    const result = service.ingest({
      sourceId: 'src_waf',
      sourceIp: '10.0.0.10',
      payload: JSON.stringify({
        event_time: '2026-05-03T09:10:11Z',
        src_ip: '198.51.100.7',
        dst_domain: 'admin.example.com',
        dst_port: 443,
        protocol: 'HTTP/1.1',
        action: 'blocked',
        rule_id: 'waf-100',
        rule_name: 'SQLi rule',
        request: 'GET /search?q=union%20select%201&token=secret HTTP/1.1',
        status: 403,
        user_agent: 'curl/8.0',
      }),
    }, actor, whitelistEntries);

    expect(result.ingestRecord.rawBodyDiscarded).toBe(true);
    expect(result.ingestRecord.parseStatus).toBe('PARSED');
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.webFields?.uriPath).toBe('/search');
    expect(result.events[0]?.redactedFields).toContain('uri.query');
    expect(result.events[0]?.classification?.attackType).toBe('SQL_INJECTION');
    expect(result.events[0]?.targetAuthorized).toBe(true);
    expect(result.events[0]).not.toHaveProperty('payload');
    expect(result.events[0]).not.toHaveProperty('rawBody');
    expect(result.aggregatedBuckets).toHaveLength(1);
    expect(ingestRecordRepository.listAll()).toHaveLength(1);
    expect(eventRepository.list({ assetGroupId: 'ag_prod' })).toHaveLength(1);
    expect(trendRepository.list({ assetGroupId: 'ag_prod' })).toHaveLength(1);
    expect(service.auditLog.listByResource(result.ingestRecord.ingestRef).map((record) => record.action)).toEqual([
      'LOG_INGEST_PARSED',
      'LOG_INGEST_AGGREGATED',
    ]);
  });

  it('keeps ingest metadata when parsing fails and still discards the raw payload', () => {
    const logSourceRepository = new InMemoryLogSourceRepository();

    const sourceManagement = new LogSourceManagementService({ repository: logSourceRepository });
    sourceManagement.upsertSource({
      sourceId: 'src_web',
      logType: 'WEB',
      productType: 'nginx',
      ingestProtocol: 'SYSLOG_TCP',
      parserFormat: 'JSON',
      assetGroupId: 'ag_prod',
      enabled: true,
      retentionEventsDays: 180,
      retentionAggregatesDays: 365,
      receiver: {
        transport: 'TCP',
        listenHost: '0.0.0.0',
        listenPort: 514,
        tlsCertRef: null,
        allowedSourceIps: [],
      },
    }, actor);

    const service = new LogIngestionService({ sourceRepository: logSourceRepository });

    const result = service.ingest({
      sourceId: 'src_web',
      sourceIp: '10.0.0.11',
      payload: '{not valid json',
    }, actor, whitelistEntries);

    expect(result.ingestRecord.parseStatus).toBe('FAILED');
    expect(result.ingestRecord.rawBodyDiscarded).toBe(true);
    expect(result.events).toEqual([]);
    expect(result.aggregatedBuckets).toEqual([]);
    expect(service.auditLog.listByResource(result.ingestRecord.ingestRef).map((record) => record.action)).toEqual([
      'LOG_INGEST_PARSE_FAILED',
    ]);
  });
});
