import { describe, expect, it } from 'vitest';

import { type ActorContext } from '../../modules/auth/contracts/actor-context.contract.js';
import { ReportExportService } from '../../modules/report/domain/report-export.service.js';
import {
  InMemoryReportExportRepository,
  InMemoryReportRepository,
} from '../../modules/report/persistence/in-memory-report-repositories.js';
import { AuthorizationDeniedError, SensitiveExportExpiredError } from '../../shared/contracts/foundation.js';

const actor: ActorContext = {
  actorId: 'user_1',
  roleIds: ['security_engineer'],
  permissionPoints: ['report:export', 'weak_password:cleartext_export'],
  assetGroupIds: ['ag_prod'],
  yoloEnabled: false,
};

describe('ReportExportService', () => {
  it('creates masked reports and exports them with permission gating and audit', () => {
    const reportRepository = new InMemoryReportRepository();
    const exportRepository = new InMemoryReportExportRepository();
    const service = new ReportExportService({ reportRepository, exportRepository });

    const report = service.createReport({
      reportType: 'WEAK_PASSWORD',
      assetGroupId: 'ag_prod',
      taskId: 'task_1',
      title: 'Weak password report',
      summaryLines: ['One weak password finding was detected.'],
      weakPasswordFindings: [
        {
          targetRef: 'ssh://10.0.0.5',
          service: 'ssh',
          account: 'root',
          passwordMasked: 'p******d',
          severity: 'HIGH',
        },
      ],
    }, actor);

    const result = service.exportReport({
      reportId: report.reportId,
      format: 'JSON',
    }, actor);

    expect(report.containsSensitiveCleartext).toBe(false);
    expect(result.exportRecord.exportKind).toBe('REPORT');
    expect(result.exportRecord.cleartextIncluded).toBe(false);
    expect(result.exportRecord.passwordStored).toBe(false);
    expect(result.contentPreview).toContain('p******d');
    expect(result.contentPreview).not.toContain('password123');
    expect(exportRepository.list({ reportId: report.reportId })).toHaveLength(1);
    expect(service.auditLog.listAll().map((record) => record.action)).toEqual([
      'REPORT_CREATED',
      'REPORT_EXPORTED',
    ]);
  });

  it('blocks report export when the actor lacks report export permission', () => {
    const service = new ReportExportService();
    const report = service.createReport({
      reportType: 'TASK',
      assetGroupId: 'ag_prod',
      title: 'Task report',
    }, actor);
    const deniedActor: ActorContext = {
      ...actor,
      permissionPoints: [],
    };

    expect(() => service.exportReport({ reportId: report.reportId }, deniedActor)).toThrowError(AuthorizationDeniedError);
  });

  it('allows weak password cleartext export only inside the 30 minute window without storing the export password', () => {
    const exportRepository = new InMemoryReportExportRepository();
    const service = new ReportExportService({ exportRepository });

    const result = service.exportWeakPasswordCleartext({
      assetGroupId: 'ag_prod',
      taskId: 'task_weak_password',
      taskCompletedAt: '2026-05-03T10:00:00.000Z',
      requestedAt: '2026-05-03T10:29:59.000Z',
      findings: [
        {
          targetRef: 'ssh://10.0.0.5',
          service: 'ssh',
          account: 'root',
          passwordPlaintext: 'password123',
          discoveredAt: '2026-05-03T09:58:00.000Z',
        },
      ],
    }, actor);

    expect(result.exportRecord.exportKind).toBe('WEAK_PASSWORD_CLEARTEXT');
    expect(result.exportRecord.format).toBe('XLSX_ENCRYPTED');
    expect(result.exportRecord.cleartextIncluded).toBe(true);
    expect(result.exportRecord.passwordStored).toBe(false);
    expect(result.oneTimePassword).toEqual(expect.any(String));
    expect(result.contentPreview).toBeNull();
    expect(JSON.stringify(result.exportRecord)).not.toContain('password123');
    expect(JSON.stringify(service.auditLog.listAll())).not.toContain('password123');
    expect(exportRepository.list({ exportKind: 'WEAK_PASSWORD_CLEARTEXT' })).toHaveLength(1);
  });

  it('rejects weak password cleartext export after the allowed window and audits the expiry', () => {
    const service = new ReportExportService();

    expect(() => service.exportWeakPasswordCleartext({
      assetGroupId: 'ag_prod',
      taskId: 'task_weak_password',
      taskCompletedAt: '2026-05-03T10:00:00.000Z',
      requestedAt: '2026-05-03T10:30:01.000Z',
      findings: [
        {
          targetRef: 'ssh://10.0.0.5',
          service: 'ssh',
          account: 'root',
          passwordPlaintext: 'password123',
          discoveredAt: '2026-05-03T09:58:00.000Z',
        },
      ],
    }, actor)).toThrowError(SensitiveExportExpiredError);

    expect(service.auditLog.listAll().map((record) => record.action)).toEqual([
      'WEAK_PASSWORD_CLEARTEXT_EXPORT_EXPIRED',
    ]);
    expect(JSON.stringify(service.auditLog.listAll())).not.toContain('password123');
  });

  it('blocks weak password cleartext export when the actor lacks the cleartext export permission', () => {
    const service = new ReportExportService();
    const deniedActor: ActorContext = {
      ...actor,
      permissionPoints: ['report:export'],
    };

    expect(() => service.exportWeakPasswordCleartext({
      assetGroupId: 'ag_prod',
      taskId: 'task_weak_password',
      taskCompletedAt: '2026-05-03T10:00:00.000Z',
      requestedAt: '2026-05-03T10:10:00.000Z',
      findings: [
        {
          targetRef: 'ssh://10.0.0.5',
          service: 'ssh',
          account: 'root',
          passwordPlaintext: 'password123',
          discoveredAt: '2026-05-03T09:58:00.000Z',
        },
      ],
    }, deniedActor)).toThrowError(AuthorizationDeniedError);

    expect(JSON.stringify(service.auditLog.listAll())).not.toContain('password123');
  });

  it('blocks weak password cleartext export when the actor lacks asset group access', () => {
    const service = new ReportExportService();
    const otherGroupActor: ActorContext = {
      ...actor,
      assetGroupIds: ['ag_other'],
    };

    expect(() => service.exportWeakPasswordCleartext({
      assetGroupId: 'ag_prod',
      taskId: 'task_weak_password',
      taskCompletedAt: '2026-05-03T10:00:00.000Z',
      requestedAt: '2026-05-03T10:10:00.000Z',
      findings: [
        {
          targetRef: 'ssh://10.0.0.5',
          service: 'ssh',
          account: 'root',
          passwordPlaintext: 'password123',
          discoveredAt: '2026-05-03T09:58:00.000Z',
        },
      ],
    }, otherGroupActor)).toThrowError(AuthorizationDeniedError);

    expect(JSON.stringify(service.auditLog.listAll())).not.toContain('password123');
  });

  it('blocks report export when the actor cannot access the report asset group', () => {
    const service = new ReportExportService();
    const report = service.createReport({
      reportType: 'TASK',
      assetGroupId: 'ag_prod',
      title: 'Task report',
    }, actor);
    const otherGroupActor: ActorContext = {
      ...actor,
      assetGroupIds: ['ag_other'],
    };

    expect(() => service.exportReport({ reportId: report.reportId }, otherGroupActor)).toThrowError(AuthorizationDeniedError);
  });
});
