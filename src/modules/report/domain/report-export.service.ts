import { createHash, randomBytes } from 'node:crypto';

import {
  AuthorizationDeniedError,
  createId,
  SchemaValidationError,
  SensitiveExportExpiredError,
  type SafeDetails,
} from '../../../shared/contracts/foundation.js';
import { InMemoryAuditLog } from '../../audit/persistence/in-memory-audit-log.js';
import { type ActorContext } from '../../auth/contracts/actor-context.contract.js';
import { AuthorizationService } from '../../auth/domain/authorization-service.js';
import {
  type CreateReportCommand,
  createReportCommandSchema,
  type ExportReportCommand,
  exportReportCommandSchema,
  type ExportWeakPasswordCleartextCommand,
  exportWeakPasswordCleartextCommandSchema,
  type ReportExportRecord,
  type ReportExportResult,
  reportExportResultSchema,
  type ReportRecord,
  reportRecordSchema,
} from '../contracts/report.contract.js';
import {
  type ReportExportRepository,
  type ReportRepository,
} from '../contracts/report-repository.contract.js';
import {
  InMemoryReportExportRepository,
  InMemoryReportRepository,
} from '../persistence/in-memory-report-repositories.js';

const WEAK_PASSWORD_CLEAR_WINDOW_MS = 30 * 60 * 1000;

const now = (): string => new Date().toISOString();

const toValidationIssues = (issues: Array<{ path: (string | number)[]; message: string }>): string[] => {
  return issues.map((issue) => issue.path.join('.') || issue.message);
};

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const addMs = (isoString: string, milliseconds: number): string => {
  return new Date(new Date(isoString).getTime() + milliseconds).toISOString();
};

const maskPassword = (password: string): string => {
  if (password.length <= 2) {
    return '*'.repeat(password.length);
  }
  return `${password[0]}${'*'.repeat(Math.max(2, password.length - 2))}${password[password.length - 1]}`;
};

export class ReportExportService {
  readonly #reportRepository: ReportRepository;
  readonly #exportRepository: ReportExportRepository;
  readonly #authorization: AuthorizationService;
  readonly #auditLog: InMemoryAuditLog;

  constructor(deps?: {
    reportRepository?: ReportRepository;
    exportRepository?: ReportExportRepository;
    authorization?: AuthorizationService;
    auditLog?: InMemoryAuditLog;
  }) {
    this.#reportRepository = deps?.reportRepository ?? new InMemoryReportRepository();
    this.#exportRepository = deps?.exportRepository ?? new InMemoryReportExportRepository();
    this.#authorization = deps?.authorization ?? new AuthorizationService();
    this.#auditLog = deps?.auditLog ?? new InMemoryAuditLog();
  }

  get auditLog(): InMemoryAuditLog {
    return this.#auditLog;
  }

  createReport(command: unknown, actor: ActorContext): ReportRecord {
    const parsedCommand = createReportCommandSchema.safeParse(command);
    if (!parsedCommand.success) {
      throw new SchemaValidationError({
        issues: toValidationIssues(parsedCommand.error.issues),
      });
    }

    const normalizedCommand = parsedCommand.data;
    this.#assertAssetGroupAccess(actor, normalizedCommand.assetGroupId);

    const report = this.#reportRepository.save(reportRecordSchema.parse({
      reportId: createId('report'),
      reportType: normalizedCommand.reportType,
      assetGroupId: normalizedCommand.assetGroupId,
      taskId: normalizedCommand.taskId,
      title: normalizedCommand.title,
      createdAt: now(),
      sections: [
        {
          title: 'Summary',
          lines: normalizedCommand.summaryLines,
        },
        ...normalizedCommand.sections,
      ],
      weakPasswordFindings: normalizedCommand.weakPasswordFindings,
      mailTaskIds: normalizedCommand.mailTaskIds,
      containsSensitiveCleartext: false,
    }));

    this.#audit(actor.actorId, 'REPORT_CREATED', report.reportId, {
      report_id: report.reportId,
      report_type: report.reportType,
      asset_group_id: report.assetGroupId,
      weak_password_finding_count: report.weakPasswordFindings.length,
      mail_task_count: report.mailTaskIds.length,
    });

    return report;
  }

  exportReport(command: unknown, actor: ActorContext): ReportExportResult {
    const parsedCommand = exportReportCommandSchema.safeParse(command);
    if (!parsedCommand.success) {
      throw new SchemaValidationError({
        issues: toValidationIssues(parsedCommand.error.issues),
      });
    }

    const normalizedCommand = parsedCommand.data;
    this.#authorization.requirePermission(actor, 'report:export');

    const report = this.#reportRepository.get(normalizedCommand.reportId);
    if (!report) {
      throw new SchemaValidationError({
        report_id: normalizedCommand.reportId,
        reason: 'unknown_report',
      }, 'Report does not exist.');
    }

    this.#assertAssetGroupAccess(actor, report.assetGroupId);

    const requestedAt = normalizedCommand.requestedAt ?? now();
    const content = JSON.stringify({
      reportId: report.reportId,
      reportType: report.reportType,
      title: report.title,
      sections: report.sections,
      weakPasswordFindings: report.weakPasswordFindings,
      mailTaskIds: report.mailTaskIds,
    });
    const exportRecord = this.#exportRepository.save(this.#buildExportRecord({
      reportId: report.reportId,
      assetGroupId: report.assetGroupId,
      taskId: report.taskId,
      requestedBy: actor.actorId,
      requestedAt,
      exportKind: 'REPORT',
      format: normalizedCommand.format,
      content,
      cleartextIncluded: false,
      expiresAt: null,
    }));

    this.#audit(actor.actorId, 'REPORT_EXPORTED', exportRecord.exportId, {
      export_id: exportRecord.exportId,
      report_id: report.reportId,
      report_type: report.reportType,
      asset_group_id: report.assetGroupId,
      format: exportRecord.format,
      cleartext_included: false,
    });

    return reportExportResultSchema.parse({
      exportRecord,
      oneTimePassword: null,
      contentPreview: content,
    });
  }

  exportWeakPasswordCleartext(command: unknown, actor: ActorContext): ReportExportResult {
    const parsedCommand = exportWeakPasswordCleartextCommandSchema.safeParse(command);
    if (!parsedCommand.success) {
      throw new SchemaValidationError({
        issues: toValidationIssues(parsedCommand.error.issues),
      });
    }

    const normalizedCommand = parsedCommand.data;
    this.#authorization.requirePermission(actor, 'weak_password:cleartext_export');
    this.#assertAssetGroupAccess(actor, normalizedCommand.assetGroupId);

    const requestedAt = normalizedCommand.requestedAt ?? now();
    const expiresAt = addMs(normalizedCommand.taskCompletedAt, WEAK_PASSWORD_CLEAR_WINDOW_MS);
    if (new Date(requestedAt).getTime() > new Date(expiresAt).getTime()) {
      this.#audit(actor.actorId, 'WEAK_PASSWORD_CLEARTEXT_EXPORT_EXPIRED', normalizedCommand.taskId, {
        task_id: normalizedCommand.taskId,
        asset_group_id: normalizedCommand.assetGroupId,
        requested_at: requestedAt,
        expires_at: expiresAt,
      });
      throw new SensitiveExportExpiredError({
        task_id: normalizedCommand.taskId,
        expires_at: expiresAt,
      });
    }

    const oneTimePassword = randomBytes(18).toString('base64url');
    const content = JSON.stringify({
      taskId: normalizedCommand.taskId,
      findings: normalizedCommand.findings.map((finding) => ({
        targetRef: finding.targetRef,
        service: finding.service,
        account: finding.account,
        passwordMasked: maskPassword(finding.passwordPlaintext),
        discoveredAt: finding.discoveredAt,
      })),
    });
    const exportRecord = this.#exportRepository.save(this.#buildExportRecord({
      reportId: null,
      assetGroupId: normalizedCommand.assetGroupId,
      taskId: normalizedCommand.taskId,
      requestedBy: actor.actorId,
      requestedAt,
      exportKind: 'WEAK_PASSWORD_CLEARTEXT',
      format: 'XLSX_ENCRYPTED',
      content,
      cleartextIncluded: true,
      expiresAt,
    }));

    this.#audit(actor.actorId, 'WEAK_PASSWORD_CLEARTEXT_EXPORTED', exportRecord.exportId, {
      export_id: exportRecord.exportId,
      task_id: normalizedCommand.taskId,
      asset_group_id: normalizedCommand.assetGroupId,
      finding_count: normalizedCommand.findings.length,
      expires_at: expiresAt,
      password_stored: false,
    });

    return reportExportResultSchema.parse({
      exportRecord,
      oneTimePassword,
      contentPreview: null,
    });
  }

  #buildExportRecord(params: {
    reportId: string | null;
    assetGroupId: string;
    taskId: string | null;
    requestedBy: string;
    requestedAt: string;
    exportKind: ReportExportRecord['exportKind'];
    format: ReportExportRecord['format'];
    content: string;
    cleartextIncluded: boolean;
    expiresAt: string | null;
  }): ReportExportRecord {
    const exportId = createId('export');
    return {
      exportId,
      reportId: params.reportId,
      assetGroupId: params.assetGroupId,
      taskId: params.taskId,
      exportKind: params.exportKind,
      format: params.format,
      requestedBy: params.requestedBy,
      requestedAt: params.requestedAt,
      artifactRef: `artifact://${exportId}`,
      artifactSha256: sha256(params.content),
      expiresAt: params.expiresAt,
      cleartextIncluded: params.cleartextIncluded,
      passwordStored: false,
    };
  }

  #assertAssetGroupAccess(actor: ActorContext, assetGroupId: string): void {
    if (this.#authorization.canAccessAssetGroup(actor, assetGroupId)) {
      return;
    }

    throw new AuthorizationDeniedError({
      actor_id: actor.actorId,
      asset_group_id: assetGroupId,
    });
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
      resourceType: 'report_export',
      resourceId,
      details,
    });
  }
}
