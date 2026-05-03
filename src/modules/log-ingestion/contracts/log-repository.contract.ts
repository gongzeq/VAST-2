import {
  type AttackTrendBucket,
  type LogIngestRecord,
  type LogSourceConfig,
  type LogType,
  type NormalizedSecurityLogEvent,
} from './log-ingestion.contract.js';

export type SecurityLogEventQuery = {
  assetGroupId: string;
  logType?: LogType;
  sourceId?: string;
  since?: string;
  until?: string;
  limit?: number;
};

export type AttackTrendQuery = {
  assetGroupId: string;
  logType?: LogType;
  since?: string;
  until?: string;
  limit?: number;
};

export interface LogSourceRepository {
  save(source: LogSourceConfig): LogSourceConfig;
  get(sourceId: string): LogSourceConfig | undefined;
  listByAssetGroup(assetGroupId: string): LogSourceConfig[];
  listAll(): LogSourceConfig[];
}

export interface LogIngestRecordRepository {
  save(record: LogIngestRecord): LogIngestRecord;
  listBySourceId(sourceId: string): LogIngestRecord[];
  listAll(): LogIngestRecord[];
}

export interface SecurityLogEventRepository {
  saveMany(events: NormalizedSecurityLogEvent[]): NormalizedSecurityLogEvent[];
  list(query: SecurityLogEventQuery): NormalizedSecurityLogEvent[];
}

export interface AttackTrendRepository {
  upsertMany(buckets: AttackTrendBucket[]): AttackTrendBucket[];
  list(query: AttackTrendQuery): AttackTrendBucket[];
}
