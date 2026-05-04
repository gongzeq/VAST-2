import { describe, expect, it, beforeEach } from 'vitest';

import {
  actorContextSchema,
  apiErrorResponseSchema,
  assetGroupListResponseSchema,
  assetGroupSchema,
  discoveredAssetListResponseSchema,
  discoveredAssetRecordSchema,
  taskIntentResponseSchema,
  taskListResponseSchema,
  taskRecordSchema,
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

describe('MSW handler responses parse against the mirrored contracts', () => {
  beforeEach(() => resetDb());

  it('POST /api/auth/session returns a parseable ActorContext', async () => {
    const { status, payload } = await jsonRequest('POST', '/api/auth/session', {
      username: 'alice',
      roleId: 'security-engineer',
    });
    expect(status).toBe(200);
    expect(actorContextSchema.parse(payload).roleIds).toContain('security-engineer');
  });

  it('GET /api/auth/session 401s with apiErrorResponse when not logged in', async () => {
    const { status, payload } = await jsonRequest('GET', '/api/auth/session');
    expect(status).toBe(401);
    expect(apiErrorResponseSchema.parse(payload).error_code).toBe('AUTHORIZATION_DENIED');
  });

  it('GET /api/auth/session returns an ActorContext after login', async () => {
    await jsonRequest('POST', '/api/auth/session', { username: 'a', roleId: 'admin' });
    const { status, payload } = await jsonRequest('GET', '/api/auth/session');
    expect(status).toBe(200);
    expect(actorContextSchema.parse(payload).roleIds).toContain('admin');
  });

  it('DELETE /api/auth/session returns 204', async () => {
    await jsonRequest('POST', '/api/auth/session', { username: 'a', roleId: 'admin' });
    const { status } = await jsonRequest('DELETE', '/api/auth/session');
    expect(status).toBe(204);
    expect(db().actor).toBeNull();
  });

  it('POST /api/tasks/intent returns a parseable TaskIntentResponse with clarifications', async () => {
    const { status, payload } = await jsonRequest('POST', '/api/tasks/intent', {
      prompt: '弱口令扫描',
    });
    expect(status).toBe(200);
    const parsed = taskIntentResponseSchema.parse(payload);
    expect(parsed.clarifications).toBeDefined();
  });

  it('POST /api/tasks/intent returns a plan for high-risk prompts', async () => {
    const { payload } = await jsonRequest('POST', '/api/tasks/intent', {
      prompt: '对全部资产做高危扫描',
    });
    const parsed = taskIntentResponseSchema.parse(payload);
    expect(parsed.plan?.requestedIntensity).toBe('HIGH');
  });

  it('POST /api/tasks creates a task record', async () => {
    const { status, payload } = await jsonRequest('POST', '/api/tasks', {
      workflowType: 'ASSET_DISCOVERY',
      requestedIntensity: 'LOW',
    });
    expect(status).toBe(201);
    expect(taskRecordSchema.parse(payload).lifecycleStage).toBeDefined();
  });

  it('GET /api/tasks returns a list parseable as TaskListResponse', async () => {
    const { status, payload } = await jsonRequest('GET', '/api/tasks?page=1&pageSize=20');
    expect(status).toBe(200);
    expect(taskListResponseSchema.parse(payload).items.length).toBeGreaterThan(0);
  });

  it('GET /api/tasks/:taskId returns a TaskRecord and advances the demo task', async () => {
    const { payload } = await jsonRequest('GET', '/api/tasks/task_running_demo');
    const first = taskRecordSchema.parse(payload);
    const { payload: payload2 } = await jsonRequest(
      'GET',
      '/api/tasks/task_running_demo',
    );
    const { payload: payload3 } = await jsonRequest(
      'GET',
      '/api/tasks/task_running_demo',
    );
    const { payload: payload4 } = await jsonRequest(
      'GET',
      '/api/tasks/task_running_demo',
    );
    const { payload: payload5 } = await jsonRequest(
      'GET',
      '/api/tasks/task_running_demo',
    );
    const last = taskRecordSchema.parse(payload5);
    expect(first.lifecycleStage).toBe('AWAITING_CONFIRMATION');
    expect(last.lifecycleStage).toBe('FINISHED');
    expect(last.state).toBe('SUCCESS');
    // Sanity: intermediate readings include RUNNING.
    const stages = [payload2, payload3, payload4].map(
      (p) => taskRecordSchema.parse(p).lifecycleStage,
    );
    expect(stages).toContain('RUNNING');
  });

  it('GET /api/tasks/:taskId returns 404 for unknown id', async () => {
    const { status, payload } = await jsonRequest('GET', '/api/tasks/missing_task');
    expect(status).toBe(404);
    expect(apiErrorResponseSchema.parse(payload).error_code).toBe('TASK_EXECUTION_FAILED');
  });

  it('POST /api/tasks/:taskId/clarifications/:cid/answer marks question answered', async () => {
    const { status, payload } = await jsonRequest(
      'POST',
      '/api/tasks/task_clarification_demo/clarifications/cl_target/answer',
      { answer: 'ag_corp_internal' },
    );
    expect(status).toBe(200);
    const updated = taskRecordSchema.parse(payload);
    expect(updated.clarifications[0]?.answer).toBe('ag_corp_internal');
    expect(updated.lifecycleStage).toBe('AWAITING_CONFIRMATION');
  });

  it('POST /api/tasks/:taskId/confirmations moves task to RUNNING', async () => {
    const { status, payload } = await jsonRequest(
      'POST',
      '/api/tasks/task_running_demo/confirmations',
      { highRiskConfirmed: false, yoloRequested: false, note: null },
    );
    expect(status).toBe(200);
    expect(taskRecordSchema.parse(payload).lifecycleStage).toBe('RUNNING');
  });

  it('POST /api/tasks/:taskId/cancel requires task:cancel permission', async () => {
    // No actor → 403
    const { status, payload } = await jsonRequest(
      'POST',
      '/api/tasks/task_running_demo/cancel',
    );
    expect(status).toBe(403);
    expect(apiErrorResponseSchema.parse(payload).error_code).toBe('AUTHORIZATION_DENIED');
  });

  it('POST /api/tasks/:taskId/cancel succeeds for security-engineer', async () => {
    await jsonRequest('POST', '/api/auth/session', {
      username: 'a',
      roleId: 'security-engineer',
    });
    const { status, payload } = await jsonRequest(
      'POST',
      '/api/tasks/task_running_demo/cancel',
    );
    expect(status).toBe(200);
    const updated = taskRecordSchema.parse(payload);
    expect(updated.state).toBe('CANCELLED');
    expect(updated.lifecycleStage).toBe('FINISHED');
  });

  it('GET /api/asset-groups returns a list', async () => {
    const { status, payload } = await jsonRequest('GET', '/api/asset-groups');
    expect(status).toBe(200);
    expect(assetGroupListResponseSchema.parse(payload).items.length).toBeGreaterThan(0);
  });

  it('GET /api/asset-groups/:id returns a single group', async () => {
    const { status, payload } = await jsonRequest('GET', '/api/asset-groups/ag_corp_internal');
    expect(status).toBe(200);
    expect(assetGroupSchema.parse(payload).assetGroupId).toBe('ag_corp_internal');
  });

  it('POST /api/asset-groups/:id/whitelist-entries requires asset_scope:manage', async () => {
    // Without auth.
    const { status, payload } = await jsonRequest(
      'POST',
      '/api/asset-groups/ag_corp_internal/whitelist-entries',
      { kind: 'cidr', cidr: '192.168.0.0/24' },
    );
    expect(status).toBe(403);
    expect(apiErrorResponseSchema.parse(payload).error_code).toBe('AUTHORIZATION_DENIED');
  });

  it('POST /api/asset-groups/:id/whitelist-entries succeeds for admin', async () => {
    await jsonRequest('POST', '/api/auth/session', {
      username: 'root',
      roleId: 'admin',
    });
    const { status, payload } = await jsonRequest(
      'POST',
      '/api/asset-groups/ag_corp_internal/whitelist-entries',
      { kind: 'cidr', cidr: '192.168.0.0/24' },
    );
    expect(status).toBe(201);
    const updated = assetGroupSchema.parse(payload);
    expect(updated.whitelistEntries.some((e) => e.kind === 'cidr' && e.cidr === '192.168.0.0/24')).toBe(true);
  });

  it('GET /api/discovered-assets returns parseable list', async () => {
    const { status, payload } = await jsonRequest('GET', '/api/discovered-assets');
    expect(status).toBe(200);
    expect(discoveredAssetListResponseSchema.parse(payload).items.length).toBeGreaterThan(0);
  });

  it('GET /api/discovered-assets?state=... filters', async () => {
    const { payload } = await jsonRequest(
      'GET',
      '/api/discovered-assets?state=OUT_OF_SCOPE_DISCOVERED',
    );
    const parsed = discoveredAssetListResponseSchema.parse(payload);
    for (const item of parsed.items) {
      expect(item.status).toBe('OUT_OF_SCOPE_DISCOVERED');
    }
  });

  it('POST /api/discovered-assets/:id/confirm rejects OUT_OF_SCOPE_DISCOVERED', async () => {
    await jsonRequest('POST', '/api/auth/session', { username: 'root', roleId: 'admin' });
    const { status, payload } = await jsonRequest(
      'POST',
      '/api/discovered-assets/da_out_of_scope_1/confirm',
    );
    expect(status).toBe(409);
    expect(apiErrorResponseSchema.parse(payload).error_code).toBe('ASSET_SCOPE_BLOCKED');
  });

  it('POST /api/discovered-assets/:id/confirm transitions pending to confirmed', async () => {
    await jsonRequest('POST', '/api/auth/session', { username: 'root', roleId: 'admin' });
    const { status, payload } = await jsonRequest(
      'POST',
      '/api/discovered-assets/da_pending_1/confirm',
    );
    expect(status).toBe(200);
    expect(discoveredAssetRecordSchema.parse(payload).status).toBe('CONFIRMED');
    // The matching asset group should now have a new whitelist entry.
    const { payload: groupPayload } = await jsonRequest(
      'GET',
      '/api/asset-groups/ag_corp_public',
    );
    const group = assetGroupSchema.parse(groupPayload);
    expect(
      group.whitelistEntries.some(
        (e) => e.kind === 'root_domain' && e.rootDomain === 'api.example.com',
      ),
    ).toBe(true);
  });

  it('POST /api/discovered-assets/:id/reject transitions pending to rejected', async () => {
    await jsonRequest('POST', '/api/auth/session', { username: 'root', roleId: 'admin' });
    const { status, payload } = await jsonRequest(
      'POST',
      '/api/discovered-assets/da_pending_2/reject',
    );
    expect(status).toBe(200);
    expect(discoveredAssetRecordSchema.parse(payload).status).toBe('REJECTED');
  });
});
