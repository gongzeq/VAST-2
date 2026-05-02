import { z } from 'zod';

import { assetTargetSchema } from '../../asset-scope/contracts/asset-authorization.contract.js';
import { executionIntensitySchema, taskStateSchema } from '../../../shared/contracts/foundation.js';
import { taskPlanStepSchema, workflowTypeSchema } from '../../task-planning/contracts/task-plan.contract.js';

export const taskLifecycleStages = [
  'CREATED',
  'AWAITING_CLARIFICATION',
  'AWAITING_CONFIRMATION',
  'READY',
  'RUNNING',
  'FINISHED',
] as const;

export const taskLifecycleStageSchema = z.enum(taskLifecycleStages);
export type TaskLifecycleStage = z.infer<typeof taskLifecycleStageSchema>;

export const taskStepExecutionStatuses = ['PENDING', 'SUCCESS', 'FAILED', 'SKIPPED', 'CANCELLED'] as const;
export const taskStepExecutionStatusSchema = z.enum(taskStepExecutionStatuses);
export type TaskStepExecutionStatus = z.infer<typeof taskStepExecutionStatusSchema>;

export const taskClarificationSchema = z.object({
  clarificationId: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().nullable(),
  createdAt: z.string().min(1),
  answeredAt: z.string().nullable(),
});

export type TaskClarification = z.infer<typeof taskClarificationSchema>;

export const taskConfirmationSchema = z.object({
  confirmationId: z.string().min(1),
  actorId: z.string().min(1),
  note: z.string().nullable(),
  confirmedAt: z.string().min(1),
});

export type TaskConfirmation = z.infer<typeof taskConfirmationSchema>;

export const taskStepResultSchema = taskPlanStepSchema.extend({
  executionStatus: taskStepExecutionStatusSchema,
});

export type TaskStepResult = z.infer<typeof taskStepResultSchema>;

export const taskRecordSchema = z.object({
  taskId: z.string().min(1),
  assetGroupId: z.string().nullable(),
  workflowType: workflowTypeSchema,
  requestedIntensity: executionIntensitySchema,
  yoloRequested: z.boolean(),
  lifecycleStage: taskLifecycleStageSchema,
  state: taskStateSchema.nullable(),
  targets: z.array(assetTargetSchema),
  steps: z.array(taskStepResultSchema),
  clarifications: z.array(taskClarificationSchema),
  confirmations: z.array(taskConfirmationSchema),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type TaskRecord = z.infer<typeof taskRecordSchema>;

export interface TaskRepository {
  save(task: TaskRecord): TaskRecord;
  get(taskId: string): TaskRecord | undefined;
}

export class InMemoryTaskRepository implements TaskRepository {
  readonly #tasks = new Map<string, TaskRecord>();

  save(task: TaskRecord): TaskRecord {
    const persisted = structuredClone(task);
    this.#tasks.set(task.taskId, persisted);
    return structuredClone(persisted);
  }

  get(taskId: string): TaskRecord | undefined {
    const task = this.#tasks.get(taskId);
    return task ? structuredClone(task) : undefined;
  }
}
