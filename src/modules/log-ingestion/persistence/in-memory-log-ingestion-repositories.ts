import {
  type AttackTrendBucket,
  attackTrendBucketSchema,
  type LogIngestRecord,
  logIngestRecordSchema,
  type LogSourceConfig,
  logSourceConfigSchema,
  type NormalizedSecurityLogEvent,
  normalizedSecurityLogEventSchema,
} from '../contracts/log-ingestion.contract.js';
import {
  type AttackTrendQuery,
  type AttackTrendRepository,
  type LogIngestRecordRepository,
  type LogSourceRepository,
  type SecurityLogEventQuery,
  type SecurityLogEventRepository,
} from '../contracts/log-repository.contract.js';

export class InMemoryLogSourceRepository implements LogSourceRepository {
  readonly #sources = new Map<string, LogSourceConfig>();

  save(source: LogSourceConfig): LogSourceConfig {
    const persisted = logSourceConfigSchema.parse(source);
    this.#sources.set(persisted.sourceId, structuredClone(persisted));
    return structuredClone(persisted);
  }

  get(sourceId: string): LogSourceConfig | undefined {
    const source = this.#sources.get(sourceId);
    return source ? structuredClone(source) : undefined;
  }

  listByAssetGroup(assetGroupId: string): LogSourceConfig[] {
    return Array.from(this.#sources.values())
      .filter((source) => source.assetGroupId === assetGroupId)
      .map((source) => structuredClone(source));
  }

  listAll(): LogSourceConfig[] {
    return Array.from(this.#sources.values()).map((source) => structuredClone(source));
  }
}

export class InMemoryLogIngestRecordRepository implements LogIngestRecordRepository {
  readonly #records: LogIngestRecord[] = [];

  save(record: LogIngestRecord): LogIngestRecord {
    const persisted = logIngestRecordSchema.parse(record);
    this.#records.push(structuredClone(persisted));
    return structuredClone(persisted);
  }

  listBySourceId(sourceId: string): LogIngestRecord[] {
    return this.#records
      .filter((record) => record.sourceId === sourceId)
      .map((record) => structuredClone(record));
  }

  listAll(): LogIngestRecord[] {
    return this.#records.map((record) => structuredClone(record));
  }
}

export class InMemorySecurityLogEventRepository implements SecurityLogEventRepository {
  readonly #events: NormalizedSecurityLogEvent[] = [];

  saveMany(events: NormalizedSecurityLogEvent[]): NormalizedSecurityLogEvent[] {
    const persisted = events.map((event) => normalizedSecurityLogEventSchema.parse(event));
    this.#events.push(...persisted.map((event) => structuredClone(event)));
    return persisted.map((event) => structuredClone(event));
  }

  list(query: SecurityLogEventQuery): NormalizedSecurityLogEvent[] {
    const matched = this.#events
      .filter((event) => event.assetGroupId === query.assetGroupId)
      .filter((event) => !query.logType || event.logType === query.logType)
      .filter((event) => !query.sourceId || event.sourceId === query.sourceId)
      .filter((event) => !query.since || event.eventTime >= query.since)
      .filter((event) => !query.until || event.eventTime <= query.until)
      .sort((left, right) => right.eventTime.localeCompare(left.eventTime));

    const limited = typeof query.limit === 'number' ? matched.slice(0, query.limit) : matched;
    return limited.map((event) => structuredClone(event));
  }
}

const buildTrendKey = (bucket: AttackTrendBucket): string => {
  return [
    bucket.assetGroupId,
    bucket.windowStart,
    bucket.windowEnd,
    bucket.logType,
    bucket.attackType,
    bucket.severity,
    bucket.srcIpOrCidr ?? '',
    bucket.targetAssetId ?? '',
    bucket.action ?? '',
  ].join('|');
};

export class InMemoryAttackTrendRepository implements AttackTrendRepository {
  readonly #buckets = new Map<string, AttackTrendBucket>();

  upsertMany(buckets: AttackTrendBucket[]): AttackTrendBucket[] {
    const merged: AttackTrendBucket[] = [];

    for (const bucket of buckets) {
      const parsed = attackTrendBucketSchema.parse(bucket);
      const key = buildTrendKey(parsed);
      const existing = this.#buckets.get(key);

      const nextBucket: AttackTrendBucket = existing
        ? {
            ...existing,
            eventCount: existing.eventCount + parsed.eventCount,
          }
        : parsed;

      this.#buckets.set(key, structuredClone(nextBucket));
      merged.push(structuredClone(nextBucket));
    }

    return merged;
  }

  list(query: AttackTrendQuery): AttackTrendBucket[] {
    const matched = Array.from(this.#buckets.values())
      .filter((bucket) => bucket.assetGroupId === query.assetGroupId)
      .filter((bucket) => !query.logType || bucket.logType === query.logType)
      .filter((bucket) => !query.since || bucket.windowStart >= query.since)
      .filter((bucket) => !query.until || bucket.windowEnd <= query.until)
      .sort((left, right) => right.windowStart.localeCompare(left.windowStart));

    const limited = typeof query.limit === 'number' ? matched.slice(0, query.limit) : matched;
    return limited.map((bucket) => structuredClone(bucket));
  }
}
