import { z } from 'zod';

import { executionIntensitySchema } from '../../../shared/contracts/foundation.js';

export const toolExecutionStatuses = ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED'] as const;
export const toolExecutionStatusSchema = z.enum(toolExecutionStatuses);
export type ToolExecutionStatus = z.infer<typeof toolExecutionStatusSchema>;

export const toolTypes = [
  'SUBDOMAIN_ENUMERATION',
  'HTTP_PROBE',
  'PORT_SCAN',
  'SERVICE_DETECTION',
  'VULNERABILITY_SCAN',
  'WEAK_PASSWORD_SCAN',
] as const;

export const toolTypeSchema = z.enum(toolTypes);
export type ToolType = z.infer<typeof toolTypeSchema>;

export const toolParameterSchema = z.object({
  name: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  source: z.enum(['intensity_mapping', 'static', 'user_override']),
});

export type ToolParameter = z.infer<typeof toolParameterSchema>;

export const toolVersionSchema = z.object({
  toolName: z.string().min(1),
  version: z.string().min(1),
  checksum: z.string().optional(),
});

export type ToolVersion = z.infer<typeof toolVersionSchema>;

export const toolExecutionMetadataSchema = z.object({
  executionId: z.string().min(1),
  toolType: toolTypeSchema,
  toolVersion: toolVersionSchema,
  startedAt: z.string().min(1),
  completedAt: z.string().nullable(),
  durationMs: z.number().int().min(0),
  parameters: z.array(toolParameterSchema),
  exitCode: z.number().int().nullable(),
  stdoutSha256: z.string().nullable(),
  stderrSha256: z.string().nullable(),
  artifactPaths: z.array(z.string()),
});

export type ToolExecutionMetadata = z.infer<typeof toolExecutionMetadataSchema>;

export const toolExecutionResultSchema = z.object({
  executionId: z.string().min(1),
  status: toolExecutionStatusSchema,
  metadata: toolExecutionMetadataSchema,
  findings: z.array(z.record(z.unknown())).default([]),
  errorMessage: z.string().nullable(),
});

export type ToolExecutionResult = z.infer<typeof toolExecutionResultSchema>;

export const toolConfigSchema = z.object({
  toolType: toolTypeSchema,
  toolName: z.string().min(1),
  baseCommand: z.array(z.string().min(1)),
  allowedParameters: z.array(z.object({
    name: z.string().min(1),
    flag: z.string().min(1),
    valueType: z.enum(['string', 'number', 'boolean', 'string_array']),
    required: z.boolean().default(false),
  })),
  intensityMappings: z.record(z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))),
  timeoutSeconds: z.number().int().min(1).default(300),
  maxConcurrency: z.number().int().min(1).default(1),
});

export type ToolConfig = z.infer<typeof toolConfigSchema>;

export const toolExecutionRequestSchema = z.object({
  toolType: toolTypeSchema,
  intensity: executionIntensitySchema,
  target: z.string().min(1),
  additionalParameters: z.record(z.unknown()).default({}),
  timeoutSeconds: z.number().int().min(1).optional(),
});

export type ToolExecutionRequest = z.infer<typeof toolExecutionRequestSchema>;
