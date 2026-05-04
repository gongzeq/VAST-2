import { randomUUID } from 'node:crypto';
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

export class DomainError extends Error {
  readonly errorCode: DomainErrorCode;
  readonly taskState?: TaskState;
  readonly details: SafeDetails;

  constructor(params: {
    errorCode: DomainErrorCode;
    message: string;
    taskState?: TaskState;
    details?: SafeDetails;
  }) {
    super(params.message);
    this.name = 'DomainError';
    this.errorCode = params.errorCode;
    this.taskState = params.taskState;
    this.details = params.details ?? {};
  }
}

export class NeedsClarificationError extends DomainError {
  constructor(details: SafeDetails = {}, message = 'More information is required to continue.') {
    super({
      errorCode: 'NEEDS_CLARIFICATION',
      message,
      taskState: 'NEEDS_CLARIFICATION',
      details,
    });
    this.name = 'NeedsClarificationError';
  }
}

export class AuthorizationDeniedError extends DomainError {
  constructor(details: SafeDetails = {}, message = 'You do not have permission to perform this action.') {
    super({
      errorCode: 'AUTHORIZATION_DENIED',
      message,
      details,
    });
    this.name = 'AuthorizationDeniedError';
  }
}

export class AssetScopeBlockedError extends DomainError {
  constructor(details: SafeDetails = {}, message = 'Target is outside the authorized asset scope.') {
    super({
      errorCode: 'ASSET_SCOPE_BLOCKED',
      message,
      taskState: 'BLOCKED',
      details,
    });
    this.name = 'AssetScopeBlockedError';
  }
}

export class PolicyConfirmationRequiredError extends DomainError {
  constructor(details: SafeDetails = {}, message = 'Explicit confirmation is required before this action can continue.') {
    super({
      errorCode: 'CONFIRMATION_REQUIRED',
      message,
      details,
    });
    this.name = 'PolicyConfirmationRequiredError';
  }
}

export class SchemaValidationError extends DomainError {
  constructor(details: SafeDetails = {}, message = 'Request payload does not satisfy the backend schema.') {
    super({
      errorCode: 'SCHEMA_VALIDATION_FAILED',
      message,
      details,
    });
    this.name = 'SchemaValidationError';
  }
}

export class TaskExecutionFailedError extends DomainError {
  constructor(details: SafeDetails = {}, message = 'Task execution failed and cannot continue safely.') {
    super({
      errorCode: 'TASK_EXECUTION_FAILED',
      message,
      taskState: 'FAILED',
      details,
    });
    this.name = 'TaskExecutionFailedError';
  }
}

export class TaskExecutionPartialFailureError extends DomainError {
  constructor(details: SafeDetails = {}, message = 'Task execution completed with partial failure.') {
    super({
      errorCode: 'TASK_PARTIAL_FAILURE',
      message,
      taskState: 'PARTIAL_SUCCESS',
      details,
    });
    this.name = 'TaskExecutionPartialFailureError';
  }
}

export class KillSwitchCancelledError extends DomainError {
  constructor(details: SafeDetails = {}, message = 'Task execution was cancelled.') {
    super({
      errorCode: 'TASK_CANCELLED',
      message,
      taskState: 'CANCELLED',
      details,
    });
    this.name = 'KillSwitchCancelledError';
  }
}

export class SensitiveExportExpiredError extends DomainError {
  constructor(details: SafeDetails = {}, message = 'Sensitive export is no longer available.') {
    super({
      errorCode: 'SENSITIVE_EXPORT_EXPIRED',
      message,
      details,
    });
    this.name = 'SensitiveExportExpiredError';
  }
}

export class LogIngestRejectedError extends DomainError {
  constructor(details: SafeDetails = {}, message = 'Log ingest request was rejected by policy.') {
    super({
      errorCode: 'LOG_INGEST_REJECTED',
      message,
      details,
    });
    this.name = 'LogIngestRejectedError';
  }
}

export const createId = (prefix: string): string => `${prefix}_${randomUUID().replaceAll('-', '')}`;
