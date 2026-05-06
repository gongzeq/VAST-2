import { describe, expect, it } from 'vitest';

import {
  mailAnalysisListResponseSchema,
  mailAnalysisModeSchema,
  mailAnalysisRecordSchema,
  mailAnalysisStatusSchema,
  mailForwardingStatusSchema,
  mailIocKindSchema,
  phishingLabelSchema,
} from '@/shared/contracts/mail-analysis.contract';

describe('mail-analysis contract — mirror parity', () => {
  it('phishingLabel enum = backend triple', () => {
    expect(phishingLabelSchema.options).toEqual(['suspected', 'suspicious', 'clean']);
  });

  it('analysisMode enum = backend triple', () => {
    expect(mailAnalysisModeSchema.options).toEqual([
      'FULL',
      'BODY_ONLY_SIZE_LIMIT',
      'UNAVAILABLE',
    ]);
  });

  it('analysisStatus enum = backend pair', () => {
    expect(mailAnalysisStatusSchema.options).toEqual(['ANALYZED', 'UNAVAILABLE']);
  });

  it('forwardingStatus enum has only FORWARDED (fail-open invariant)', () => {
    expect(mailForwardingStatusSchema.options).toEqual(['FORWARDED']);
  });

  it('iocKind enum = backend quartet', () => {
    expect(mailIocKindSchema.options).toEqual(['URL', 'DOMAIN', 'IP', 'EMAIL']);
  });

  it('rawBodyStored MUST be the literal false (R6 compile-time guarantee)', () => {
    // The literal-false guarantee surfaces as a parse error if rawBodyStored is true.
    expect(() =>
      mailAnalysisRecordSchema.parse({
        mailTaskId: 'm1',
        gatewayId: 'g1',
        assetGroupId: 'ag1',
        sourceRef: 'r1',
        receivedAt: '2025-01-01T00:00:00.000Z',
        subject: null,
        from: null,
        recipients: [],
        messageSizeBytes: 0,
        bodySha256: 'abc',
        rawBodyStored: true,
        analysisMode: 'UNAVAILABLE',
        analysisStatus: 'UNAVAILABLE',
        phishingLabel: null,
        riskScore: null,
        securityHeaders: {},
        attachmentAnalyses: [],
        iocs: [],
        forwardingResult: {
          status: 'FORWARDED',
          downstreamHost: 'mx.example.com',
          downstreamPort: 25,
          forwardedAt: '2025-01-01T00:00:00.000Z',
          appliedHeaders: {},
        },
        riskSignals: [],
        unavailableReason: null,
      }),
    ).toThrow();
  });

  it('parses an UNAVAILABLE record with null phishingLabel/riskScore', () => {
    const parsed = mailAnalysisRecordSchema.parse({
      mailTaskId: 'm1',
      gatewayId: 'g1',
      assetGroupId: 'ag1',
      sourceRef: 'r1',
      receivedAt: '2025-01-01T00:00:00.000Z',
      subject: null,
      from: null,
      recipients: [],
      messageSizeBytes: 0,
      bodySha256: 'abc',
      rawBodyStored: false,
      analysisMode: 'UNAVAILABLE',
      analysisStatus: 'UNAVAILABLE',
      phishingLabel: null,
      riskScore: null,
      securityHeaders: { 'X-Security-Analysis': 'unavailable' },
      attachmentAnalyses: [],
      iocs: [],
      forwardingResult: {
        status: 'FORWARDED',
        downstreamHost: 'mx.example.com',
        downstreamPort: 25,
        forwardedAt: '2025-01-01T00:00:00.000Z',
        appliedHeaders: { 'X-Security-Analysis': 'unavailable' },
      },
      riskSignals: [],
      unavailableReason: '分析服务暂时不可达',
    });
    expect(parsed.phishingLabel).toBeNull();
    expect(parsed.riskScore).toBeNull();
    expect(parsed.analysisStatus).toBe('UNAVAILABLE');
  });

  it('list response shape requires page/pageSize/total', () => {
    const parsed = mailAnalysisListResponseSchema.parse({
      records: [],
      page: 1,
      pageSize: 25,
      total: 0,
    });
    expect(parsed.records).toHaveLength(0);
    expect(parsed.total).toBe(0);
  });
});
