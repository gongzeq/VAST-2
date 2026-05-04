import { describe, expect, it } from 'vitest';

import { type ActorContext } from '../../modules/auth/contracts/actor-context.contract.js';
import { MailAnalysisService } from '../../modules/phishing-mail/domain/mail-analysis.service.js';
import {
  InMemoryMailAnalysisRepository,
  InMemoryMailGatewayRepository,
} from '../../modules/phishing-mail/persistence/in-memory-mail-repositories.js';
import { SchemaValidationError } from '../../shared/contracts/foundation.js';

const actor: ActorContext = {
  actorId: 'user_1',
  roleIds: ['security_engineer'],
  permissionPoints: ['task:create'],
  assetGroupIds: ['ag_prod'],
  yoloEnabled: false,
};

const createService = () => {
  const gatewayRepository = new InMemoryMailGatewayRepository();
  const analysisRepository = new InMemoryMailAnalysisRepository();
  gatewayRepository.save({
    gatewayId: 'gw_primary',
    assetGroupId: 'ag_prod',
    inboundSourceRefs: ['mx_1'],
    downstreamHost: 'mail.internal.example.com',
    downstreamPort: 25,
    enabled: true,
  });

  return {
    gatewayRepository,
    analysisRepository,
    service: new MailAnalysisService({
      gatewayRepository,
      analysisRepository,
    }),
  };
};

describe('MailAnalysisService', () => {
  it('analyzes and forwards inbound mail with security headers without storing raw body', () => {
    const { service, analysisRepository } = createService();
    const sentinelBodyPhrase = 'SENTINEL-RAW-BODY-PHRASE-XYZZY';

    const result = service.receiveAnalyzeAndForward({
      gatewayId: 'gw_primary',
      sourceRef: 'mx_1',
      rawMessage: [
        'From: attacker@example.test',
        'To: employee@example.com',
        'Subject: Urgent password verification',
        '',
        `${sentinelBodyPhrase}: please verify your password at https://phish.example.test/login immediately.`,
      ].join('\n'),
      attachments: [
        {
          filename: 'invoice.exe',
          sizeBytes: 1200,
          contentType: 'application/octet-stream',
          sha256: 'abc123',
        },
      ],
    }, actor);

    expect(result.analysisStatus).toBe('ANALYZED');
    expect(result.analysisMode).toBe('FULL');
    expect(result.forwardingResult.status).toBe('FORWARDED');
    expect(result.forwardingResult.appliedHeaders['X-Security-Phishing']).toBe('suspected');
    expect(result.securityHeaders['X-Security-Phishing']).toBe('suspected');
    expect(result.securityHeaders['X-Security-Risk-Score']).toMatch(/^\d+$/u);
    expect(result.securityHeaders['X-Security-Task-ID']).toBe(result.mailTaskId);
    expect(result.securityHeaders['X-Security-Analysis']).toBe('complete');
    expect(result.attachmentAnalyses[0]?.analyzed).toBe(true);
    expect(result.iocs.some((ioc) => ioc.kind === 'URL')).toBe(true);
    expect(result.rawBodyStored).toBe(false);
    expect(result).not.toHaveProperty('rawMessage');
    expect(result).not.toHaveProperty('body');

    const persisted = analysisRepository.get(result.mailTaskId);
    expect(persisted).toBeDefined();
    expect(JSON.stringify(persisted)).not.toContain(sentinelBodyPhrase);
    expect(JSON.stringify(service.auditLog.listAll())).not.toContain(sentinelBodyPhrase);
    expect(service.auditLog.listByResource(result.mailTaskId).map((record) => record.action)).toEqual([
      'MAIL_ANALYSIS_COMPLETED',
      'MAIL_FORWARDED',
    ]);
  });

  it('continues forwarding oversized mail with body-only analysis and skipped attachments', () => {
    const { service } = createService();

    const result = service.receiveAnalyzeAndForward({
      gatewayId: 'gw_primary',
      sourceRef: 'mx_1',
      rawMessage: [
        'From: vendor@example.test',
        'To: employee@example.com',
        'Subject: Large report',
        '',
        'Please review https://example.test/report',
      ].join('\n'),
      sizeBytes: 50 * 1024 * 1024 + 1,
      attachments: [
        {
          filename: 'large.zip',
          sizeBytes: 50 * 1024 * 1024,
          contentType: 'application/zip',
          sha256: 'ziphash',
        },
      ],
    }, actor);

    expect(result.analysisMode).toBe('BODY_ONLY_SIZE_LIMIT');
    expect(result.securityHeaders['X-Security-Analysis']).toBe('body-only-size-limit');
    expect(result.forwardingResult.status).toBe('FORWARDED');
    expect(result.attachmentAnalyses).toEqual([
      expect.objectContaining({
        filename: 'large.zip',
        analyzed: false,
        skippedReason: 'message_size_limit',
      }),
    ]);
  });

  it('fails open when analysis is unavailable and omits phishing verdict headers', () => {
    const { service } = createService();

    const result = service.receiveAnalyzeAndForward({
      gatewayId: 'gw_primary',
      sourceRef: 'mx_1',
      rawMessage: [
        'From: sender@example.test',
        'To: employee@example.com',
        'Subject: Test',
        '',
        'hello',
      ].join('\n'),
      analysisAvailable: false,
    }, actor);

    expect(result.analysisStatus).toBe('UNAVAILABLE');
    expect(result.analysisMode).toBe('UNAVAILABLE');
    expect(result.forwardingResult.status).toBe('FORWARDED');
    expect(result.securityHeaders['X-Security-Analysis']).toBe('unavailable');
    expect(result.securityHeaders['X-Security-Phishing']).toBeUndefined();
    expect(result.securityHeaders['X-Security-Risk-Score']).toBeUndefined();
    expect(result.phishingLabel).toBeNull();
    expect(result.riskScore).toBeNull();
  });

  it('rejects mail through an unknown or disabled gateway and emits MAIL_GATEWAY_REJECTED audit', () => {
    const { service, analysisRepository } = createService();

    expect(() => service.receiveAnalyzeAndForward({
      gatewayId: 'gw_unknown',
      sourceRef: 'mx_1',
      rawMessage: 'From: a@b.test\n\nbody',
    }, actor)).toThrowError(SchemaValidationError);

    const audits = service.auditLog.listAll();
    expect(audits.map((record) => record.action)).toEqual(['MAIL_GATEWAY_REJECTED']);
    expect(audits[0]?.details.reason).toBe('unknown_or_disabled_gateway');
    expect(analysisRepository.list()).toEqual([]);
  });

  it('rejects mail from a disallowed source ref and emits MAIL_GATEWAY_REJECTED audit', () => {
    const { service, analysisRepository } = createService();

    expect(() => service.receiveAnalyzeAndForward({
      gatewayId: 'gw_primary',
      sourceRef: 'mx_unknown',
      rawMessage: 'From: a@b.test\n\nbody',
    }, actor)).toThrowError(SchemaValidationError);

    const audits = service.auditLog.listAll();
    expect(audits.map((record) => record.action)).toEqual(['MAIL_GATEWAY_REJECTED']);
    expect(audits[0]?.details.reason).toBe('source_not_allowed');
    expect(analysisRepository.list()).toEqual([]);
  });
});
