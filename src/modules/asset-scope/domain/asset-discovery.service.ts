import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

import {
  AssetScopeBlockedError,
  KillSwitchCancelledError,
  SchemaValidationError,
  TaskExecutionFailedError,
  type SafeDetails,
} from '../../../shared/contracts/foundation.js';
import { InMemoryAuditLog } from '../../audit/persistence/in-memory-audit-log.js';
import { type ActorContext } from '../../auth/contracts/actor-context.contract.js';
import {
  type ToolExecutionResult,
  type ToolVersion,
} from '../../tool-runner/contracts/tool-execution.contract.js';
import { ToolRunnerService } from '../../tool-runner/domain/tool-runner.service.js';
import {
  type AssetTarget,
  type AssetWhitelistEntry,
} from '../contracts/asset-authorization.contract.js';
import {
  assetDiscoveryRequestSchema,
  assetDiscoveryResultSchema,
  type AssetDiscoveryRequest,
  type AssetDiscoveryResult,
  type DiscoveredAssetRecord,
  type HttpProbeSummary,
} from '../contracts/asset-discovery.contract.js';
import { AssetScopeService } from './asset-scope-service.js';

const now = (): string => new Date().toISOString();

const toValidationIssues = (issues: Array<{ path: (string | number)[]; message: string }>): string[] => {
  return issues.map((issue) => issue.path.join('.') || issue.message);
};

type AssetDiscoveryToolVersions = {
  enumeration: ToolVersion;
  probe: ToolVersion;
};

type DiscoveryError = {
  target: string;
  error: string;
};

export class AssetDiscoveryService {
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
    request: AssetDiscoveryRequest,
    actor: ActorContext,
    whitelistEntries: AssetWhitelistEntry[],
    toolVersions: AssetDiscoveryToolVersions,
  ): Promise<AssetDiscoveryResult> {
    const parsedRequest = assetDiscoveryRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      throw new SchemaValidationError({
        issues: toValidationIssues(parsedRequest.error.issues),
      });
    }

    const normalizedRequest = parsedRequest.data;
    const discoveryId = `assetdisc_${randomUUID().replaceAll('-', '')}`;
    const startedAt = now();

    this.#audit(actor.actorId, 'ASSET_DISCOVERY_STARTED', discoveryId, {
      task_id: normalizedRequest.taskId,
      asset_group_id: normalizedRequest.assetGroupId,
      target_count: normalizedRequest.targets.length,
      intensity: normalizedRequest.intensity,
    });

    const discoveries: DiscoveredAssetRecord[] = [];
    const errors: DiscoveryError[] = [];
    let targetsScanned = 0;

    try {
      for (const target of normalizedRequest.targets) {
        const targetErrorCountBefore = errors.length;

        try {
          this.#assetScope.assertTargetAuthorized(
            normalizedRequest.assetGroupId,
            { kind: 'domain', value: target },
            whitelistEntries,
          );

          const enumerationResult = await this.#toolRunner.execute(
            {
              toolType: 'SUBDOMAIN_ENUMERATION',
              intensity: normalizedRequest.intensity,
              target,
              additionalParameters: {},
            },
            actor,
            toolVersions.enumeration,
          );

          this.#assertToolExecutionSucceeded(enumerationResult, target, 'Subdomain enumeration failed for target.');

          const targetDiscoveries = this.#convertEnumerationFindings(
            enumerationResult,
            normalizedRequest.assetGroupId,
            target,
            whitelistEntries,
          );

          for (const discovery of targetDiscoveries) {
            if (discovery.status !== 'DISCOVERED_PENDING_CONFIRMATION') {
              continue;
            }

            try {
              const probeResult = await this.#toolRunner.execute(
                {
                  toolType: 'HTTP_PROBE',
                  intensity: normalizedRequest.intensity,
                  target: discovery.target.value,
                  additionalParameters: {},
                },
                actor,
                toolVersions.probe,
              );

              this.#assertToolExecutionSucceeded(probeResult, discovery.target.value, 'HTTP probe failed for discovered asset.');
              discovery.probe = this.#convertProbeSummary(probeResult, discovery.target);
            } catch (error) {
              if (error instanceof KillSwitchCancelledError) {
                throw error;
              }

              errors.push({
                target: discovery.target.value,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          discoveries.push(...targetDiscoveries);
          targetsScanned++;

          this.#audit(actor.actorId, 'ASSET_DISCOVERY_TARGET_SCANNED', discoveryId, {
            target,
            discovery_count: targetDiscoveries.length,
            error_count: errors.length - targetErrorCountBefore,
          });
        } catch (error) {
          if (error instanceof KillSwitchCancelledError || error instanceof AssetScopeBlockedError) {
            throw error;
          }

          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({ target, error: errorMessage });

          this.#audit(actor.actorId, 'ASSET_DISCOVERY_TARGET_FAILED', discoveryId, {
            target,
            error: errorMessage,
          });
        }
      }

      const completedAt = now();
      const status = this.#computeStatus(targetsScanned, normalizedRequest.targets.length, errors.length);

      this.#audit(actor.actorId, 'ASSET_DISCOVERY_COMPLETED', discoveryId, {
        status,
        targets_scanned: targetsScanned,
        discovery_count: discoveries.length,
        error_count: errors.length,
      });

      return assetDiscoveryResultSchema.parse({
        discoveryId,
        taskId: normalizedRequest.taskId,
        assetGroupId: normalizedRequest.assetGroupId,
        status,
        startedAt,
        completedAt,
        targetsScanned,
        discoveries,
        errors,
      });
    } catch (error) {
      if (error instanceof KillSwitchCancelledError) {
        const cancellationReason = typeof error.details.reason === 'string'
          ? error.details.reason
          : 'execution_cancelled';

        this.#audit(actor.actorId, 'ASSET_DISCOVERY_CANCELLED', discoveryId, {
          reason: cancellationReason,
        });

        return assetDiscoveryResultSchema.parse({
          discoveryId,
          taskId: normalizedRequest.taskId,
          assetGroupId: normalizedRequest.assetGroupId,
          status: 'CANCELLED',
          startedAt,
          completedAt: now(),
          targetsScanned,
          discoveries,
          errors,
        });
      }

      this.#audit(actor.actorId, 'ASSET_DISCOVERY_FAILED', discoveryId, {
        reason: error instanceof Error ? error.name : 'unknown_error',
      });

      if (error instanceof AssetScopeBlockedError) {
        throw error;
      }

      throw new TaskExecutionFailedError(
        {
          discovery_id: discoveryId,
          reason: error instanceof Error ? error.name : 'unknown_error',
        },
        'Asset discovery failed unexpectedly.',
      );
    }
  }

  #assertToolExecutionSucceeded(toolResult: ToolExecutionResult, target: string, message: string): void {
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
        message,
      );
    }

    throw new TaskExecutionFailedError(
      {
        execution_id: toolResult.executionId,
        target_ref: target,
        reason: 'tool_execution_failed',
      },
      message,
    );
  }

  #convertEnumerationFindings(
    toolResult: ToolExecutionResult,
    assetGroupId: string,
    sourceTarget: string,
    whitelistEntries: AssetWhitelistEntry[],
  ): DiscoveredAssetRecord[] {
    const discoveries = new Map<string, DiscoveredAssetRecord>();

    for (const rawFinding of toolResult.findings) {
      const target = this.#extractDiscoveredTarget(rawFinding);
      if (!target) {
        continue;
      }

      const key = `${target.kind}:${target.value}`;
      if (discoveries.has(key)) {
        continue;
      }

      discoveries.set(key, {
        discoveredAssetId: `asset_${randomUUID().replaceAll('-', '')}`,
        assetGroupId,
        sourceTarget,
        target,
        status: this.#assetScope.isTargetAuthorized(assetGroupId, target, whitelistEntries)
          ? 'DISCOVERED_PENDING_CONFIRMATION'
          : 'OUT_OF_SCOPE_DISCOVERED',
        probe: null,
        discoveredAt: now(),
      });
    }

    return Array.from(discoveries.values());
  }

  #extractDiscoveredTarget(rawFinding: Record<string, unknown>): AssetTarget | null {
    const candidate = this.#readString(rawFinding.subdomain)
      ?? this.#readString(rawFinding.domain)
      ?? this.#readString(rawFinding.host)
      ?? this.#readString(rawFinding.input)
      ?? this.#readString(rawFinding.ip);

    if (!candidate) {
      return null;
    }

    const value = candidate.trim().toLowerCase().replace(/\.$/, '');
    if (!value) {
      return null;
    }

    if (isIP(value)) {
      return {
        kind: 'ip',
        value,
      };
    }

    return {
      kind: 'domain',
      value,
    };
  }

  #convertProbeSummary(toolResult: ToolExecutionResult, target: AssetTarget): HttpProbeSummary | null {
    for (const rawFinding of toolResult.findings) {
      const host = this.#readString(rawFinding.host)
        ?? this.#readString(rawFinding.input)
        ?? this.#readString(rawFinding.domain);

      if (host && host.trim().toLowerCase().replace(/\.$/, '') !== target.value) {
        continue;
      }

      return {
        url: this.#readString(rawFinding.url),
        statusCode: this.#readNumber(rawFinding.status_code) ?? this.#readNumber(rawFinding.statusCode),
        title: this.#readString(rawFinding.title),
        technologies: this.#readStringArray(rawFinding.technologies) ?? this.#readStringArray(rawFinding.tech) ?? [],
      };
    }

    return null;
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

  #readStringArray(value: unknown): string[] | null {
    return Array.isArray(value) && value.every((item) => typeof item === 'string')
      ? value
      : null;
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
      resourceType: 'asset_discovery',
      resourceId,
      details,
    });
  }
}
