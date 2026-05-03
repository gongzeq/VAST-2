import { describe, expect, it } from 'vitest';

import { SecurityLogRedactor } from '../../modules/log-ingestion/domain/security-log-redactor.js';
import { type ParsedSecurityLogEntry } from '../../modules/log-ingestion/domain/security-log-parser.js';

describe('SecurityLogRedactor', () => {
  it('redacts query strings, keeps path-only web fields, and classifies SQL injection safely', () => {
    const redactor = new SecurityLogRedactor();

    const entry: ParsedSecurityLogEntry = {
      originalEventTime: '2026-05-03T09:10:11.000Z',
      srcIp: '198.51.100.7',
      srcPort: 51515,
      dstIp: null,
      dstDomain: 'app.example.com',
      dstPort: 443,
      protocol: 'HTTP/1.1',
      action: 'blocked',
      ruleId: 'waf-002',
      ruleName: 'SQLi Generic Detection',
      severity: null,
      httpMethod: 'GET',
      uri: '/search?q=1%20union%20select%20password%20from%20users&token=secret',
      statusCode: 403,
      userAgent: 'Mozilla/5.0 ExampleBrowser',
      requestSize: 128,
      responseSize: 512,
      attackTypeHint: null,
      sensitiveKeys: ['authorization'],
    };

    const result = redactor.redact(entry);

    expect(result.redactedFields).toEqual(['authorization', 'uri.query']);
    expect(result.webFields?.uriPath).toBe('/search');
    expect(result.webFields?.userAgentSummary).toBe('Mozilla/5.0');
    expect(result.classification?.attackType).toBe('SQL_INJECTION');
    expect(result.severity).toBe('HIGH');
  });
});
