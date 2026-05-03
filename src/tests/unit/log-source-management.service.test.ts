import { describe, expect, it } from 'vitest';

import { type ActorContext } from '../../modules/auth/contracts/actor-context.contract.js';
import { LogSourceManagementService } from '../../modules/log-ingestion/domain/log-source-management.service.js';
import { AuthorizationDeniedError } from '../../shared/contracts/foundation.js';

const privilegedActor: ActorContext = {
  actorId: 'user_1',
  roleIds: ['security_engineer'],
  permissionPoints: ['log_source:manage'],
  assetGroupIds: ['ag_prod'],
  yoloEnabled: false,
};

const unprivilegedActor: ActorContext = {
  actorId: 'user_2',
  roleIds: ['viewer'],
  permissionPoints: [],
  assetGroupIds: ['ag_prod'],
  yoloEnabled: false,
};

describe('LogSourceManagementService', () => {
  it('creates and disables a log source when the actor is authorized', () => {
    const service = new LogSourceManagementService();

    const source = service.upsertSource({
      sourceId: 'src_fw',
      logType: 'FIREWALL',
      productType: 'fortigate',
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
        allowedSourceIps: ['10.0.0.5'],
      },
    }, privilegedActor);

    const disabled = service.disableSource(source.sourceId, privilegedActor);

    expect(source.enabled).toBe(true);
    expect(disabled.enabled).toBe(false);
    expect(service.listSources('ag_prod', privilegedActor)).toHaveLength(1);
    expect(service.auditLog.listByResource(source.sourceId).map((record) => record.action)).toEqual([
      'LOG_SOURCE_CREATED',
      'LOG_SOURCE_DISABLED',
    ]);
  });

  it('rejects log source changes without the manage permission', () => {
    const service = new LogSourceManagementService();

    expect(() => service.upsertSource({
      sourceId: 'src_waf',
      logType: 'WAF',
      productType: 'waf',
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
        allowedSourceIps: [],
      },
    }, unprivilegedActor)).toThrowError(AuthorizationDeniedError);
  });
});
