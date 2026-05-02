import {
  AssetScopeBlockedError,
  AuthorizationDeniedError,
  PolicyConfirmationRequiredError,
  SchemaValidationError,
  TaskExecutionFailedError,
  createId,
  type SafeDetails,
} from '../../../shared/contracts/foundation.js';
import { InMemoryAuditLog } from '../../audit/persistence/in-memory-audit-log.js';
import { type AssetTarget, type AssetWhitelistEntry } from '../../asset-scope/contracts/asset-authorization.contract.js';
import { AssetScopeService } from '../../asset-scope/domain/asset-scope-service.js';
import { type ActorContext } from '../../auth/contracts/actor-context.contract.js';
import { AuthorizationService } from '../../auth/domain/authorization-service.js';
import { createTaskCommandSchema, type CreateTaskCommand } from '../../task-planning/contracts/task-plan.contract.js';
import {
  InMemoryTaskRepository,
  type TaskRecord,
  type TaskRepository,
  type TaskStepResult,
  taskStepResultSchema,
} from '../contracts/task-execution.contract.js';

const now = (): string => new Date().toISOString();

const buildClarificationQuestions = (command: CreateTaskCommand): string[] => {
  const questions: string[] = [];

  if (!command.assetGroupId) {
    questions.push('Please specify the authorized asset group for this task.');
  }

  if (!command.targets || command.targets.length === 0) {
    questions.push('Please provide at least one authorized target.');
  }

  return questions;
};

const toPendingStepResults = (command: CreateTaskCommand): TaskStepResult[] => {
  return command.steps.map((step: CreateTaskCommand['steps'][number]) => ({
    ...step,
    executionStatus: 'PENDING',
  }));
};

const computeTerminalState = (stepResults: TaskStepResult[]): 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' => {
  const successfulSteps = stepResults.filter((step) => step.executionStatus === 'SUCCESS').length;
  const failedSteps = stepResults.filter((step) => step.executionStatus === 'FAILED').length;

  if (successfulSteps > 0 && failedSteps > 0) {
    return 'PARTIAL_SUCCESS';
  }

  if (failedSteps > 0) {
    return 'FAILED';
  }

  return 'SUCCESS';
};

type CreateTaskParams = {
  actor: ActorContext;
  command: unknown;
  whitelistEntries: AssetWhitelistEntry[];
};

type SubmitClarificationParams = {
  actor: ActorContext;
  taskId: string;
  assetGroupId: string;
  targets: AssetTarget[];
  whitelistEntries: AssetWhitelistEntry[];
  highRiskConfirmed?: boolean;
};

type ConfirmTaskParams = {
  actor: ActorContext;
  taskId: string;
  note?: string;
};

type StartTaskParams = {
  actor: ActorContext;
  taskId: string;
};

type CompleteTaskParams = {
  actor: ActorContext;
  taskId: string;
  stepResults: unknown;
};

type CancelTaskParams = {
  actor: ActorContext;
  taskId: string;
  reason: string;
};

export class TaskManagementService {
  readonly #authorization: AuthorizationService;
  readonly #assetScope: AssetScopeService;
  readonly #auditLog: InMemoryAuditLog;
  readonly #taskRepository: TaskRepository;

  constructor(deps?: {
    authorization?: AuthorizationService;
    assetScope?: AssetScopeService;
    auditLog?: InMemoryAuditLog;
    taskRepository?: TaskRepository;
  }) {
    this.#authorization = deps?.authorization ?? new AuthorizationService();
    this.#assetScope = deps?.assetScope ?? new AssetScopeService();
    this.#auditLog = deps?.auditLog ?? new InMemoryAuditLog();
    this.#taskRepository = deps?.taskRepository ?? new InMemoryTaskRepository();
  }

  get auditLog(): InMemoryAuditLog {
    return this.#auditLog;
  }

  get repository(): TaskRepository {
    return this.#taskRepository;
  }

  createTask(params: CreateTaskParams): TaskRecord {
    this.#authorization.requirePermission(params.actor, 'task:create');

    const parsedCommand = createTaskCommandSchema.safeParse(params.command);
    if (!parsedCommand.success) {
      throw new SchemaValidationError({
        issues: parsedCommand.error.issues.map((issue: { path: (string | number)[]; message: string }) => issue.path.join('.') || issue.message),
      });
    }

    const command = parsedCommand.data;

    if (command.yoloRequested) {
      this.#authorization.requirePermission(params.actor, 'task:yolo_execute');
      if (!params.actor.yoloEnabled) {
        throw new AuthorizationDeniedError({
          actor_id: params.actor.actorId,
          reason: 'yolo_disabled',
        });
      }
    }

    const task = this.#buildTaskRecord(command);
    this.#audit(params.actor.actorId, 'TASK_CREATED', task.taskId, {
      workflow_type: task.workflowType,
    });

    const clarificationQuestions = buildClarificationQuestions(command);
    if (clarificationQuestions.length > 0) {
      task.lifecycleStage = 'AWAITING_CLARIFICATION';
      task.state = 'NEEDS_CLARIFICATION';
      task.clarifications = clarificationQuestions.map((question) => ({
        clarificationId: createId('clarification'),
        question,
        answer: null,
        createdAt: now(),
        answeredAt: null,
      }));
      task.updatedAt = now();
      this.#audit(params.actor.actorId, 'TASK_CLARIFICATION_REQUESTED', task.taskId, {
        clarification_count: task.clarifications.length,
      });
      return this.#taskRepository.save(task);
    }

    return this.#evaluateTaskReadiness({
      actor: params.actor,
      task,
      whitelistEntries: params.whitelistEntries,
      highRiskConfirmed: command.highRiskConfirmed,
    });
  }

  submitClarification(params: SubmitClarificationParams): TaskRecord {
    const task = this.#mustGetTask(params.taskId);
    if (task.lifecycleStage !== 'AWAITING_CLARIFICATION') {
      throw new SchemaValidationError({
        task_id: params.taskId,
        lifecycle_stage: task.lifecycleStage,
      });
    }

    task.assetGroupId = params.assetGroupId;
    task.targets = params.targets;
    task.clarifications = task.clarifications.map((clarification: TaskRecord['clarifications'][number]) => ({
      ...clarification,
      answer: clarification.answer ?? 'submitted',
      answeredAt: clarification.answeredAt ?? now(),
    }));
    task.updatedAt = now();

    this.#audit(params.actor.actorId, 'TASK_CLARIFICATION_SUBMITTED', task.taskId, {
      clarification_count: task.clarifications.length,
    });

    return this.#evaluateTaskReadiness({
      actor: params.actor,
      task,
      whitelistEntries: params.whitelistEntries,
      highRiskConfirmed: params.highRiskConfirmed ?? false,
    });
  }

  confirmTask(params: ConfirmTaskParams): TaskRecord {
    this.#authorization.requirePermission(params.actor, 'task:confirm');

    const task = this.#mustGetTask(params.taskId);
    if (task.lifecycleStage !== 'AWAITING_CONFIRMATION') {
      throw new PolicyConfirmationRequiredError({
        task_id: task.taskId,
        lifecycle_stage: task.lifecycleStage,
      });
    }

    task.lifecycleStage = 'READY';
    task.confirmations.push({
      confirmationId: createId('confirmation'),
      actorId: params.actor.actorId,
      note: params.note ?? null,
      confirmedAt: now(),
    });
    task.updatedAt = now();

    this.#audit(params.actor.actorId, 'TASK_CONFIRMED', task.taskId, {
      confirmation_count: task.confirmations.length,
    });

    return this.#taskRepository.save(task);
  }

  startTask(params: StartTaskParams): TaskRecord {
    this.#authorization.requirePermission(params.actor, 'task:create');

    const task = this.#mustGetTask(params.taskId);
    if (task.state === 'BLOCKED' || task.state === 'NEEDS_CLARIFICATION' || task.state === 'CANCELLED') {
      throw new TaskExecutionFailedError({
        task_id: task.taskId,
        task_state: task.state,
      });
    }

    if (task.lifecycleStage !== 'READY') {
      throw new TaskExecutionFailedError({
        task_id: task.taskId,
        lifecycle_stage: task.lifecycleStage,
      });
    }

    task.lifecycleStage = 'RUNNING';
    task.updatedAt = now();
    this.#audit(params.actor.actorId, 'TASK_STARTED', task.taskId, {});
    return this.#taskRepository.save(task);
  }

  completeTask(params: CompleteTaskParams): TaskRecord {
    this.#authorization.requirePermission(params.actor, 'task:create');

    const task = this.#mustGetTask(params.taskId);
    if (task.lifecycleStage !== 'RUNNING') {
      throw new TaskExecutionFailedError({
        task_id: task.taskId,
        lifecycle_stage: task.lifecycleStage,
      });
    }

    const parsedStepResults = taskStepResultSchema.array().safeParse(params.stepResults);
    if (!parsedStepResults.success) {
      throw new SchemaValidationError({
        issues: parsedStepResults.error.issues.map((issue: { path: (string | number)[]; message: string }) => issue.path.join('.') || issue.message),
      });
    }

    task.steps = parsedStepResults.data;
    task.lifecycleStage = 'FINISHED';
    task.state = computeTerminalState(parsedStepResults.data);
    task.updatedAt = now();

    this.#audit(params.actor.actorId, 'TASK_COMPLETED', task.taskId, {
      task_state: task.state,
    });

    return this.#taskRepository.save(task);
  }

  cancelTask(params: CancelTaskParams): TaskRecord {
    this.#authorization.requirePermission(params.actor, 'task:cancel');

    const task = this.#mustGetTask(params.taskId);
    task.lifecycleStage = 'FINISHED';
    task.state = 'CANCELLED';
    task.updatedAt = now();

    this.#audit(params.actor.actorId, 'TASK_CANCELLED', task.taskId, {
      reason: params.reason,
    });

    return this.#taskRepository.save(task);
  }

  #evaluateTaskReadiness(params: {
    actor: ActorContext;
    task: TaskRecord;
    whitelistEntries: AssetWhitelistEntry[];
    highRiskConfirmed: boolean;
  }): TaskRecord {
    if (!params.task.assetGroupId) {
      throw new SchemaValidationError({
        task_id: params.task.taskId,
        asset_group_id: null,
      });
    }

    if (!this.#authorization.canAccessAssetGroup(params.actor, params.task.assetGroupId)) {
      return this.#blockTask(params.actor.actorId, params.task, {
        asset_group_id: params.task.assetGroupId,
        reason: 'asset_group_not_authorized',
      });
    }

    try {
      params.task.targets.forEach((target: AssetTarget) => {
        this.#assetScope.assertTargetAuthorized(params.task.assetGroupId as string, target, params.whitelistEntries);
      });
    } catch (error) {
      if (error instanceof AssetScopeBlockedError) {
        return this.#blockTask(params.actor.actorId, params.task, error.details);
      }
      throw error;
    }

    if (params.task.requestedIntensity === 'HIGH' && !params.highRiskConfirmed) {
      params.task.lifecycleStage = 'AWAITING_CONFIRMATION';
      params.task.state = null;
      params.task.updatedAt = now();
      this.#audit(params.actor.actorId, 'TASK_CONFIRMATION_REQUESTED', params.task.taskId, {
        intensity: params.task.requestedIntensity,
      });
      return this.#taskRepository.save(params.task);
    }

    params.task.lifecycleStage = 'READY';
    params.task.state = null;
    params.task.updatedAt = now();
    return this.#taskRepository.save(params.task);
  }

  #blockTask(actorId: string, task: TaskRecord, details: SafeDetails): TaskRecord {
    task.lifecycleStage = 'FINISHED';
    task.state = 'BLOCKED';
    task.updatedAt = now();
    this.#audit(actorId, 'TASK_BLOCKED', task.taskId, details);
    return this.#taskRepository.save(task);
  }

  #buildTaskRecord(command: CreateTaskCommand): TaskRecord {
    const createdAt = now();
    return {
      taskId: createId('task'),
      assetGroupId: command.assetGroupId ?? null,
      workflowType: command.workflowType,
      requestedIntensity: command.requestedIntensity,
      yoloRequested: command.yoloRequested,
      lifecycleStage: 'CREATED',
      state: null,
      targets: command.targets ?? [],
      steps: toPendingStepResults(command),
      clarifications: [],
      confirmations: [],
      createdAt,
      updatedAt: createdAt,
    };
  }

  #mustGetTask(taskId: string): TaskRecord {
    const task = this.#taskRepository.get(taskId);
    if (!task) {
      throw new SchemaValidationError({
        task_id: taskId,
        reason: 'task_not_found',
      });
    }
    return task;
  }

  #audit(actorId: string, action: Parameters<InMemoryAuditLog['append']>[0]['action'], resourceId: string, details: SafeDetails): void {
    this.#auditLog.append({
      actorId,
      action,
      resourceType: 'task',
      resourceId,
      details,
    });
  }
}
