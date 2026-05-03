import { randomUUID } from 'node:crypto';

import {
  AssetScopeBlockedError,
  KillSwitchCancelledError,
  SchemaValidationError,
  TaskExecutionFailedError,
  type SafeDetails,
} from '../../../shared/contracts/foundation.js';
import { InMemoryAuditLog } from '../../audit/persistence/in-memory-audit-log.js';
import { type ActorContext } from '../../auth/contracts/actor-context.contract.js';
import { type ToolExecutionResult, type ToolVersion } from '../../tool-runner/contracts/tool-execution.contract.js';
import { ToolRunnerService } from '../../tool-runner/domain/tool-runner.service.js';
import {
  type AssetTarget,
  type AssetWhitelistEntry,
} from '../contracts/asset-authorization.contract.js';
import {
  type DiscoveredServiceRecord,
  serviceDiscoveryRequestSchema,
  serviceDiscoveryResultSchema,
  type ServiceDiscoveryRequest,
  type ServiceDiscoveryResult,
} from '../contracts/service-discovery.contract.js';
import { AssetScopeService } from './asset-scope-service.js';

const now = (): string => new Date().toISOString();

const toValidationIssues = (issues: Array<{ path: (string | number)[]; message: string }>): string[] => {
  return issues.map((issue) => issue.path.join('.') || issue.message);
};

type DiscoveryError = {
  target: string;
  error: string;
};

export class ServiceDiscoveryService {
  readonly #toolRunner: ToolRunnerService;
  readonly #assetScope: AssetScopeService;
  readonly #auditLog: InMemoryAuditLog;

  constructor(deps?: {
    toolRunner?: ToolRunnerService;
    assetScope?: AssetScopeService;
    auditLog?: InMemoryAuditLog;
  }) {
    this.#toolRunner = deps?.toolRunner ?? new ToolRunnerService();
    this.#assetScope = deps?.assetScope ?? new AssetScopeService();
    this.#auditLog = deps?.auditLog ?? new InMemoryAuditLog();
  }

  get auditLog(): InMemoryAuditLog {
    return this.#auditLog;
  }

  async discover(
    request: ServiceDiscoveryRequest,
    actor: ActorContext,
    whitelistEntries: AssetWhitelistEntry[],
    toolVersion: ToolVersion,
  ): Promise<ServiceDiscoveryResult> {
    const parsedRequest = serviceDiscoveryRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      throw new SchemaValidationError({
        issues: toValidationIssues(parsedRequest.error.issues),
      });
    }

    const normalizedRequest = parsedRequest.data;
    const scanId = `svcdisc_${randomUUID().replaceAll('-', '')}`;
    const startedAt = now();

    this.#audit(actor.actorId, 'SERVICE_DISCOVERY_STARTED', scanId, {
      task_id: normalizedRequest.taskId,
      asset_group_id: normalizedRequest.assetGroupId,
      target_count: normalizedRequest.targets.length,
      intensity: normalizedRequest.intensity,
    });

    const services: DiscoveredServiceRecord[] = [];
    const errors: DiscoveryError[] = [];
    let targetsScanned = 0;

    try {
      for (const target of normalizedRequest.targets) {
        try {
          this.#assetScope.assertTargetAuthorized(normalizedRequest.assetGroupId, target, whitelistEntries);

          const additionalParameters: Record<string, unknown> = {};
          if (normalizedRequest.portRange) {
            additionalParameters.port_range = normalizedRequest.portRange;
          }

          const toolResult = await this.#toolRunner.execute(
            {
              toolType: 'SERVICE_DETECTION',
              intensity: normalizedRequest.intensity,
              target: target.value,
              additionalParameters,
            },
            actor,
            toolVersion,
          );

          this.#assertToolExecutionSucceeded(toolResult, target.value);

          const targetServices = this.#convertServiceFindings(toolResult, target);
          services.push(...targetServices);
          targetsScanned++;

          this.#audit(actor.actorId, 'SERVICE_DISCOVERY_TARGET_SCANNED', scanId, {
            target: target.value,
            service_count: targetServices.length,
          });
        } catch (error) {
          if (error instanceof KillSwitchCancelledError || error instanceof AssetScopeBlockedError) {
            throw error;
          }

          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({ target: target.value, error: errorMessage });

          this.#audit(actor.actorId, 'SERVICE_DISCOVERY_TARGET_FAILED', scanId, {
            target: target.value,
            error: errorMessage,
          });
        }
      }

      const completedAt = now();
      const status = this.#computeStatus(targetsScanned, normalizedRequest.targets.length, errors.length);

      this.#audit(actor.actorId, 'SERVICE_DISCOVERY_COMPLETED', scanId, {
        status,
        targets_scanned: targetsScanned,
        service_count: services.length,
        error_count: errors.length,
      });

      return serviceDiscoveryResultSchema.parse({
        scanId,
        taskId: normalizedRequest.taskId,
        assetGroupId: normalizedRequest.assetGroupId,
        status,
        startedAt,
        completedAt,
        targetsScanned,
        services,
        errors,
      });
    } catch (error) {
      if (error instanceof KillSwitchCancelledError) {
        const cancellationReason = typeof error.details.reason === 'string'
          ? error.details.reason
          : 'execution_cancelled';

        this.#audit(actor.actorId, 'SERVICE_DISCOVERY_CANCELLED', scanId, {
          reason: cancellationReason,
        });

        return serviceDiscoveryResultSchema.parse({
          scanId,
          taskId: normalizedRequest.taskId,
          assetGroupId: normalizedRequest.assetGroupId,
          status: 'CANCELLED',
          startedAt,
          completedAt: now(),
          targetsScanned,
          services,
          errors,
        });
      }

      this.#audit(actor.actorId, 'SERVICE_DISCOVERY_FAILED', scanId, {
        reason: error instanceof Error ? error.name : 'unknown_error',
      });

      if (error instanceof AssetScopeBlockedError) {
        throw error;
      }

      throw new TaskExecutionFailedError(
        {
          scan_id: scanId,
          reason: error instanceof Error ? error.name : 'unknown_error',
        },
        'Service discovery failed unexpectedly.',
      );
    }
  }

  #assertToolExecutionSucceeded(toolResult: ToolExecutionResult, target: string): void {
    if (toolResult.status === 'SUCCESS') {
      return;
    }

    if (toolResult.status === 'CANCELLED') {
      const cancellationReason = toolResult.errorMessage?.includes('kill switch')
        ? 'kill_switch'
        : 'tool_execution_cancelled';

      throw new KillSwitchCancelledError(
        {
          execution_id: toolResult.executionId,
          target_ref: target,
          reason: cancellationReason,
        },
        'Tool execution was cancelled.',
      );
    }

    if (toolResult.status === 'TIMEOUT') {
      throw new TaskExecutionFailedError(
        {
          execution_id: toolResult.executionId,
          target_ref: target,
          reason: 'tool_execution_timeout',
        },
        'Service discovery timed out for target.',
      );
    }

    throw new TaskExecutionFailedError(
      {
        execution_id: toolResult.executionId,
        target_ref: target,
        reason: 'tool_execution_failed',
      },
      'Service discovery failed for target.',
    );
  }

  #convertServiceFindings(
    toolResult: ToolExecutionResult,
    target: AssetTarget,
  ): DiscoveredServiceRecord[] {
    const services: DiscoveredServiceRecord[] = [];

    for (const rawFinding of toolResult.findings) {
      const port = this.#readNumber(rawFinding.port);
      const protocol = this.#readString(rawFinding.protocol) ?? 'tcp';
      const state = this.#readString(rawFinding.state) ?? 'open';

      if (!port) {
        continue;
      }

      services.push({
        serviceId: `service_${randomUUID().replaceAll('-', '')}`,
        target,
        port,
        protocol,
        state,
        service: this.#readString(rawFinding.service),
        version: this.#readString(rawFinding.version),
        fingerprint: this.#readString(rawFinding.fingerprint) ?? this.#readString(rawFinding.product),
        discoveredAt: now(),
      });
    }

    return services;
  }

  #computeStatus(
    targetsScanned: number,
    totalTargets: number,
    errorCount: number,
  ): 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' {
    if (targetsScanned === 0) {
      return 'FAILED';
    }

    if (errorCount > 0 || targetsScanned < totalTargets) {
      return 'PARTIAL_SUCCESS';
    }

    return 'SUCCESS';
  }

  #readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  #readNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
  }

  #audit(
    actorId: string,
    action: Parameters<InMemoryAuditLog['append']>[0]['action'],
    resourceId: string,
    details: SafeDetails,
  ): void {
    this.#auditLog.append({
      actorId,
      action,
      resourceType: 'service_discovery',
      resourceId,
      details,
    });
  }
}
