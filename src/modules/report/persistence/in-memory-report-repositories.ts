import {
  type ReportExportRecord,
  reportExportRecordSchema,
  type ReportRecord,
  reportRecordSchema,
} from '../contracts/report.contract.js';
import {
  type ReportExportQuery,
  type ReportExportRepository,
  type ReportQuery,
  type ReportRepository,
} from '../contracts/report-repository.contract.js';

export class InMemoryReportRepository implements ReportRepository {
  readonly #reports = new Map<string, ReportRecord>();

  save(report: ReportRecord): ReportRecord {
    const persisted = reportRecordSchema.parse(report);
    this.#reports.set(persisted.reportId, structuredClone(persisted));
    return structuredClone(persisted);
  }

  get(reportId: string): ReportRecord | undefined {
    const report = this.#reports.get(reportId);
    return report ? structuredClone(report) : undefined;
  }

  list(query: ReportQuery = {}): ReportRecord[] {
    const matched = Array.from(this.#reports.values())
      .filter((report) => !query.assetGroupId || report.assetGroupId === query.assetGroupId)
      .filter((report) => !query.reportType || report.reportType === query.reportType)
      .filter((report) => !query.taskId || report.taskId === query.taskId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    const limited = typeof query.limit === 'number' ? matched.slice(0, query.limit) : matched;
    return limited.map((report) => structuredClone(report));
  }
}

export class InMemoryReportExportRepository implements ReportExportRepository {
  readonly #exports = new Map<string, ReportExportRecord>();

  save(exportRecord: ReportExportRecord): ReportExportRecord {
    const persisted = reportExportRecordSchema.parse(exportRecord);
    this.#exports.set(persisted.exportId, structuredClone(persisted));
    return structuredClone(persisted);
  }

  get(exportId: string): ReportExportRecord | undefined {
    const exportRecord = this.#exports.get(exportId);
    return exportRecord ? structuredClone(exportRecord) : undefined;
  }

  list(query: ReportExportQuery = {}): ReportExportRecord[] {
    const matched = Array.from(this.#exports.values())
      .filter((exportRecord) => !query.assetGroupId || exportRecord.assetGroupId === query.assetGroupId)
      .filter((exportRecord) => !query.reportId || exportRecord.reportId === query.reportId)
      .filter((exportRecord) => !query.exportKind || exportRecord.exportKind === query.exportKind)
      .filter((exportRecord) => !query.requestedBy || exportRecord.requestedBy === query.requestedBy)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));

    const limited = typeof query.limit === 'number' ? matched.slice(0, query.limit) : matched;
    return limited.map((exportRecord) => structuredClone(exportRecord));
  }
}
