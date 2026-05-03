import {
  AuthorizationDeniedError,
  SchemaValidationError,
  type SafeDetails,
} from '../../../shared/contracts/foundation.js';
import { InMemoryAuditLog } from '../../audit/persistence/in-memory-audit-log.js';
import { type ActorContext } from '../../auth/contracts/actor-context.contract.js';
import { AuthorizationService } from '../../auth/domain/authorization-service.js';
import {
  type DashboardMetrics,
  dashboardMetricsSchema,
  type DashboardQuery,
  dashboardQuerySchema,
} from '../contracts/dashboard-read.contract.js';
import {
  type AttackTrendRepository,
  type SecurityLogEventRepository,
} from '../../log-ingestion/contracts/log-repository.contract.js';
import {
  InMemoryAttackTrendRepository,
  InMemorySecurityLogEventRepository,
} from '../../log-ingestion/persistence/in-memory-log-ingestion-repositories.js';

const toValidationIssues = (issues: Array<{ path: (string | number)[]; message: string }>): string[] => {
  return issues.map((issue) => issue.path.join('.') || issue.message);
};

export class DashboardQueryService {
  readonly #eventRepository: SecurityLogEventRepository;
  readonly #trendRepository: AttackTrendRepository;
  readonly #authorization: AuthorizationService;
  readonly #auditLog: InMemoryAuditLog;

  constructor(deps?: {
    eventRepository?: SecurityLogEventRepository;
    trendRepository?: AttackTrendRepository;
    authorization?: AuthorizationService;
    auditLog?: InMemoryAuditLog;
  }) {
    this.#eventRepository = deps?.eventRepository ?? new InMemorySecurityLogEventRepository();
    this.#trendRepository = deps?.trendRepository ?? new InMemoryAttackTrendRepository();
    this.#authorization = deps?.authorization ?? new AuthorizationService();
    this.#auditLog = deps?.auditLog ?? new InMemoryAuditLog();
  }

  get auditLog(): InMemoryAuditLog {
    return this.#auditLog;
  }

  readMetrics(query: unknown, actor: ActorContext): DashboardMetrics {
    const parsedQuery = dashboardQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      throw new SchemaValidationError({
        issues: toValidationIssues(parsedQuery.error.issues),
      });
    }

    const normalizedQuery = parsedQuery.data;
    this.#assertAssetGroupAccess(actor, normalizedQuery.assetGroupId);

    const recentEvents = this.#eventRepository.list({
      assetGroupId: normalizedQuery.assetGroupId,
      logType: normalizedQuery.logType,
      since: normalizedQuery.since,
      until: normalizedQuery.until,
      limit: normalizedQuery.eventLimit,
    });
    const trends = this.#trendRepository.list({
      assetGroupId: normalizedQuery.assetGroupId,
      logType: normalizedQuery.logType,
      since: normalizedQuery.since,
      until: normalizedQuery.until,
      limit: normalizedQuery.trendLimit,
    });

    const topAttackTypes = Array.from(
      recentEvents.reduce((accumulator, event) => {
        const attackType = event.classification?.attackType ?? 'UNCLASSIFIED';
        accumulator.set(attackType, (accumulator.get(attackType) ?? 0) + 1);
        return accumulator;
      }, new Map<string, number>()),
    )
      .map(([attackType, eventCount]) => ({ attackType, eventCount }))
      .sort((left, right) => right.eventCount - left.eventCount)
      .slice(0, 5);

    const metrics = dashboardMetricsSchema.parse({
      totalEvents: recentEvents.length,
      blockedEvents: recentEvents.filter((event) => event.action && /(block|deny)/i.test(event.action)).length,
      unresolvedTargets: recentEvents.filter((event) => !event.targetAuthorized).length,
      topAttackTypes,
      trends,
      recentEvents,
    });

    this.#audit(actor.actorId, 'LOG_DASHBOARD_VIEWED', normalizedQuery.assetGroupId, {
      asset_group_id: normalizedQuery.assetGroupId,
      event_count: metrics.totalEvents,
      trend_count: metrics.trends.length,
    });

    return metrics;
  }

  #assertAssetGroupAccess(actor: ActorContext, assetGroupId: string): void {
    if (this.#authorization.canAccessAssetGroup(actor, assetGroupId)) {
      return;
    }

    throw new AuthorizationDeniedError({
      actor_id: actor.actorId,
      asset_group_id: assetGroupId,
    }, 'You do not have access to the requested dashboard data.');
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
      resourceType: 'dashboard',
      resourceId,
      details,
    });
  }
}
