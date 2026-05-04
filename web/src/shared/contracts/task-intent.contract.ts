/**
 * UI-only contract: response shape from `/api/tasks/intent`. This endpoint is
 * a mock-LLM front-door that returns either a draft plan or clarifications.
 */
import { z } from 'zod';

import {
  taskClarificationSchema,
  taskLifecycleStageSchema,
} from './task-execution.contract';
import { executionIntensitySchema } from './foundation';
import {
  taskPlanStepSchema,
  workflowTypeSchema,
} from './task-plan.contract';

export const taskIntentPlanSchema = z.object({
  workflowType: workflowTypeSchema,
  requestedIntensity: executionIntensitySchema,
  steps: z.array(taskPlanStepSchema),
});

export type TaskIntentPlan = z.infer<typeof taskIntentPlanSchema>;

export const taskIntentResponseSchema = z.object({
  taskId: z.string().min(1),
  lifecycleStage: taskLifecycleStageSchema,
  plan: taskIntentPlanSchema.optional(),
  clarifications: z.array(taskClarificationSchema).optional(),
});

export type TaskIntentResponse = z.infer<typeof taskIntentResponseSchema>;

export const taskIntentRequestSchema = z.object({
  prompt: z.string().min(1),
});

export type TaskIntentRequest = z.infer<typeof taskIntentRequestSchema>;
