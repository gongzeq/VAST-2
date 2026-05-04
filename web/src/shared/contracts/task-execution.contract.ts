/**
 * Frontend mirror of src/modules/task-execution/contracts/task-execution.contract.ts.
 * The InMemoryTaskRepository class from the backend is intentionally NOT
 * mirrored: it uses Node-only `structuredClone`. The MSW handlers maintain
 * their own in-memory db instead.
 */
import { z } from 'zod';

import { assetTargetSchema } from './asset-authorization.contract';
import { executionIntensitySchema, taskStateSchema } from './foundation';
import { taskPlanStepSchema, workflowTypeSchema } from './task-plan.contract';

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

export const taskStepExecutionStatuses = [
  'PENDING',
  'SUCCESS',
  'FAILED',
  'SKIPPED',
  'CANCELLED',
] as const;

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

export const taskListResponseSchema = z.object({
  items: z.array(taskRecordSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});

export type TaskListResponse = z.infer<typeof taskListResponseSchema>;

/**
 * Lifecycle stages that mean execution is over and the page should stop polling.
 */
export const terminalLifecycleStages: ReadonlySet<TaskLifecycleStage> = new Set(['FINISHED']);

export function isTerminalLifecycle(stage: TaskLifecycleStage): boolean {
  return terminalLifecycleStages.has(stage);
}
