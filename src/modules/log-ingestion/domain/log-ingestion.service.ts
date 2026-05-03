import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

import {
  createId,
  LogIngestRejectedError,
  SchemaValidationError,
  type SafeDetails,
} from '../../../shared/contracts/foundation.js';
import { InMemoryAuditLog } from '../../audit/persistence/in-memory-audit-log.js';
import { type ActorContext } from '../../auth/contracts/actor-context.contract.js';
import {
  type AssetTarget,
  type AssetWhitelistEntry,
} from '../../asset-scope/contracts/asset-authorization.contract.js';
import { AssetScopeService } from '../../asset-scope/domain/asset-scope-service.js';
import {
  type LogIngestRequest,
  logIngestRequestSchema,
  type LogIngestResult,
  logIngestResultSchema,
  type LogSourceConfig,
  type NormalizedSecurityLogEvent,
} from '../contracts/log-ingestion.contract.js';
import {
  type AttackTrendRepository,
  type LogIngestRecordRepository,
  type LogSourceRepository,
  type SecurityLogEventRepository,
} from '../contracts/log-repository.contract.js';
import { AttackTrendAggregator } from './attack-trend-aggregator.js';
import { type ParsedSecurityLogEntry, SecurityLogParser } from './security-log-parser.js';
import { SecurityLogRedactor } from './security-log-redactor.js';
import {
  InMemoryAttackTrendRepository,
  InMemoryLogIngestRecordRepository,
  InMemoryLogSourceRepository,
  InMemorySecurityLogEventRepository,
} from '../persistence/in-memory-log-ingestion-repositories.js';

const MAX_LOG_PAYLOAD_BYTES = 16 * 1024;

const now = (): string => new Date().toISOString();

const toValidationIssues = (issues: Array<{ path: (string | number)[]; message: string }>): string[] => {
  return issues.map((issue) => issue.path.join('.') || issue.message);
};

const truncatePayload = (payload: string): { content: string; truncated: boolean } => {
  const size = Buffer.byteLength(payload, 'utf8');
  if (size <= MAX_LOG_PAYLOAD_BYTES) {
    return {
      content: payload,
      truncated: false,
    };
  }

  let end = payload.length;
  while (end > 0 && Buffer.byteLength(payload.slice(0, end), 'utf8') > MAX_LOG_PAYLOAD_BYTES) {
    end -= 1;
  }

  return {
    content: payload.slice(0, end),
    truncated: true,
  };
};

const normalizeSourceIp = (value: string): string => value.trim();

const isAllowedSourceIp = (sourceIp: string, config: LogSourceConfig): boolean => {
  const allowed = config.receiver?.allowedSourceIps ?? [];
  if (allowed.length === 0) {
    return true;
  }

  return allowed.includes(sourceIp);
};

const checksumPayload = (payload: string): string => {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
};

export class LogIngestionService {
  readonly #sourceRepository: LogSourceRepository;
  readonly #ingestRecordRepository: LogIngestRecordRepository;
  readonly #eventRepository: SecurityLogEventRepository;
  readonly #trendRepository: AttackTrendRepository;
  readonly #assetScope: AssetScopeService;
  readonly #parser: SecurityLogParser;
  readonly #redactor: SecurityLogRedactor;
  readonly #aggregator: AttackTrendAggregator;
  readonly #auditLog: InMemoryAuditLog;

  constructor(deps?: {
    sourceRepository?: LogSourceRepository;
    ingestRecordRepository?: LogIngestRecordRepository;
    eventRepository?: SecurityLogEventRepository;
    trendRepository?: AttackTrendRepository;
    assetScope?: AssetScopeService;
    parser?: SecurityLogParser;
    redactor?: SecurityLogRedactor;
    aggregator?: AttackTrendAggregator;
    auditLog?: InMemoryAuditLog;
  }) {
    this.#sourceRepository = deps?.sourceRepository ?? new InMemoryLogSourceRepository();
    this.#ingestRecordRepository = deps?.ingestRecordRepository ?? new InMemoryLogIngestRecordRepository();
    this.#eventRepository = deps?.eventRepository ?? new InMemorySecurityLogEventRepository();
    this.#trendRepository = deps?.trendRepository ?? new InMemoryAttackTrendRepository();
    this.#assetScope = deps?.assetScope ?? new AssetScopeService();
    this.#parser = deps?.parser ?? new SecurityLogParser();
    this.#redactor = deps?.redactor ?? new SecurityLogRedactor();
    this.#aggregator = deps?.aggregator ?? new AttackTrendAggregator();
    this.#auditLog = deps?.auditLog ?? new InMemoryAuditLog();
  }

  get auditLog(): InMemoryAuditLog {
    return this.#auditLog;
  }

  ingest(request: unknown, actor: ActorContext, whitelistEntries: AssetWhitelistEntry[]): LogIngestResult {
    const parsedRequest = logIngestRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      throw new SchemaValidationError({
        issues: toValidationIssues(parsedRequest.error.issues),
      });
    }

    const normalizedRequest = parsedRequest.data;
    const source = this.#sourceRepository.get(normalizedRequest.sourceId);
    if (!source || !source.enabled) {
      this.#audit(actor.actorId, 'LOG_INGEST_REJECTED', normalizedRequest.sourceId, {
        source_id: normalizedRequest.sourceId,
        reason: 'unknown_or_disabled_source',
      });
      throw new LogIngestRejectedError({
        source_id: normalizedRequest.sourceId,
        reason: 'unknown_or_disabled_source',
      }, 'Log source is unknown or disabled.');
    }

    const sourceIp = normalizeSourceIp(normalizedRequest.sourceIp);
    if (!isAllowedSourceIp(sourceIp, source)) {
      this.#audit(actor.actorId, 'LOG_INGEST_REJECTED', source.sourceId, {
        source_id: source.sourceId,
        reason: 'source_ip_not_allowed',
        source_ip: sourceIp,
      });
      throw new LogIngestRejectedError({
        source_id: source.sourceId,
        reason: 'source_ip_not_allowed',
        source_ip: sourceIp,
      }, 'Log source IP is not allowed.');
    }

    const receivedAt = normalizedRequest.receivedAt ?? now();
    const truncatedPayload = truncatePayload(normalizedRequest.payload);
    const ingestRef = createId('ingest');

    let parsedEntry: ParsedSecurityLogEntry | null = null;
    try {
      parsedEntry = this.#parser.parse(truncatedPayload.content, source);
    } catch {
      const ingestRecord = this.#ingestRecordRepository.save({
        ingestRef,
        sourceId: source.sourceId,
        receivedAt,
        originalEventTime: null,
        sizeBytes: Buffer.byteLength(normalizedRequest.payload, 'utf8'),
        checksum: checksumPayload(truncatedPayload.content),
        truncated: truncatedPayload.truncated,
        parseStatus: 'FAILED',
        redactionStatus: 'NOT_REQUIRED',
        rawBodyDiscarded: true,
      });

      this.#audit(actor.actorId, 'LOG_INGEST_PARSE_FAILED', ingestRef, {
        source_id: source.sourceId,
        ingest_ref: ingestRef,
        parse_status: 'FAILED',
        redaction_status: 'NOT_REQUIRED',
        truncated: truncatedPayload.truncated,
      });

      return logIngestResultSchema.parse({
        ingestRecord,
        events: [],
        aggregatedBuckets: [],
      });
    }

    const redacted = this.#redactor.redact(parsedEntry);
    const event = this.#buildEvent({
      ingestRef,
      source,
      receivedAt,
      parsedEntry,
      whitelistEntries,
      redacted,
    });

    const ingestRecord = this.#ingestRecordRepository.save({
      ingestRef,
      sourceId: source.sourceId,
      receivedAt,
      originalEventTime: parsedEntry.originalEventTime,
      sizeBytes: Buffer.byteLength(normalizedRequest.payload, 'utf8'),
      checksum: checksumPayload(truncatedPayload.content),
      truncated: truncatedPayload.truncated,
      parseStatus: 'PARSED',
      redactionStatus: redacted.redactedFields.length > 0 ? 'REDACTED' : 'NOT_REQUIRED',
      rawBodyDiscarded: true,
    });

    const events = this.#eventRepository.saveMany([event]);
    const aggregatedBuckets = this.#trendRepository.upsertMany(this.#aggregator.aggregate(events));

    this.#audit(actor.actorId, 'LOG_INGEST_PARSED', ingestRef, {
      source_id: source.sourceId,
      ingest_ref: ingestRef,
      parse_status: ingestRecord.parseStatus,
      redaction_status: ingestRecord.redactionStatus,
      truncated: ingestRecord.truncated,
    });
    this.#audit(actor.actorId, 'LOG_INGEST_AGGREGATED', ingestRef, {
      source_id: source.sourceId,
      ingest_ref: ingestRef,
      bucket_count: aggregatedBuckets.length,
      event_count: events.length,
    });

    return logIngestResultSchema.parse({
      ingestRecord,
      events,
      aggregatedBuckets,
    });
  }

  #buildEvent(params: {
    ingestRef: string;
    source: LogSourceConfig;
    receivedAt: string;
    parsedEntry: ParsedSecurityLogEntry;
    whitelistEntries: AssetWhitelistEntry[];
    redacted: ReturnType<SecurityLogRedactor['redact']>;
  }): NormalizedSecurityLogEvent {
    const eventTime = params.parsedEntry.originalEventTime ?? params.receivedAt;
    const target = this.#resolveTarget(params.parsedEntry);
    const targetAuthorized = target
      ? this.#assetScope.isTargetAuthorized(params.source.assetGroupId, target, params.whitelistEntries)
      : false;

    return {
      eventId: createId('event'),
      ingestRef: params.ingestRef,
      sourceId: params.source.sourceId,
      assetGroupId: params.source.assetGroupId,
      logType: params.source.logType,
      eventTime,
      receivedAt: params.receivedAt,
      srcIp: params.parsedEntry.srcIp,
      srcPort: params.parsedEntry.srcPort,
      dstIp: params.parsedEntry.dstIp,
      dstDomain: params.parsedEntry.dstDomain,
      dstPort: params.parsedEntry.dstPort,
      protocol: params.parsedEntry.protocol,
      action: params.parsedEntry.action,
      ruleId: params.parsedEntry.ruleId,
      ruleName: params.parsedEntry.ruleName,
      severity: params.redacted.severity,
      targetAssetId: targetAuthorized && target ? `${target.kind}:${target.value}` : null,
      targetAuthorized,
      classification: params.redacted.classification,
      webFields: params.redacted.webFields,
      redactedFields: params.redacted.redactedFields,
    };
  }

  #resolveTarget(entry: ParsedSecurityLogEntry): AssetTarget | null {
    const candidate = entry.dstDomain ?? entry.dstIp;
    if (!candidate) {
      return null;
    }

    if (isIP(candidate)) {
      return {
        kind: 'ip',
        value: candidate,
      };
    }

    return {
      kind: 'domain',
      value: candidate.trim().toLowerCase(),
    };
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
      resourceType: 'log_ingest',
      resourceId,
      details,
    });
  }
}
