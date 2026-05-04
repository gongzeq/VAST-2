import { type ReportExportRecord, type ReportRecord } from './report.contract.js';

export type ReportQuery = {
  assetGroupId?: string;
  reportType?: ReportRecord['reportType'];
  taskId?: string;
  limit?: number;
};

export interface ReportRepository {
  save(report: ReportRecord): ReportRecord;
  get(reportId: string): ReportRecord | undefined;
  list(query?: ReportQuery): ReportRecord[];
}

export type ReportExportQuery = {
  assetGroupId?: string;
  reportId?: string;
  exportKind?: ReportExportRecord['exportKind'];
  requestedBy?: string;
  limit?: number;
};

export interface ReportExportRepository {
  save(exportRecord: ReportExportRecord): ReportExportRecord;
  get(exportId: string): ReportExportRecord | undefined;
  list(query?: ReportExportQuery): ReportExportRecord[];
}
