import { z } from 'zod';

import { assetTargetSchema } from '../../asset-scope/contracts/asset-authorization.contract.js';
import { executionIntensitySchema } from '../../../shared/contracts/foundation.js';

export const workflowTypes = [
  'ASSET_DISCOVERY',
  'SERVICE_DISCOVERY',
  'VULNERABILITY_SCAN',
  'WEAK_PASSWORD_SCAN',
  'COMPREHENSIVE_SCAN',
  'LOG_ANALYSIS',
  'MAIL_ANALYSIS',
] as const;

export const workflowTypeSchema = z.enum(workflowTypes);
export type WorkflowType = z.infer<typeof workflowTypeSchema>;

export const taskPlanStepSchema = z.object({
  stepId: z.string().min(1),
  stepType: z.string().min(1),
  description: z.string().min(1),
  targetRefs: z.array(z.string().min(1)).default([]),
  dependsOnStepIds: z.array(z.string().min(1)).default([]),
  requiresConfirmation: z.boolean().default(false),
});

export type TaskPlanStep = z.infer<typeof taskPlanStepSchema>;

export const createTaskCommandSchema = z.object({
  assetGroupId: z.string().min(1).optional(),
  workflowType: workflowTypeSchema,
  requestedIntensity: executionIntensitySchema,
  yoloRequested: z.boolean().default(false),
  highRiskConfirmed: z.boolean().default(false),
  targets: z.array(assetTargetSchema).optional(),
  steps: z.array(taskPlanStepSchema).default([]),
});

export type CreateTaskCommand = z.infer<typeof createTaskCommandSchema>;
