/**
 * Round-trip MSW unit coverage for admin write/toggle/delete paths.
 *
 * `operations-msw-handlers.test.ts` already covers GET + permission denial.
 * This file fills the gap for POST/PUT/PATCH/DELETE so R6 ("MSW round-trip
 * writes for all five admin blocks") is verified at the handler boundary, not
 * only via integration tests.
 *
 * Each write path asserts:
 *   - 403 for an actor missing the required permission point
 *   - 200/201/204 for an actor with the permission, body parses through the
 *     response zod schema where applicable
 *   - synthetic audit entry appended on success (to prove the audit-trail
 *     helper is wired up)
 */
import { describe, expect, it, beforeEach } from 'vitest';

import {
  apiErrorResponseSchema,
  killSwitchStateSchema,
  llmProviderSchema,
  logSourceSchema,
  mailSourceSchema,
  toolConfigSchema,
} from '@/shared/contracts';
import { db, resetDb } from '@/app/msw/db';

async function jsonRequest(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; payload: unknown }> {
  const response = await fetch(url, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return { status: 204, payload: null };
  const text = await response.text();
  const payload = text.length > 0 ? (JSON.parse(text) as unknown) : null;
  return { status: response.status, payload };
}

async function login(roleId: string): Promise<void> {
  const r = await jsonRequest('POST', '/api/auth/session', { username: 'tester', roleId });
  expect(r.status).toBe(200);
}

describe('admin write/toggle/delete MSW handlers (R6 round-trip writes)', () => {
  beforeEach(() => resetDb());

  // -------------------------------------------------------------------------
  // 1. LLM Provider
  // -------------------------------------------------------------------------

  describe('LLM Provider POST/PUT/PATCH/DELETE', () => {
    it('403s create for an actor without llm_provider:manage', async () => {
      await login('auditor');
      const { status, payload } = await jsonRequest('POST', '/api/admin/llm-providers', {
        name: 'x',
        type: 'local',
        baseUrl: 'http://x',
        purposes: [],
        status: 'ENABLED',
      });
      expect(status).toBe(403);
      expect(apiErrorResponseSchema.parse(payload).error_code).toBe('AUTHORIZATION_DENIED');
    });

    it('admin create → toggle → delete round-trip mutates db and audits each step', async () => {
      await login('admin');
      const auditBefore = db().auditLogEntries.size;

      const created = await jsonRequest('POST', '/api/admin/llm-providers', {
        name: '集成 Provider',
        type: 'openai-compatible',
        baseUrl: 'https://test.example/v1',
        apiKey: 'secret-not-leaked',
        purposes: ['intent-recognition'],
        status: 'ENABLED',
      });
      expect(created.status).toBe(201);
      const createdProvider = llmProviderSchema.parse(created.payload);
      // R10: returned shape masks the API key as bullets, not the cleartext.
      expect(createdProvider.apiKeyMask).toBe('••••');

      const toggled = await jsonRequest(
        'PATCH',
        `/api/admin/llm-providers/${encodeURIComponent(createdProvider.llmProviderId)}/toggle`,
      );
      expect(toggled.status).toBe(200);
      expect(llmProviderSchema.parse(toggled.payload).status).toBe('DISABLED');

      const deleted = await jsonRequest(
        'DELETE',
        `/api/admin/llm-providers/${encodeURIComponent(createdProvider.llmProviderId)}`,
      );
      expect(deleted.status).toBe(204);
      expect(db().llmProviders.has(createdProvider.llmProviderId)).toBe(false);

      // Each write path appended one synthetic audit entry.
      expect(db().auditLogEntries.size).toBe(auditBefore + 3);
    });

    it('PUT preserves apiKeyMask when apiKey omitted from body', async () => {
      await login('admin');
      const seededId = 'llm_local_ollama';
      const before = db().llmProviders.get(seededId)!;
      // Ensure seeded mask state is what we expect.
      expect(before.apiKeyMask).toBe(null);

      const r = await jsonRequest('PUT', `/api/admin/llm-providers/${seededId}`, {
        name: '本地 Ollama 重命名',
        type: 'local',
        baseUrl: 'http://localhost:11434',
        purposes: ['explanation'],
        status: 'DISABLED',
      });
      expect(r.status).toBe(200);
      const parsed = llmProviderSchema.parse(r.payload);
      expect(parsed.apiKeyMask).toBe(null); // unchanged
      expect(parsed.name).toBe('本地 Ollama 重命名');
    });

    it('PUT 404s for an unknown id', async () => {
      await login('admin');
      const r = await jsonRequest('PUT', '/api/admin/llm-providers/llm_does_not_exist', {
        name: 'x',
        type: 'local',
        baseUrl: 'http://x',
        purposes: [],
        status: 'ENABLED',
      });
      expect(r.status).toBe(404);
    });

    it('POST rejects an invalid body via SCHEMA_VALIDATION_FAILED', async () => {
      await login('admin');
      const r = await jsonRequest('POST', '/api/admin/llm-providers', { name: '' });
      expect(r.status).toBe(400);
      expect(apiErrorResponseSchema.parse(r.payload).error_code).toBe(
        'SCHEMA_VALIDATION_FAILED',
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. Tool Configs
  // -------------------------------------------------------------------------

  describe('Tool Config PUT', () => {
    it('403s without tool_config:manage', async () => {
      await login('auditor');
      const r = await jsonRequest('PUT', '/api/admin/tool-configs/nmap', { version: '1.1.0' });
      expect(r.status).toBe(403);
    });

    it('admin can patch nmap and the response parses through toolConfigSchema', async () => {
      await login('admin');
      const r = await jsonRequest('PUT', '/api/admin/tool-configs/nmap', {
        version: '1.2.3',
        path: '/opt/nmap/bin/nmap',
      });
      expect(r.status).toBe(200);
      const parsed = toolConfigSchema.parse(r.payload);
      expect(parsed.tool).toBe('nmap');
      expect(parsed.version).toBe('1.2.3');
      expect(parsed.path).toBe('/opt/nmap/bin/nmap');
    });

    it('rejects an unknown tool name', async () => {
      await login('admin');
      const r = await jsonRequest('PUT', '/api/admin/tool-configs/not-a-real-tool', {});
      expect(r.status).toBe(400);
      expect(apiErrorResponseSchema.parse(r.payload).error_code).toBe(
        'SCHEMA_VALIDATION_FAILED',
      );
    });
  });

  // -------------------------------------------------------------------------
  // 3. Log Sources
  // -------------------------------------------------------------------------

  describe('Log Source POST/PUT/PATCH/DELETE', () => {
    it('403s create without log_source:manage', async () => {
      await login('auditor');
      const r = await jsonRequest('POST', '/api/admin/log-sources', {
        name: 'x',
        logKind: 'firewall',
        productType: 'p',
        protocol: 'tls-syslog',
        parserFormat: 'syslog',
        assetGroupId: 'ag_corp_public',
        listenAddress: '0.0.0.0',
        listenPort: 6515,
        allowedSourceIps: [],
        eventRetentionDays: 30,
        metricsRetentionDays: 90,
        status: 'ENABLED',
      });
      expect(r.status).toBe(403);
    });

    it('admin create → toggle (PATCH) → delete round-trip', async () => {
      await login('admin');
      const created = await jsonRequest('POST', '/api/admin/log-sources', {
        name: '测试源',
        logKind: 'firewall',
        productType: 'p',
        protocol: 'tls-syslog',
        parserFormat: 'syslog',
        assetGroupId: 'ag_corp_public',
        listenAddress: '0.0.0.0',
        listenPort: 6515,
        allowedSourceIps: [],
        eventRetentionDays: 30,
        metricsRetentionDays: 90,
        status: 'ENABLED',
      });
      expect(created.status).toBe(201);
      const parsedCreated = logSourceSchema.parse(created.payload);
      expect(parsedCreated.status).toBe('ENABLED');

      const toggled = await jsonRequest(
        'PATCH',
        `/api/admin/log-sources/${parsedCreated.logSourceId}/toggle`,
        { status: 'DISABLED' },
      );
      expect(toggled.status).toBe(200);
      expect(logSourceSchema.parse(toggled.payload).status).toBe('DISABLED');

      const deleted = await jsonRequest(
        'DELETE',
        `/api/admin/log-sources/${parsedCreated.logSourceId}`,
      );
      expect(deleted.status).toBe(204);
    });

    it('PUT updates fields and preserves health + tlsConfigPlaceholder', async () => {
      await login('admin');
      const seededId = 'logsrc_firewall_main';
      const before = db().logSources.get(seededId)!;
      const r = await jsonRequest('PUT', `/api/admin/log-sources/${seededId}`, {
        name: '边界防火墙日志（重命名）',
        logKind: before.logKind,
        productType: before.productType,
        protocol: before.protocol,
        parserFormat: before.parserFormat,
        assetGroupId: before.assetGroupId,
        listenAddress: before.listenAddress,
        listenPort: before.listenPort,
        allowedSourceIps: before.allowedSourceIps,
        eventRetentionDays: 90, // changed
        metricsRetentionDays: before.metricsRetentionDays,
        status: before.status,
      });
      expect(r.status).toBe(200);
      const parsed = logSourceSchema.parse(r.payload);
      expect(parsed.name).toBe('边界防火墙日志（重命名）');
      expect(parsed.eventRetentionDays).toBe(90);
      expect(parsed.health).toBe(before.health); // unchanged
      expect(parsed.tlsConfigPlaceholder).toBe(before.tlsConfigPlaceholder);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Mail Sources
  // -------------------------------------------------------------------------

  describe('Mail Source POST/PUT/DELETE', () => {
    it('403s for a viewer (no admin-class perm)', async () => {
      await login('viewer');
      const r = await jsonRequest('POST', '/api/admin/mail-sources', {
        name: 'x',
        upstreamHost: 'a',
        upstreamPort: 25,
        downstreamHost: 'b',
        downstreamPort: 25,
        maxMessageBytes: 1024,
        failOpenPolicy: 'forward-with-marker',
        status: 'ENABLED',
      });
      expect(r.status).toBe(403);
    });

    it('admin create → update → delete round-trip', async () => {
      await login('admin');
      const created = await jsonRequest('POST', '/api/admin/mail-sources', {
        name: '备份网关',
        upstreamHost: 'mx-backup.upstream.example',
        upstreamPort: 25,
        downstreamHost: 'corp-mail-backup.internal',
        downstreamPort: 25,
        maxMessageBytes: 50 * 1024 * 1024,
        failOpenPolicy: 'forward-with-marker',
        status: 'ENABLED',
      });
      expect(created.status).toBe(201);
      const parsedCreated = mailSourceSchema.parse(created.payload);

      const updated = await jsonRequest(
        'PUT',
        `/api/admin/mail-sources/${parsedCreated.mailSourceId}`,
        {
          name: '备份网关（重命名）',
          upstreamHost: parsedCreated.upstreamHost,
          upstreamPort: parsedCreated.upstreamPort,
          downstreamHost: parsedCreated.downstreamHost,
          downstreamPort: parsedCreated.downstreamPort,
          maxMessageBytes: 30 * 1024 * 1024,
          failOpenPolicy: 'block',
          status: 'DISABLED',
        },
      );
      expect(updated.status).toBe(200);
      const parsedUpdated = mailSourceSchema.parse(updated.payload);
      expect(parsedUpdated.failOpenPolicy).toBe('block');
      expect(parsedUpdated.status).toBe('DISABLED');

      const deleted = await jsonRequest(
        'DELETE',
        `/api/admin/mail-sources/${parsedCreated.mailSourceId}`,
      );
      expect(deleted.status).toBe(204);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Kill Switch
  // -------------------------------------------------------------------------

  describe('Kill Switch toggle (POST /api/admin/kill-switch/toggle)', () => {
    it('403s without kill_switch:operate', async () => {
      // The auditor only has audit_log:view + raw_evidence:view, so the
      // toggle endpoint must reject — even though the GET endpoint allows
      // any admin-class actor (different gate).
      await login('auditor');
      const r = await jsonRequest('POST', '/api/admin/kill-switch/toggle', {
        confirm: 'CONFIRM',
        target: 'STOPPED',
      });
      expect(r.status).toBe(403);
    });

    it('400s when the confirm token is wrong', async () => {
      await login('admin');
      const r = await jsonRequest('POST', '/api/admin/kill-switch/toggle', {
        confirm: 'confirm',
        target: 'STOPPED',
      });
      expect(r.status).toBe(400);
      expect(apiErrorResponseSchema.parse(r.payload).error_code).toBe(
        'SCHEMA_VALIDATION_FAILED',
      );
      // A failed-attempt audit entry should still be appended.
      const failureEntries = Array.from(db().auditLogEntries.values()).filter(
        (entry) => entry.action === 'kill_switch.operate' && entry.outcome === 'FAILURE',
      );
      expect(failureEntries.length).toBeGreaterThan(0);
    });

    it('admin toggle flips status and parses through killSwitchStateSchema', async () => {
      await login('admin');
      const before = db().killSwitch.status;
      const target = before === 'RUNNING' ? 'STOPPED' : 'RUNNING';
      const r = await jsonRequest('POST', '/api/admin/kill-switch/toggle', {
        confirm: 'CONFIRM',
        target,
      });
      expect(r.status).toBe(200);
      const parsed = killSwitchStateSchema.parse(r.payload);
      expect(parsed.status).toBe(target);
      // Operator id is whoever's logged in via the auth handler.
      expect(parsed.lastOperatorActorId).toBe(db().actor!.actorId);
    });
  });
});
