import { type MailAnalysisRecord, type MailGatewayConfig } from './mail-analysis.contract.js';

export interface MailGatewayRepository {
  save(config: MailGatewayConfig): MailGatewayConfig;
  get(gatewayId: string): MailGatewayConfig | undefined;
  listByAssetGroup(assetGroupId: string): MailGatewayConfig[];
  listAll(): MailGatewayConfig[];
}

export type MailAnalysisQuery = {
  assetGroupId?: string;
  gatewayId?: string;
  phishingLabel?: MailAnalysisRecord['phishingLabel'];
  since?: string;
  until?: string;
  limit?: number;
};

export interface MailAnalysisRepository {
  save(record: MailAnalysisRecord): MailAnalysisRecord;
  get(mailTaskId: string): MailAnalysisRecord | undefined;
  list(query?: MailAnalysisQuery): MailAnalysisRecord[];
}
