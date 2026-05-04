import { InMemoryAuditLog } from './modules/audit/persistence/in-memory-audit-log.js';
import { AssetScopeService } from './modules/asset-scope/domain/asset-scope-service.js';
import { AuthorizationService } from './modules/auth/domain/authorization-service.js';
import { DashboardQueryService } from './modules/dashboard/domain/dashboard-query.service.js';
import { MailAnalysisService } from './modules/phishing-mail/domain/mail-analysis.service.js';
import {
  InMemoryMailAnalysisRepository,
  InMemoryMailGatewayRepository,
} from './modules/phishing-mail/persistence/in-memory-mail-repositories.js';
import { ReportExportService } from './modules/report/domain/report-export.service.js';
import {
  InMemoryReportExportRepository,
  InMemoryReportRepository,
} from './modules/report/persistence/in-memory-report-repositories.js';
import {
  InMemoryAttackTrendRepository,
  InMemoryLogIngestRecordRepository,
  InMemoryLogSourceRepository,
  InMemorySecurityLogEventRepository,
} from './modules/log-ingestion/persistence/in-memory-log-ingestion-repositories.js';
import { LogIngestionService } from './modules/log-ingestion/domain/log-ingestion.service.js';
import { LogSourceManagementService } from './modules/log-ingestion/domain/log-source-management.service.js';
import { InMemoryTaskRepository } from './modules/task-execution/contracts/task-execution.contract.js';
import { TaskManagementService } from './modules/task-execution/domain/task-management.service.js';
import { presentDomainError } from './app/http/present-domain-error.js';

export * from './shared/contracts/foundation.js';
export * from './shared/contracts/api-error-response.js';
export * from './modules/audit/persistence/in-memory-audit-log.js';
export * from './modules/auth/contracts/actor-context.contract.js';
export * from './modules/auth/domain/authorization-service.js';
export * from './modules/asset-scope/contracts/asset-authorization.contract.js';
export * from './modules/asset-scope/domain/asset-scope-service.js';
export * from './modules/dashboard/contracts/dashboard-read.contract.js';
export * from './modules/dashboard/domain/dashboard-query.service.js';
export * from './modules/log-ingestion/contracts/log-ingestion.contract.js';
export * from './modules/log-ingestion/contracts/log-repository.contract.js';
export * from './modules/log-ingestion/domain/attack-trend-aggregator.js';
export * from './modules/log-ingestion/domain/log-ingestion.service.js';
export * from './modules/log-ingestion/domain/log-source-management.service.js';
export * from './modules/log-ingestion/domain/security-log-parser.js';
export * from './modules/log-ingestion/domain/security-log-redactor.js';
export * from './modules/log-ingestion/persistence/in-memory-log-ingestion-repositories.js';
export * from './modules/phishing-mail/contracts/mail-analysis.contract.js';
export * from './modules/phishing-mail/contracts/mail-repository.contract.js';
export * from './modules/phishing-mail/domain/mail-analysis.service.js';
export * from './modules/phishing-mail/persistence/in-memory-mail-repositories.js';
export * from './modules/report/contracts/report.contract.js';
export * from './modules/report/contracts/report-repository.contract.js';
export * from './modules/report/domain/report-export.service.js';
export * from './modules/report/persistence/in-memory-report-repositories.js';
export * from './modules/task-planning/contracts/task-plan.contract.js';
export * from './modules/task-execution/contracts/task-execution.contract.js';
export * from './modules/task-execution/domain/task-management.service.js';
export * from './app/http/present-domain-error.js';

export const createBackendFoundation = () => {
  const auditLog = new InMemoryAuditLog();
  const taskRepository = new InMemoryTaskRepository();
  const authorization = new AuthorizationService();
  const assetScope = new AssetScopeService();
  const logSourceRepository = new InMemoryLogSourceRepository();
  const logIngestRecordRepository = new InMemoryLogIngestRecordRepository();
  const securityLogEventRepository = new InMemorySecurityLogEventRepository();
  const attackTrendRepository = new InMemoryAttackTrendRepository();
  const mailGatewayRepository = new InMemoryMailGatewayRepository();
  const mailAnalysisRepository = new InMemoryMailAnalysisRepository();
  const reportRepository = new InMemoryReportRepository();
  const reportExportRepository = new InMemoryReportExportRepository();
  const taskManagement = new TaskManagementService({
    auditLog,
    taskRepository,
    authorization,
    assetScope,
  });
  const logSourceManagement = new LogSourceManagementService({
    repository: logSourceRepository,
    authorization,
    auditLog,
  });
  const logIngestion = new LogIngestionService({
    sourceRepository: logSourceRepository,
    ingestRecordRepository: logIngestRecordRepository,
    eventRepository: securityLogEventRepository,
    trendRepository: attackTrendRepository,
    assetScope,
    auditLog,
  });
  const dashboardQuery = new DashboardQueryService({
    eventRepository: securityLogEventRepository,
    trendRepository: attackTrendRepository,
    authorization,
    auditLog,
  });
  const mailAnalysis = new MailAnalysisService({
    gatewayRepository: mailGatewayRepository,
    analysisRepository: mailAnalysisRepository,
    auditLog,
  });
  const reportExport = new ReportExportService({
    reportRepository,
    exportRepository: reportExportRepository,
    authorization,
    auditLog,
  });

  return {
    auditLog,
    taskRepository,
    authorization,
    assetScope,
    logSourceRepository,
    logIngestRecordRepository,
    securityLogEventRepository,
    attackTrendRepository,
    mailGatewayRepository,
    mailAnalysisRepository,
    reportRepository,
    reportExportRepository,
    taskManagement,
    logSourceManagement,
    logIngestion,
    dashboardQuery,
    mailAnalysis,
    reportExport,
    presentDomainError,
  };
};
