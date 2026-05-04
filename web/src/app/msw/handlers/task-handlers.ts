import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import {
  createTaskCommandSchema,
  taskIntentRequestSchema,
  taskIntentResponseSchema,
  taskListResponseSchema,
  taskRecordSchema,
  type TaskClarification,
  type TaskRecord,
  type TaskStepResult,
  type WorkflowType,
} from '@/shared/contracts';

import { db } from '../db';
import { errorResponse, newId } from './_helpers';

function nowIso(): string {
  return new Date().toISOString();
}

function buildAssetDiscoveryPlan(): TaskStepResult[] {
  return [
    {
      stepId: newId('step'),
      stepType: 'subfinder',
      description: '枚举授权根域的子域名',
      targetRefs: ['example.com'],
      dependsOnStepIds: [],
      requiresConfirmation: false,
      executionStatus: 'PENDING',
    },
    {
      stepId: newId('step'),
      stepType: 'httpx',
      description: '对发现的子域名做 HTTP 存活探测',
      targetRefs: [],
      dependsOnStepIds: [],
      requiresConfirmation: false,
      executionStatus: 'PENDING',
    },
  ];
}

function buildHighRiskPlan(): TaskStepResult[] {
  return [
    {
      stepId: newId('step'),
      stepType: 'nmap',
      description: '高强度全端口探测',
      targetRefs: ['10.0.0.0/16'],
      dependsOnStepIds: [],
      requiresConfirmation: true,
      executionStatus: 'PENDING',
    },
    {
      stepId: newId('step'),
      stepType: 'nuclei',
      description: '使用全部 CVE 模板执行漏洞扫描',
      targetRefs: ['10.0.0.0/16'],
      dependsOnStepIds: [],
      requiresConfirmation: true,
      executionStatus: 'PENDING',
    },
  ];
}

function buildClarifications(): TaskClarification[] {
  return [
    {
      clarificationId: newId('cl'),
      question: '请指定要扫描的资产组（如 ag_corp_internal 或 ag_corp_public）',
      answer: null,
      createdAt: nowIso(),
      answeredAt: null,
    },
  ];
}

interface IntentInferenceResult {
  workflowType: WorkflowType;
  requestedIntensity: TaskRecord['requestedIntensity'];
  steps: TaskStepResult[];
  clarifications?: TaskClarification[];
}

function inferIntent(prompt: string): IntentInferenceResult {
  const text = prompt.toLowerCase();
  // Ambiguous prompts → require clarification first.
  if (text.includes('弱口令') || text.includes('weak')) {
    return {
      workflowType: 'WEAK_PASSWORD_SCAN',
      requestedIntensity: 'LOW',
      steps: [],
      clarifications: buildClarifications(),
    };
  }
  if (text.includes('高危') || text.includes('全部') || text.includes('high risk') || text.includes('all targets')) {
    return {
      workflowType: 'COMPREHENSIVE_SCAN',
      requestedIntensity: 'HIGH',
      steps: buildHighRiskPlan(),
    };
  }
  return {
    workflowType: 'ASSET_DISCOVERY',
    requestedIntensity: 'MEDIUM',
    steps: buildAssetDiscoveryPlan(),
  };
}

const taskListQuerySchema = z.object({
  assignee: z.string().optional(),
  workflowType: z.string().optional(),
  lifecycleStage: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const clarificationAnswerSchema = z.object({
  answer: z.string().min(1),
});

const confirmationSchema = z.object({
  note: z.string().nullable().optional(),
  highRiskConfirmed: z.boolean().default(false),
  yoloRequested: z.boolean().default(false),
});

function advanceDemoTask(task: TaskRecord, pollCount: number): TaskRecord {
  // For task_running_demo we walk through stages on each poll.
  if (task.taskId !== 'task_running_demo') return task;

  const stages: TaskRecord['lifecycleStage'][] = [
    'AWAITING_CONFIRMATION',
    'AWAITING_CONFIRMATION',
    'RUNNING',
    'RUNNING',
    'FINISHED',
  ];
  const cappedIdx = Math.min(pollCount, stages.length - 1);
  const newStage = stages[cappedIdx] ?? 'FINISHED';
  if (newStage === 'FINISHED') {
    const finishedSteps = task.steps.map((s) => ({
      ...s,
      executionStatus: 'SUCCESS' as const,
    }));
    return {
      ...task,
      lifecycleStage: 'FINISHED',
      state: 'SUCCESS',
      steps: finishedSteps,
      updatedAt: nowIso(),
    };
  }
  if (newStage === 'RUNNING') {
    const updatedSteps = task.steps.map((s, idx) => ({
      ...s,
      executionStatus: idx === 0 ? ('SUCCESS' as const) : ('PENDING' as const),
    }));
    return {
      ...task,
      lifecycleStage: 'RUNNING',
      steps: updatedSteps,
      updatedAt: nowIso(),
    };
  }
  return task;
}

export const taskHandlers = [
  // POST /api/tasks/intent — mock LLM front door
  http.post('/api/tasks/intent', async ({ request }) => {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Intent payload was not valid JSON.',
      });
    }
    const parsed = taskIntentRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'prompt is required.',
      });
    }
    const inference = inferIntent(parsed.data.prompt);
    const taskId = newId('task');
    const task: TaskRecord = {
      taskId,
      assetGroupId: null,
      workflowType: inference.workflowType,
      requestedIntensity: inference.requestedIntensity,
      yoloRequested: false,
      lifecycleStage:
        inference.clarifications && inference.clarifications.length > 0
          ? 'AWAITING_CLARIFICATION'
          : 'AWAITING_CONFIRMATION',
      state: inference.clarifications ? 'NEEDS_CLARIFICATION' : null,
      targets: [],
      steps: inference.steps,
      clarifications: inference.clarifications ?? [],
      confirmations: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db().tasks.set(taskId, task);

    const planForResponse = inference.clarifications
      ? undefined
      : {
          workflowType: inference.workflowType,
          requestedIntensity: inference.requestedIntensity,
          steps: inference.steps,
        };

    const responseBody = taskIntentResponseSchema.parse({
      taskId,
      lifecycleStage: task.lifecycleStage,
      ...(planForResponse !== undefined ? { plan: planForResponse } : {}),
      ...(inference.clarifications !== undefined
        ? { clarifications: inference.clarifications }
        : {}),
    });

    return HttpResponse.json(responseBody, { status: 200 });
  }),

  // POST /api/tasks — create structured task
  http.post('/api/tasks', async ({ request }) => {
    const payload = (await request.json()) as unknown;
    const parsed = createTaskCommandSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'CreateTaskCommand schema validation failed.',
        details: { issues: parsed.error.issues.map((i) => i.message) },
      });
    }
    const cmd = parsed.data;
    const requiresConfirmation =
      cmd.requestedIntensity === 'HIGH' && !cmd.highRiskConfirmed;

    const taskId = newId('task');
    const task: TaskRecord = {
      taskId,
      assetGroupId: cmd.assetGroupId ?? null,
      workflowType: cmd.workflowType,
      requestedIntensity: cmd.requestedIntensity,
      yoloRequested: cmd.yoloRequested,
      lifecycleStage: requiresConfirmation ? 'AWAITING_CONFIRMATION' : 'READY',
      state: null,
      targets: cmd.targets ?? [],
      steps: cmd.steps.map((s) => ({
        ...s,
        executionStatus: 'PENDING' as const,
      })),
      clarifications: [],
      confirmations: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db().tasks.set(taskId, task);

    return HttpResponse.json(taskRecordSchema.parse(task), { status: 201 });
  }),

  // GET /api/tasks — list
  http.get('/api/tasks', ({ request }) => {
    const url = new URL(request.url);
    const queryObj: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryObj[key] = value;
    });
    const parsed = taskListQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Invalid task list query.',
      });
    }
    const { workflowType, lifecycleStage, page, pageSize } = parsed.data;
    let items = Array.from(db().tasks.values());
    if (workflowType) {
      items = items.filter((t) => t.workflowType === workflowType);
    }
    if (lifecycleStage) {
      items = items.filter((t) => t.lifecycleStage === lifecycleStage);
    }
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const total = items.length;
    const start = (page - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);

    const responseBody = taskListResponseSchema.parse({
      items: slice,
      page,
      pageSize,
      total,
    });
    return HttpResponse.json(responseBody, { status: 200 });
  }),

  // GET /api/tasks/:taskId — detail (advances demo task on poll)
  http.get('/api/tasks/:taskId', ({ params }) => {
    const taskId = String(params.taskId);
    let task = db().tasks.get(taskId);
    if (!task) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Task ${taskId} not found.`,
      });
    }
    const prev = db().pollCounters.get(taskId) ?? 0;
    const next = prev + 1;
    db().pollCounters.set(taskId, next);
    task = advanceDemoTask(task, next);
    db().tasks.set(taskId, task);
    return HttpResponse.json(taskRecordSchema.parse(task), { status: 200 });
  }),

  // POST /api/tasks/:taskId/clarifications/:cid/answer
  http.post(
    '/api/tasks/:taskId/clarifications/:clarificationId/answer',
    async ({ params, request }) => {
      const taskId = String(params.taskId);
      const cid = String(params.clarificationId);
      const task = db().tasks.get(taskId);
      if (!task) {
        return errorResponse({
          status: 404,
          errorCode: 'TASK_EXECUTION_FAILED',
          message: `Task ${taskId} not found.`,
        });
      }
      const payload = (await request.json()) as unknown;
      const parsed = clarificationAnswerSchema.safeParse(payload);
      if (!parsed.success) {
        return errorResponse({
          status: 400,
          errorCode: 'SCHEMA_VALIDATION_FAILED',
          message: 'answer is required.',
        });
      }
      const answeredAt = nowIso();
      const updatedClarifications = task.clarifications.map((c) =>
        c.clarificationId === cid
          ? { ...c, answer: parsed.data.answer, answeredAt }
          : c,
      );
      const allAnswered = updatedClarifications.every(
        (c) => c.answeredAt !== null,
      );
      const updated: TaskRecord = {
        ...task,
        clarifications: updatedClarifications,
        // When all answered, we synthesize a plan and move to AWAITING_CONFIRMATION.
        lifecycleStage: allAnswered ? 'AWAITING_CONFIRMATION' : task.lifecycleStage,
        steps:
          allAnswered && task.steps.length === 0
            ? buildAssetDiscoveryPlan()
            : task.steps,
        state: allAnswered ? null : task.state,
        updatedAt: answeredAt,
      };
      db().tasks.set(taskId, updated);
      return HttpResponse.json(taskRecordSchema.parse(updated), { status: 200 });
    },
  ),

  // POST /api/tasks/:taskId/confirmations
  http.post('/api/tasks/:taskId/confirmations', async ({ params, request }) => {
    const taskId = String(params.taskId);
    const task = db().tasks.get(taskId);
    if (!task) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Task ${taskId} not found.`,
      });
    }
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }
    const parsed = confirmationSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Confirmation payload invalid.',
      });
    }
    if (
      task.requestedIntensity === 'HIGH' &&
      !parsed.data.highRiskConfirmed
    ) {
      return errorResponse({
        status: 409,
        errorCode: 'CONFIRMATION_REQUIRED',
        message: 'High-intensity tasks require explicit highRiskConfirmed=true.',
      });
    }
    const confirmedAt = nowIso();
    const actor = db().actor;
    const updated: TaskRecord = {
      ...task,
      lifecycleStage: 'RUNNING',
      yoloRequested: parsed.data.yoloRequested,
      confirmations: [
        ...task.confirmations,
        {
          confirmationId: newId('cf'),
          actorId: actor?.actorId ?? 'actor_anonymous',
          note: parsed.data.note ?? null,
          confirmedAt,
        },
      ],
      updatedAt: confirmedAt,
    };
    db().tasks.set(taskId, updated);
    return HttpResponse.json(taskRecordSchema.parse(updated), { status: 200 });
  }),

  // POST /api/tasks/:taskId/cancel — kill switch (requires task:cancel)
  http.post('/api/tasks/:taskId/cancel', ({ params }) => {
    const actor = db().actor;
    if (!actor || !actor.permissionPoints.includes('task:cancel')) {
      return errorResponse({
        status: 403,
        errorCode: 'AUTHORIZATION_DENIED',
        message: '当前角色缺少 task:cancel 权限。',
        details: { missingPermission: 'task:cancel' },
      });
    }
    const taskId = String(params.taskId);
    const task = db().tasks.get(taskId);
    if (!task) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Task ${taskId} not found.`,
      });
    }
    const cancelledAt = nowIso();
    const updated: TaskRecord = {
      ...task,
      lifecycleStage: 'FINISHED',
      state: 'CANCELLED',
      steps: task.steps.map((s) =>
        s.executionStatus === 'PENDING'
          ? { ...s, executionStatus: 'CANCELLED' as const }
          : s,
      ),
      updatedAt: cancelledAt,
    };
    db().tasks.set(taskId, updated);
    return HttpResponse.json(taskRecordSchema.parse(updated), { status: 200 });
  }),
];
