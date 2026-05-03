import { describe, expect, it } from 'vitest';

import { type LogSourceConfig } from '../../modules/log-ingestion/contracts/log-ingestion.contract.js';
import { SecurityLogParser } from '../../modules/log-ingestion/domain/security-log-parser.js';

const jsonSource: LogSourceConfig = {
  sourceId: 'src_json',
  logType: 'WAF',
  productType: 'custom-waf',
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
};

const nginxSource: LogSourceConfig = {
  sourceId: 'src_nginx',
  logType: 'WEB',
  productType: 'nginx',
  ingestProtocol: 'SYSLOG_TCP',
  parserFormat: 'NGINX_ACCESS',
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
};

describe('SecurityLogParser', () => {
  it('parses JSON logs and extracts sensitive keys plus normalized request fields', () => {
    const parser = new SecurityLogParser();

    const parsed = parser.parse(JSON.stringify({
      event_time: '2026-05-03T09:10:11Z',
      src_ip: '198.51.100.7',
      src_port: 49211,
      dst_domain: 'App.Example.Com',
      dst_port: 443,
      protocol: 'HTTP/1.1',
      action: 'blocked',
      rule_id: 'waf-001',
      rule_name: 'Credential Abuse Detection',
      severity: 'high',
      request: 'POST /login?token=secret HTTP/1.1',
      status: 403,
      user_agent: 'Mozilla/5.0 TestAgent',
      headers: {
        Authorization: 'Bearer secret',
      },
      attack_type: 'credential stuffing',
    }), jsonSource);

    expect(parsed.originalEventTime).toBe('2026-05-03T09:10:11.000Z');
    expect(parsed.dstDomain).toBe('app.example.com');
    expect(parsed.httpMethod).toBe('POST');
    expect(parsed.uri).toBe('/login?token=secret');
    expect(parsed.statusCode).toBe(403);
    expect(parsed.attackTypeHint).toBe('credential stuffing');
    expect(parsed.sensitiveKeys).toContain('authorization');
  });

  it('parses common access logs and preserves timestamp normalization', () => {
    const parser = new SecurityLogParser();

    const parsed = parser.parse(
      '203.0.113.10 - - [03/May/2026:17:12:11 +0800] "GET /search?q=1 HTTP/1.1" 404 123 "-" "curl/8.1.0"',
      nginxSource,
    );

    expect(parsed.originalEventTime).toBe('2026-05-03T09:12:11.000Z');
    expect(parsed.srcIp).toBe('203.0.113.10');
    expect(parsed.httpMethod).toBe('GET');
    expect(parsed.uri).toBe('/search?q=1');
    expect(parsed.statusCode).toBe(404);
    expect(parsed.responseSize).toBe(123);
    expect(parsed.userAgent).toBe('curl/8.1.0');
  });
});
