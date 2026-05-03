import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';

import {
  DomainError,
  SchemaValidationError,
  TaskExecutionFailedError,
  type SafeDetails,
} from '../../../shared/contracts/foundation.js';
import { InMemoryAuditLog } from '../../audit/persistence/in-memory-audit-log.js';
import { type ActorContext } from '../../auth/contracts/actor-context.contract.js';
import {
  type ToolConfig,
  type ToolExecutionMetadata,
  type ToolExecutionRequest,
  type ToolExecutionResult,
  toolExecutionRequestSchema,
  toolExecutionResultSchema,
  type ToolExecutionStatus,
  type ToolParameter,
  type ToolVersion,
} from '../contracts/tool-execution.contract.js';
import { IntensityMapper } from './intensity-mapper.js';

const now = (): string => new Date().toISOString();

type CancellationReason = 'user_request' | 'kill_switch' | 'timeout';

const toValidationIssues = (issues: Array<{ path: (string | number)[]; message: string }>): string[] => {
  return issues.map((issue) => issue.path.join('.') || issue.message);
};

export interface ExecutionRuntime {
  execute(command: string[], timeoutSeconds: number, signal?: AbortSignal): Promise<{
    exitCode: number;
    stdout: Buffer;
    stderr: Buffer;
  }>;
}

export class MockExecutionRuntime implements ExecutionRuntime {
  readonly #mockResponses: Map<string, { exitCode: number; stdout: string; stderr: string }>;

  constructor(mockResponses?: Map<string, { exitCode: number; stdout: string; stderr: string }>) {
    this.#mockResponses = mockResponses ?? new Map();
  }

  setMockResponse(commandKey: string, response: { exitCode: number; stdout: string; stderr: string }): void {
    this.#mockResponses.set(commandKey, response);
  }

  async execute(command: string[], timeoutSeconds: number, signal?: AbortSignal): Promise<{
    exitCode: number;
    stdout: Buffer;
    stderr: Buffer;
  }> {
    if (signal?.aborted) {
      const error = new Error('Execution aborted.');
      error.name = 'AbortError';
      throw error;
    }

    const key = command.join(' ');
    const response = this.#mockResponses.get(key) ?? { exitCode: 0, stdout: '', stderr: '' };
    return {
      exitCode: response.exitCode,
      stdout: Buffer.from(response.stdout),
      stderr: Buffer.from(response.stderr),
    };
  }
}

export class ToolRunnerService {
  readonly #intensityMapper: IntensityMapper;
  readonly #auditLog: InMemoryAuditLog;
  readonly #runtime: ExecutionRuntime;
  readonly #killSwitch: { isActive: boolean };
  readonly #activeExecutions: Map<string, AbortController>;
  readonly #cancellationRequests: Map<string, { reason: CancellationReason; actorId?: string }>;

  constructor(deps?: {
    intensityMapper?: IntensityMapper;
    auditLog?: InMemoryAuditLog;
    runtime?: ExecutionRuntime;
    killSwitch?: { isActive: boolean };
  }) {
    this.#intensityMapper = deps?.intensityMapper ?? new IntensityMapper();
    this.#auditLog = deps?.auditLog ?? new InMemoryAuditLog();
    this.#runtime = deps?.runtime ?? new MockExecutionRuntime();
    this.#killSwitch = deps?.killSwitch ?? { isActive: false };
    this.#activeExecutions = new Map();
    this.#cancellationRequests = new Map();
  }

  get intensityMapper(): IntensityMapper {
    return this.#intensityMapper;
  }

  get auditLog(): InMemoryAuditLog {
    return this.#auditLog;
  }

  listActiveExecutionIds(): string[] {
    return Array.from(this.#activeExecutions.keys());
  }

  registerToolConfig(config: ToolConfig): void {
    this.#intensityMapper.registerConfig(config);
  }

  async execute(
    request: ToolExecutionRequest,
    actor: ActorContext,
    toolVersion: ToolVersion
  ): Promise<ToolExecutionResult> {
    const parsedRequest = toolExecutionRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      throw new SchemaValidationError({
        issues: toValidationIssues(parsedRequest.error.issues),
      });
    }

    const normalizedRequest = parsedRequest.data;
    const executionId = `exec_${randomUUID().replaceAll('-', '')}`;
    const startedAt = now();

    const config = this.#intensityMapper.getConfig(normalizedRequest.toolType);
    if (!config) {
      throw new TaskExecutionFailedError({
        tool_type: normalizedRequest.toolType,
        reason: 'tool_config_not_found',
      });
    }

    const parameters = this.#intensityMapper.mapParameters(
      normalizedRequest.toolType,
      normalizedRequest.intensity,
      normalizedRequest.additionalParameters
    );

    const metadata: ToolExecutionMetadata = {
      executionId,
      toolType: normalizedRequest.toolType,
      toolVersion,
      startedAt,
      completedAt: null,
      durationMs: 0,
      parameters,
      exitCode: null,
      stdoutSha256: null,
      stderrSha256: null,
      artifactPaths: [],
    };

    if (this.#killSwitch.isActive) {
      this.#finalizeMetadata(metadata, startedAt);
      this.#audit(actor.actorId, 'TOOL_EXECUTION_CANCELLED', executionId, { reason: 'kill_switch' });
      return toolExecutionResultSchema.parse({
        executionId,
        status: 'CANCELLED',
        metadata,
        findings: [],
        errorMessage: 'Execution cancelled by kill switch.',
      });
    }

    this.#audit(actor.actorId, 'TOOL_EXECUTION_STARTED', executionId, {
      tool_type: normalizedRequest.toolType,
      intensity: normalizedRequest.intensity,
      target: normalizedRequest.target,
      tool_version: toolVersion.version,
    });

    const abortController = new AbortController();
    this.#activeExecutions.set(executionId, abortController);

    try {
      const command = this.#buildCommand(config, parameters, normalizedRequest.target);
      const timeoutSeconds = normalizedRequest.timeoutSeconds ?? config.timeoutSeconds;

      const result = await this.#executeWithTimeout(
        executionId,
        () => this.#runtime.execute(command, timeoutSeconds, abortController.signal),
        timeoutSeconds,
        abortController
      );

      this.#finalizeMetadata(metadata, startedAt, result.exitCode, result.stdout, result.stderr);

      const status: ToolExecutionStatus = result.exitCode === 0 ? 'SUCCESS' : 'FAILED';
      const action = status === 'SUCCESS' ? 'TOOL_EXECUTION_COMPLETED' : 'TOOL_EXECUTION_FAILED';

      this.#audit(actor.actorId, action, executionId, {
        status,
        exit_code: result.exitCode,
        duration_ms: metadata.durationMs,
      });

      const executionResult: ToolExecutionResult = {
        executionId,
        status,
        metadata,
        findings: this.#parseFindings(result.stdout.toString()),
        errorMessage: result.exitCode === 0 ? null : `${config.toolName} exited with code ${result.exitCode}.`,
      };

      return toolExecutionResultSchema.parse(executionResult);
    } catch (error) {
      this.#finalizeMetadata(metadata, startedAt);

      const cancellationRequest = this.#cancellationRequests.get(executionId);
      if (this.#isAbortError(error)) {
        const reason = cancellationRequest?.reason ?? 'user_request';
        if (reason === 'timeout') {
          this.#audit(actor.actorId, 'TOOL_EXECUTION_FAILED', executionId, {
            status: 'TIMEOUT',
            duration_ms: metadata.durationMs,
            reason,
          });
          return toolExecutionResultSchema.parse({
            executionId,
            status: 'TIMEOUT',
            metadata,
            findings: [],
            errorMessage: 'Tool execution timed out.',
          });
        }

        this.#audit(cancellationRequest?.actorId ?? actor.actorId, 'TOOL_EXECUTION_CANCELLED', executionId, {
          reason,
        });
        return toolExecutionResultSchema.parse({
          executionId,
          status: 'CANCELLED',
          metadata,
          findings: [],
          errorMessage: reason === 'kill_switch'
            ? 'Execution cancelled by kill switch.'
            : 'Execution cancelled by user request.',
        });
      }

      if (this.#isTimeoutError(error)) {
        this.#audit(actor.actorId, 'TOOL_EXECUTION_FAILED', executionId, {
          status: 'TIMEOUT',
          duration_ms: metadata.durationMs,
          reason: 'timeout',
        });
        return toolExecutionResultSchema.parse({
          executionId,
          status: 'TIMEOUT',
          metadata,
          findings: [],
          errorMessage: 'Tool execution timed out.',
        });
      }

      this.#audit(actor.actorId, 'TOOL_EXECUTION_FAILED', executionId, {
        status: 'FAILED',
        duration_ms: metadata.durationMs,
        reason: error instanceof DomainError ? error.errorCode : 'runtime_error',
      });

      return toolExecutionResultSchema.parse({
        executionId,
        status: 'FAILED',
        metadata,
        findings: [],
        errorMessage: error instanceof DomainError ? error.message : 'Tool execution failed unexpectedly.',
      });
    } finally {
      this.#activeExecutions.delete(executionId);
      this.#cancellationRequests.delete(executionId);
    }
  }

  cancelExecution(
    executionId: string,
    actor: ActorContext,
    reason: Exclude<CancellationReason, 'timeout'> = 'user_request'
  ): boolean {
    const controller = this.#activeExecutions.get(executionId);
    if (!controller) {
      return false;
    }

    this.#cancellationRequests.set(executionId, { reason, actorId: actor.actorId });
    controller.abort();
    return true;
  }

  #buildCommand(config: ToolConfig, parameters: ToolParameter[], target: string): string[] {
    const command = [...config.baseCommand];

    for (const param of parameters) {
      const allowedParam = config.allowedParameters.find((p) => p.name === param.name);
      if (!allowedParam) {
        continue;
      }

      if (allowedParam.valueType === 'boolean') {
        if (param.value === true) {
          command.push(allowedParam.flag);
        }
      } else if (Array.isArray(param.value)) {
        for (const item of param.value) {
          command.push(allowedParam.flag, String(item));
        }
      } else {
        command.push(allowedParam.flag, String(param.value));
      }
    }

    command.push(target);
    return command;
  }

  #computeHash(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  async #executeWithTimeout(
    executionId: string,
    execute: () => Promise<{ exitCode: number; stdout: Buffer; stderr: Buffer }>,
    timeoutSeconds: number,
    abortController: AbortController
  ): Promise<{ exitCode: number; stdout: Buffer; stderr: Buffer }> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.#cancellationRequests.set(executionId, { reason: 'timeout' });
        abortController.abort();

        const error = new Error('Tool execution timed out.');
        error.name = 'TimeoutError';
        reject(error);
      }, timeoutSeconds * 1000);

      execute()
        .then((result) => {
          clearTimeout(timeoutHandle);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  }

  #finalizeMetadata(
    metadata: ToolExecutionMetadata,
    startedAt: string,
    exitCode: number | null = null,
    stdout?: Buffer,
    stderr?: Buffer
  ): void {
    const completedAt = now();
    metadata.completedAt = completedAt;
    metadata.durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    metadata.exitCode = exitCode;
    metadata.stdoutSha256 = stdout ? this.#computeHash(stdout) : null;
    metadata.stderrSha256 = stderr ? this.#computeHash(stderr) : null;
  }

  #isAbortError(error: unknown): error is Error {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorWithCode = error as Error & { code?: string };
    return error.name === 'AbortError' || errorWithCode.code === 'ABORT_ERR';
  }

  #isTimeoutError(error: unknown): error is Error {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorWithCode = error as Error & { code?: string };
    return error.name === 'TimeoutError' || errorWithCode.code === 'ETIMEDOUT';
  }

  #parseFindings(stdout: string): Record<string, unknown>[] {
    try {
      const parsed = JSON.parse(stdout);
      if (Array.isArray(parsed)) {
        return parsed as Record<string, unknown>[];
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return [parsed];
      }
      return [];
    } catch {
      return [];
    }
  }

  #audit(actorId: string, action: Parameters<InMemoryAuditLog['append']>[0]['action'], resourceId: string, details: SafeDetails): void {
    this.#auditLog.append({
      actorId,
      action,
      resourceType: 'tool_execution',
      resourceId,
      details,
    });
  }
}
