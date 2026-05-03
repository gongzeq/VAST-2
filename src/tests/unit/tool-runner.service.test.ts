import { describe, expect, it } from 'vitest';

import { type ActorContext } from '../../modules/auth/contracts/actor-context.contract.js';
import {
  type ToolConfig,
  type ToolVersion,
} from '../../modules/tool-runner/contracts/tool-execution.contract.js';
import {
  MockExecutionRuntime,
  ToolRunnerService,
  type ExecutionRuntime,
} from '../../modules/tool-runner/domain/tool-runner.service.js';
import { SchemaValidationError } from '../../shared/contracts/foundation.js';

const actor: ActorContext = {
  actorId: 'user_1',
  roleIds: ['security_engineer'],
  permissionPoints: ['task:create'],
  assetGroupIds: ['ag_prod'],
  yoloEnabled: false,
};

const toolVersion: ToolVersion = {
  toolName: 'nuclei',
  version: '3.3.0',
};

const vulnerabilityToolConfig: ToolConfig = {
  toolType: 'VULNERABILITY_SCAN',
  toolName: 'nuclei',
  baseCommand: ['nuclei'],
  allowedParameters: [
    {
      name: 'port_range',
      flag: '-ports',
      valueType: 'string',
      required: false,
    },
    {
      name: 'service_detection',
      flag: '-sv',
      valueType: 'boolean',
      required: false,
    },
  ],
  intensityMappings: {
    LOW: {
      service_detection: true,
    },
    MEDIUM: {
      port_range: 'top-1000',
      service_detection: true,
    },
    HIGH: {
      port_range: 'full',
      service_detection: true,
    },
  },
  timeoutSeconds: 300,
  maxConcurrency: 1,
};

const createSlowRuntime = (delayMs: number): ExecutionRuntime => ({
  async execute(_command: string[], _timeoutSeconds: number, signal?: AbortSignal) {
    return await new Promise((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        const error = new Error('Execution aborted.');
        error.name = 'AbortError';
        reject(error);
      };

      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve({
          exitCode: 0,
          stdout: Buffer.from('[]'),
          stderr: Buffer.from(''),
        });
      }, delayMs);

      signal?.addEventListener('abort', onAbort, { once: true });
    });
  },
});

describe('ToolRunnerService', () => {
  it('rejects unsupported additional parameters', async () => {
    const service = new ToolRunnerService();
    service.registerToolConfig(vulnerabilityToolConfig);

    await expect(
      service.execute(
        {
          toolType: 'VULNERABILITY_SCAN',
          intensity: 'LOW',
          target: 'app.example.com',
          additionalParameters: {
            unsupported_flag: true,
          },
        },
        actor,
        toolVersion,
      ),
    ).rejects.toBeInstanceOf(SchemaValidationError);
  });

  it('returns a safe failed result and failed audit record for non-zero exit codes', async () => {
    const runtime = new MockExecutionRuntime();
    runtime.setMockResponse('nuclei -ports top-1000 -sv api.example.com', {
      exitCode: 2,
      stdout: '[]',
      stderr: 'sensitive stderr that should not leak',
    });

    const service = new ToolRunnerService({ runtime });
    service.registerToolConfig(vulnerabilityToolConfig);

    const result = await service.execute(
      {
        toolType: 'VULNERABILITY_SCAN',
        intensity: 'MEDIUM',
        target: 'api.example.com',
        additionalParameters: {},
      },
      actor,
      toolVersion,
    );

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toBe('nuclei exited with code 2.');
    expect(service.auditLog.listByResource(result.executionId).map((record) => record.action)).toEqual([
      'TOOL_EXECUTION_STARTED',
      'TOOL_EXECUTION_FAILED',
    ]);
  });

  it('supports cancelling a running execution by id', async () => {
    const service = new ToolRunnerService({
      runtime: createSlowRuntime(2_000),
    });
    service.registerToolConfig(vulnerabilityToolConfig);

    const resultPromise = service.execute(
      {
        toolType: 'VULNERABILITY_SCAN',
        intensity: 'LOW',
        target: 'slow.example.com',
        additionalParameters: {},
      },
      actor,
      toolVersion,
    );

    await Promise.resolve();

    const [executionId] = service.listActiveExecutionIds();
    expect(executionId).toBeDefined();
    expect(service.cancelExecution(executionId as string, actor)).toBe(true);

    const result = await resultPromise;

    expect(result.status).toBe('CANCELLED');
    expect(result.errorMessage).toBe('Execution cancelled by user request.');
    expect(service.auditLog.listByResource(result.executionId).map((record) => record.action)).toEqual([
      'TOOL_EXECUTION_STARTED',
      'TOOL_EXECUTION_CANCELLED',
    ]);
  });

  it('returns TIMEOUT when execution exceeds timeoutSeconds', async () => {
    const service = new ToolRunnerService({
      runtime: createSlowRuntime(2_000),
    });
    service.registerToolConfig(vulnerabilityToolConfig);

    const result = await service.execute(
      {
        toolType: 'VULNERABILITY_SCAN',
        intensity: 'LOW',
        target: 'timeout.example.com',
        additionalParameters: {},
        timeoutSeconds: 1,
      },
      actor,
      toolVersion,
    );

    expect(result.status).toBe('TIMEOUT');
    expect(result.errorMessage).toBe('Tool execution timed out.');
    expect(service.auditLog.listByResource(result.executionId).map((record) => record.action)).toEqual([
      'TOOL_EXECUTION_STARTED',
      'TOOL_EXECUTION_FAILED',
    ]);
  });
});
