/**
 * Admin kill switch MSW handlers.
 *
 * GET — visible to any admin-class actor (status card needs to render even
 * for non-operators).
 * POST /toggle — strictly `kill_switch:operate`. Rejects when `confirm` is
 * not the literal `'CONFIRM'`. Appends a synthetic audit entry on success.
 */
import { http, HttpResponse } from 'msw';

import {
  killSwitchStateSchema,
  killSwitchToggleRequestSchema,
  type KillSwitchState,
} from '@/shared/contracts';

import { db } from '../db';
import { errorResponse } from './_helpers';
import { appendAuditEntry } from './_audit-log';

function requireAnyAdminPerm() {
  const actor = db().actor;
  const anyAdmin: ReadonlyArray<string> = [
    'asset_scope:manage',
    'log_source:manage',
    'llm_provider:manage',
    'tool_config:manage',
    'kill_switch:operate',
  ];
  if (!actor || !actor.permissionPoints.some((p) => anyAdmin.includes(p))) {
    return errorResponse({
      status: 403,
      errorCode: 'AUTHORIZATION_DENIED',
      message: '当前角色无权查看 Kill Switch 状态。',
      details: { missingPermission: 'kill_switch:operate' },
    });
  }
  return null;
}

function requireKillSwitchOperate() {
  const actor = db().actor;
  if (!actor || !actor.permissionPoints.includes('kill_switch:operate')) {
    return errorResponse({
      status: 403,
      errorCode: 'AUTHORIZATION_DENIED',
      message: '当前角色缺少 kill_switch:operate 权限。',
      details: { missingPermission: 'kill_switch:operate' },
    });
  }
  return null;
}

export const adminKillSwitchHandlers = [
  http.get('/api/admin/kill-switch', () => {
    const denied = requireAnyAdminPerm();
    if (denied) return denied;
    return HttpResponse.json(killSwitchStateSchema.parse(db().killSwitch), { status: 200 });
  }),

  http.post('/api/admin/kill-switch/toggle', async ({ request }) => {
    const denied = requireKillSwitchOperate();
    if (denied) return denied;
    const actor = db().actor!;
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Invalid JSON body.',
      });
    }
    const parsed = killSwitchToggleRequestSchema.safeParse(payload);
    if (!parsed.success) {
      // Audit the failed attempt — important enough to leave a trail.
      appendAuditEntry({
        actor,
        action: 'kill_switch.operate',
        targetKind: 'kill_switch',
        targetId: 'global',
        outcome: 'FAILURE',
        validationResult: { reason: 'INVALID_CONFIRM_TOKEN' },
        note: '错误的 CONFIRM 令牌或无效请求体。',
      });
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Kill switch toggle request invalid.',
      });
    }
    const next: KillSwitchState = {
      ...db().killSwitch,
      status: parsed.data.target,
      lastOperatorActorId: actor.actorId,
      lastOperatedAt: new Date().toISOString(),
    };
    db().killSwitch = next;
    appendAuditEntry({
      actor,
      action: 'kill_switch.operate',
      targetKind: 'kill_switch',
      targetId: 'global',
      requestPayload: { target: parsed.data.target, confirm: 'CONFIRM' },
      note: 'Kill switch 通过 admin 控制台触发。',
    });
    return HttpResponse.json(killSwitchStateSchema.parse(next), { status: 200 });
  }),
];
