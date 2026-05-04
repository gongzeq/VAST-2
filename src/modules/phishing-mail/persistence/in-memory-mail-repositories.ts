import {
  type MailAnalysisRecord,
  mailAnalysisRecordSchema,
  type MailGatewayConfig,
  mailGatewayConfigSchema,
} from '../contracts/mail-analysis.contract.js';
import {
  type MailAnalysisQuery,
  type MailAnalysisRepository,
  type MailGatewayRepository,
} from '../contracts/mail-repository.contract.js';

export class InMemoryMailGatewayRepository implements MailGatewayRepository {
  readonly #gateways = new Map<string, MailGatewayConfig>();

  save(config: MailGatewayConfig): MailGatewayConfig {
    const persisted = mailGatewayConfigSchema.parse(config);
    this.#gateways.set(persisted.gatewayId, structuredClone(persisted));
    return structuredClone(persisted);
  }

  get(gatewayId: string): MailGatewayConfig | undefined {
    const config = this.#gateways.get(gatewayId);
    return config ? structuredClone(config) : undefined;
  }

  listByAssetGroup(assetGroupId: string): MailGatewayConfig[] {
    return Array.from(this.#gateways.values())
      .filter((config) => config.assetGroupId === assetGroupId)
      .map((config) => structuredClone(config));
  }

  listAll(): MailGatewayConfig[] {
    return Array.from(this.#gateways.values()).map((config) => structuredClone(config));
  }
}

export class InMemoryMailAnalysisRepository implements MailAnalysisRepository {
  readonly #records: MailAnalysisRecord[] = [];

  save(record: MailAnalysisRecord): MailAnalysisRecord {
    const persisted = mailAnalysisRecordSchema.parse(record);
    const existingIndex = this.#records.findIndex((item) => item.mailTaskId === persisted.mailTaskId);
    if (existingIndex >= 0) {
      this.#records[existingIndex] = structuredClone(persisted);
    } else {
      this.#records.push(structuredClone(persisted));
    }
    return structuredClone(persisted);
  }

  get(mailTaskId: string): MailAnalysisRecord | undefined {
    const record = this.#records.find((item) => item.mailTaskId === mailTaskId);
    return record ? structuredClone(record) : undefined;
  }

  list(query: MailAnalysisQuery = {}): MailAnalysisRecord[] {
    const matched = this.#records
      .filter((record) => !query.assetGroupId || record.assetGroupId === query.assetGroupId)
      .filter((record) => !query.gatewayId || record.gatewayId === query.gatewayId)
      .filter((record) => query.phishingLabel === undefined || record.phishingLabel === query.phishingLabel)
      .filter((record) => !query.since || record.receivedAt >= query.since)
      .filter((record) => !query.until || record.receivedAt <= query.until)
      .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));

    const limited = typeof query.limit === 'number' ? matched.slice(0, query.limit) : matched;
    return limited.map((record) => structuredClone(record));
  }
}
