/**
 * PR1 round-trip tests for the operations MSW handlers.
 *
 * Each test seeds the actor (via /api/auth/session), then exercises the new
 * GET endpoints + parses the body through the contract schema. Permission
 * gates assert 403 for actors missing the required point.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import {
  apiErrorResponseSchema,
  auditLogListResponseSchema,
  dashboardSummarySchema,
  killSwitchStateSchema,
  llmProviderListResponseSchema,
  logSourceListResponseSchema,
  mailSourceListResponseSchema,
  toolConfigListResponseSchema,
} from '@/shared/contracts';
import { resetDb } from '@/app/msw/db';

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

async function login(roleId: string) {
  const r = await jsonRequest('POST', '/api/auth/session', { username: 'tester', roleId });
  expect(r.status).toBe(200);
}

describe('operations MSW handlers (PR1 read paths)', () => {
  beforeEach(() => resetDb());

  describe('GET /api/dashboard/summary', () => {
    it('401s when not logged in', async () => {
      const { status, payload } = await jsonRequest('GET', '/api/dashboard/summary');
      expect(status).toBe(401);
      expect(apiErrorResponseSchema.parse(payload).error_code).toBe('AUTHORIZATION_DENIED');
    });

    it('returns a parseable summary for a security engineer (scope=owned default)', async () => {
      await login('security-engineer');
      const { status, payload } = await jsonRequest('GET', '/api/dashboard/summary');
      expect(status).toBe(200);
      const parsed = dashboardSummarySchema.parse(payload);
      expect(parsed.scope).toBe('owned');
      expect(parsed.categories).toHaveLength(7);
    });

    it('rejects scope=global without asset_scope:manage', async () => {
      await login('security-engineer');
      const { status, payload } = await jsonRequest('GET', '/api/dashboard/summary?scope=global');
      expect(status).toBe(403);
      expect(apiErrorResponseSchema.parse(payload).error_code).toBe('AUTHORIZATION_DENIED');
    });

    it('allows scope=global for admin', async () => {
      await login('admin');
      const { status, payload } = await jsonRequest('GET', '/api/dashboard/summary?scope=global');
      expect(status).toBe(200);
      const parsed = dashboardSummarySchema.parse(payload);
      expect(parsed.scope).toBe('global');
    });
  });

  describe('GET /api/audit-log', () => {
    it('403s for an actor without audit_log:view (security-engineer fixture)', async () => {
      await login('security-engineer');
      const { status, payload } = await jsonRequest('GET', '/api/audit-log');
      expect(status).toBe(403);
      expect(apiErrorResponseSchema.parse(payload).error_code).toBe('AUTHORIZATION_DENIED');
    });

    it('returns paginated entries for an auditor', async () => {
      await login('auditor');
      const { status, payload } = await jsonRequest('GET', '/api/audit-log');
      expect(status).toBe(200);
      const parsed = auditLogListResponseSchema.parse(payload);
      expect(parsed.page).toBe(1);
      expect(parsed.entries.length).toBeGreaterThan(0);
    });

    it('filters by action via the URL param', async () => {
      await login('auditor');
      const { status, payload } = await jsonRequest('GET', '/api/audit-log?actions=task.create');
      expect(status).toBe(200);
      const parsed = auditLogListResponseSchema.parse(payload);
      for (const entry of parsed.entries) {
        expect(entry.action).toBe('task.create');
      }
    });
  });

  describe('GET /api/admin/llm-providers', () => {
    it('403s without llm_provider:manage', async () => {
      await login('auditor');
      const { status } = await jsonRequest('GET', '/api/admin/llm-providers');
      expect(status).toBe(403);
    });

    it('returns the seeded providers for admin', async () => {
      await login('admin');
      const { status, payload } = await jsonRequest('GET', '/api/admin/llm-providers');
      expect(status).toBe(200);
      const parsed = llmProviderListResponseSchema.parse(payload);
      expect(parsed.providers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/admin/tool-configs', () => {
    it('returns all 7 seeded tool configs for admin', async () => {
      await login('admin');
      const { status, payload } = await jsonRequest('GET', '/api/admin/tool-configs');
      expect(status).toBe(200);
      const parsed = toolConfigListResponseSchema.parse(payload);
      expect(parsed.toolConfigs.length).toBe(7);
    });

    it('GET /api/admin/tool-configs/nmap returns a single config', async () => {
      await login('admin');
      const { status, payload } = await jsonRequest('GET', '/api/admin/tool-configs/nmap');
      expect(status).toBe(200);
      // Type-only assertion: should parse via toolConfigSchema in real use.
      expect((payload as { tool: string }).tool).toBe('nmap');
    });
  });

  describe('GET /api/admin/log-sources', () => {
    it('returns the seeded sources for admin', async () => {
      await login('admin');
      const { status, payload } = await jsonRequest('GET', '/api/admin/log-sources');
      expect(status).toBe(200);
      const parsed = logSourceListResponseSchema.parse(payload);
      expect(parsed.logSources.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/admin/mail-sources', () => {
    it('returns the seeded mail sources for admin', async () => {
      await login('admin');
      const { status, payload } = await jsonRequest('GET', '/api/admin/mail-sources');
      expect(status).toBe(200);
      const parsed = mailSourceListResponseSchema.parse(payload);
      expect(parsed.mailSources.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/admin/kill-switch', () => {
    it('returns the kill switch state for admin', async () => {
      await login('admin');
      const { status, payload } = await jsonRequest('GET', '/api/admin/kill-switch');
      expect(status).toBe(200);
      const parsed = killSwitchStateSchema.parse(payload);
      expect(['RUNNING', 'STOPPED']).toContain(parsed.status);
    });

    it('403s for a viewer with no admin perm', async () => {
      await login('viewer');
      const { status } = await jsonRequest('GET', '/api/admin/kill-switch');
      expect(status).toBe(403);
    });
  });
});
