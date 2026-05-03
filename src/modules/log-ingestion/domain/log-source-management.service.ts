import {
  AuthorizationDeniedError,
  SchemaValidationError,
  type SafeDetails,
} from '../../../shared/contracts/foundation.js';
import { InMemoryAuditLog } from '../../audit/persistence/in-memory-audit-log.js';
import { type ActorContext } from '../../auth/contracts/actor-context.contract.js';
import { AuthorizationService } from '../../auth/domain/authorization-service.js';
import {
  type LogSourceConfig,
  logSourceConfigSchema,
} from '../contracts/log-ingestion.contract.js';
import { type LogSourceRepository } from '../contracts/log-repository.contract.js';
import { InMemoryLogSourceRepository } from '../persistence/in-memory-log-ingestion-repositories.js';

const toValidationIssues = (issues: Array<{ path: (string | number)[]; message: string }>): string[] => {
  return issues.map((issue) => issue.path.join('.') || issue.message);
};

export class LogSourceManagementService {
  readonly #repository: LogSourceRepository;
  readonly #authorization: AuthorizationService;
  readonly #auditLog: InMemoryAuditLog;

  constructor(deps?: {
    repository?: LogSourceRepository;
    authorization?: AuthorizationService;
    auditLog?: InMemoryAuditLog;
  }) {
    this.#repository = deps?.repository ?? new InMemoryLogSourceRepository();
    this.#authorization = deps?.authorization ?? new AuthorizationService();
    this.#auditLog = deps?.auditLog ?? new InMemoryAuditLog();
  }

  get repository(): LogSourceRepository {
    return this.#repository;
  }

  get auditLog(): InMemoryAuditLog {
    return this.#auditLog;
  }

  upsertSource(source: unknown, actor: ActorContext): LogSourceConfig {
    this.#authorization.requirePermission(actor, 'log_source:manage');

    const parsedSource = logSourceConfigSchema.safeParse(source);
    if (!parsedSource.success) {
      throw new SchemaValidationError({
        issues: toValidationIssues(parsedSource.error.issues),
      });
    }

    const normalizedSource = parsedSource.data;
    this.#assertAssetGroupAccess(actor, normalizedSource.assetGroupId);

    const existing = this.#repository.get(normalizedSource.sourceId);
    const saved = this.#repository.save(normalizedSource);

    this.#audit(actor.actorId, existing ? 'LOG_SOURCE_UPDATED' : 'LOG_SOURCE_CREATED', saved.sourceId, {
      asset_group_id: saved.assetGroupId,
      log_type: saved.logType,
      parser_format: saved.parserFormat,
      enabled: saved.enabled,
    });

    return saved;
  }

  disableSource(sourceId: string, actor: ActorContext): LogSourceConfig {
    this.#authorization.requirePermission(actor, 'log_source:manage');

    const existing = this.#repository.get(sourceId);
    if (!existing) {
      throw new SchemaValidationError({
        source_id: sourceId,
      }, 'Log source was not found.');
    }

    this.#assertAssetGroupAccess(actor, existing.assetGroupId);

    const disabled = this.#repository.save({
      ...existing,
      enabled: false,
    });

    this.#audit(actor.actorId, 'LOG_SOURCE_DISABLED', disabled.sourceId, {
      asset_group_id: disabled.assetGroupId,
      log_type: disabled.logType,
      parser_format: disabled.parserFormat,
      enabled: disabled.enabled,
    });

    return disabled;
  }

  listSources(assetGroupId: string, actor: ActorContext): LogSourceConfig[] {
    this.#authorization.requirePermission(actor, 'log_source:manage');
    this.#assertAssetGroupAccess(actor, assetGroupId);
    return this.#repository.listByAssetGroup(assetGroupId);
  }

  #assertAssetGroupAccess(actor: ActorContext, assetGroupId: string): void {
    if (this.#authorization.canAccessAssetGroup(actor, assetGroupId)) {
      return;
    }

    throw new AuthorizationDeniedError({
      actor_id: actor.actorId,
      asset_group_id: assetGroupId,
    }, 'You do not have access to the requested asset group.');
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
      resourceType: 'log_source',
      resourceId,
      details,
    });
  }
}
