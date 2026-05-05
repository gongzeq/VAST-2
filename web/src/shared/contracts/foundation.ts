/**
 * Frontend mirror of the backend foundation contract.
 * Source of truth: src/shared/contracts/foundation.ts
 * Field names and enum values must remain in sync.
 *
 * NOTE: this file deliberately does NOT import from backend src/. It exists
 * because backend code uses Node-only APIs (`crypto.randomUUID`,
 * `structuredClone`) that are not safe for browser bundles.
 */
import { z } from 'zod';

export const taskStates = [
  'SUCCESS',
  'PARTIAL_SUCCESS',
  'FAILED',
  'NEEDS_CLARIFICATION',
  'BLOCKED',
  'CANCELLED',
] as const;

export const taskStateSchema = z.enum(taskStates);
export type TaskState = z.infer<typeof taskStateSchema>;

export const assetDiscoveryStates = [
  'DISCOVERED_PENDING_CONFIRMATION',
  'CONFIRMED',
  'REJECTED',
  'OUT_OF_SCOPE_DISCOVERED',
] as const;

export const assetDiscoveryStateSchema = z.enum(assetDiscoveryStates);
export type AssetDiscoveryState = z.infer<typeof assetDiscoveryStateSchema>;

export const executionIntensities = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const executionIntensitySchema = z.enum(executionIntensities);
export type ExecutionIntensity = z.infer<typeof executionIntensitySchema>;

export const permissionPoints = [
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
  'dashboard:view',
  'llm_provider:manage',
  'tool_config:manage',
  'kill_switch:operate',
] as const;

export const permissionPointSchema = z.enum(permissionPoints);
export type PermissionPoint = z.infer<typeof permissionPointSchema>;

export const domainErrorCodes = [
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
] as const;

export const domainErrorCodeSchema = z.enum(domainErrorCodes);
export type DomainErrorCode = z.infer<typeof domainErrorCodeSchema>;

export const safeDetailValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
  z.array(z.number()),
  z.array(z.boolean()),
]);

export const safeDetailsSchema = z.record(safeDetailValueSchema);
export type SafeDetails = z.infer<typeof safeDetailsSchema>;
