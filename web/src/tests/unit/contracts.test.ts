import { describe, expect, it } from 'vitest';

import {
  actorContextSchema,
  apiErrorResponseSchema,
  assetDiscoveryStateSchema,
  assetGroupListResponseSchema,
  assetGroupSchema,
  assetTargetSchema,
  assetWhitelistEntrySchema,
  createTaskCommandSchema,
  discoveredAssetListResponseSchema,
  discoveredAssetRecordSchema,
  domainErrorCodeSchema,
  executionIntensitySchema,
  permissionPointSchema,
  taskClarificationSchema,
  taskConfirmationSchema,
  taskIntentResponseSchema,
  taskLifecycleStageSchema,
  taskListResponseSchema,
  taskPlanStepSchema,
  taskRecordSchema,
  taskStateSchema,
  taskStepExecutionStatusSchema,
  workflowTypeSchema,
} from '@/shared/contracts';

describe('mirrored zod contracts — round trip', () => {
  it('taskState enum exposes all 6 values', () => {
    expect(taskStateSchema.options).toEqual([
      'SUCCESS',
      'PARTIAL_SUCCESS',
      'FAILED',
      'NEEDS_CLARIFICATION',
      'BLOCKED',
      'CANCELLED',
    ]);
  });

  it('assetDiscoveryState enum matches backend', () => {
    expect(assetDiscoveryStateSchema.options).toEqual([
      'DISCOVERED_PENDING_CONFIRMATION',
      'CONFIRMED',
      'REJECTED',
      'OUT_OF_SCOPE_DISCOVERED',
    ]);
  });

  it('executionIntensity enum is LOW/MEDIUM/HIGH', () => {
    expect(executionIntensitySchema.options).toEqual(['LOW', 'MEDIUM', 'HIGH']);
  });

  it('permissionPoint enum exposes all 12 points', () => {
    expect(permissionPointSchema.options).toEqual([
      'task:create',
      'task:confirm',
      'task:cancel',
      'task:yolo_execute',
      'asset_scope:manage',
      'audit_log:view',
      'raw_evidence:view',
      'report:export',
      'weak_password:cleartext_view',
      'weak_password:cleartext_export',
      'log_source:manage',
      'log_event:export',
    ]);
  });

  it('domainErrorCode enum exposes all 10 codes', () => {
    expect(domainErrorCodeSchema.options).toEqual([
      'NEEDS_CLARIFICATION',
      'AUTHORIZATION_DENIED',
      'ASSET_SCOPE_BLOCKED',
      'CONFIRMATION_REQUIRED',
      'SCHEMA_VALIDATION_FAILED',
      'TASK_EXECUTION_FAILED',
      'TASK_PARTIAL_FAILURE',
      'TASK_CANCELLED',
      'SENSITIVE_EXPORT_EXPIRED',
      'LOG_INGEST_REJECTED',
    ]);
  });

  it('apiErrorResponse parses snake_case fields', () => {
    const payload = {
      error_code: 'AUTHORIZATION_DENIED',
      message: 'denied',
      details: {},
      request_id: 'req_1',
    };
    expect(apiErrorResponseSchema.parse(payload)).toEqual(payload);
  });

  it('actorContext validates the four preset role bundles', () => {
    const actor = actorContextSchema.parse({
      actorId: 'actor_x',
      roleIds: ['security-engineer'],
      permissionPoints: ['task:create', 'task:confirm', 'task:cancel', 'task:yolo_execute'],
      assetGroupIds: ['ag_corp_internal'],
      yoloEnabled: false,
    });
    expect(actor.permissionPoints).toContain('task:create');
  });

  it('assetTarget accepts domain or ip', () => {
    expect(assetTargetSchema.parse({ kind: 'domain', value: 'a.com' })).toEqual({
      kind: 'domain',
      value: 'a.com',
    });
    expect(assetTargetSchema.parse({ kind: 'ip', value: '1.2.3.4' })).toEqual({
      kind: 'ip',
      value: '1.2.3.4',
    });
  });

  it('assetWhitelistEntry discriminates correctly', () => {
    const e = assetWhitelistEntrySchema.parse({
      kind: 'cidr',
      assetGroupId: 'ag1',
      cidr: '10.0.0.0/16',
    });
    expect(e.kind).toBe('cidr');
  });

  it('assetGroupListResponse parses the seeded structure', () => {
    const payload = {
      items: [
        {
          assetGroupId: 'ag1',
          name: 'Group',
          description: 'desc',
          ownerActorIds: ['actor_admin'],
          whitelistEntries: [],
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    };
    expect(assetGroupListResponseSchema.parse(payload).items).toHaveLength(1);
    expect(assetGroupSchema.parse(payload.items[0]).assetGroupId).toBe('ag1');
  });

  it('discoveredAssetRecord round-trips with null probe', () => {
    const payload = {
      discoveredAssetId: 'da1',
      assetGroupId: 'ag1',
      sourceTarget: 'a.com',
      target: { kind: 'domain', value: 'b.a.com' },
      status: 'DISCOVERED_PENDING_CONFIRMATION',
      probe: null,
      discoveredAt: '2025-01-01T00:00:00.000Z',
    };
    expect(discoveredAssetRecordSchema.parse(payload)).toEqual(payload);
    expect(discoveredAssetListResponseSchema.parse({ items: [payload] })).toEqual({
      items: [payload],
    });
  });

  it('taskRecord parses with state=null and lifecycleStage=READY', () => {
    const payload = {
      taskId: 't1',
      assetGroupId: null,
      workflowType: 'ASSET_DISCOVERY',
      requestedIntensity: 'LOW',
      yoloRequested: false,
      lifecycleStage: 'READY',
      state: null,
      targets: [],
      steps: [],
      clarifications: [],
      confirmations: [],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    expect(taskRecordSchema.parse(payload)).toEqual(payload);
  });

  it('taskListResponse requires page/pageSize/total', () => {
    const payload = {
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    };
    expect(taskListResponseSchema.parse(payload)).toEqual(payload);
  });

  it('taskPlanStep, taskClarification, taskConfirmation, taskStepExecutionStatus, taskLifecycleStage parse fixtures', () => {
    expect(
      taskPlanStepSchema.parse({
        stepId: 's1',
        stepType: 'nmap',
        description: 'do scan',
      }),
    ).toMatchObject({ stepId: 's1' });
    expect(taskClarificationSchema.shape.clarificationId).toBeDefined(); // sanity for typing
    expect(
      taskClarificationSchema.parse({
        clarificationId: 'cl1',
        question: 'q?',
        answer: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        answeredAt: null,
      }),
    ).toMatchObject({ clarificationId: 'cl1' });
    expect(
      taskConfirmationSchema.parse({
        confirmationId: 'cf1',
        actorId: 'actor_x',
        note: null,
        confirmedAt: '2025-01-01T00:00:00.000Z',
      }),
    ).toMatchObject({ confirmationId: 'cf1' });
    expect(taskStepExecutionStatusSchema.options).toEqual([
      'PENDING',
      'SUCCESS',
      'FAILED',
      'SKIPPED',
      'CANCELLED',
    ]);
    expect(taskLifecycleStageSchema.options).toEqual([
      'CREATED',
      'AWAITING_CLARIFICATION',
      'AWAITING_CONFIRMATION',
      'READY',
      'RUNNING',
      'FINISHED',
    ]);
    expect(workflowTypeSchema.options).toContain('COMPREHENSIVE_SCAN');
  });

  it('createTaskCommand fills defaults', () => {
    const parsed = createTaskCommandSchema.parse({
      workflowType: 'ASSET_DISCOVERY',
      requestedIntensity: 'LOW',
    });
    expect(parsed.steps).toEqual([]);
    expect(parsed.yoloRequested).toBe(false);
    expect(parsed.highRiskConfirmed).toBe(false);
  });

  it('taskIntentResponse parses both plan-only and clarification-only shapes', () => {
    const planOnly = taskIntentResponseSchema.parse({
      taskId: 't1',
      lifecycleStage: 'AWAITING_CONFIRMATION',
      plan: {
        workflowType: 'ASSET_DISCOVERY',
        requestedIntensity: 'LOW',
        steps: [],
      },
    });
    expect(planOnly.plan).toBeDefined();
    expect(planOnly.clarifications).toBeUndefined();

    const clarOnly = taskIntentResponseSchema.parse({
      taskId: 't1',
      lifecycleStage: 'AWAITING_CLARIFICATION',
      clarifications: [
        {
          clarificationId: 'cl1',
          question: 'q?',
          answer: null,
          createdAt: '2025-01-01T00:00:00.000Z',
          answeredAt: null,
        },
      ],
    });
    expect(clarOnly.clarifications).toHaveLength(1);
  });
});
