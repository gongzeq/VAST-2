import { InMemoryAuditLog } from './modules/audit/persistence/in-memory-audit-log.js';
import { AssetScopeService } from './modules/asset-scope/domain/asset-scope-service.js';
import { AuthorizationService } from './modules/auth/domain/authorization-service.js';
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
export * from './modules/task-planning/contracts/task-plan.contract.js';
export * from './modules/task-execution/contracts/task-execution.contract.js';
export * from './modules/task-execution/domain/task-management.service.js';
export * from './app/http/present-domain-error.js';

export const createBackendFoundation = () => {
  const auditLog = new InMemoryAuditLog();
  const taskRepository = new InMemoryTaskRepository();
  const authorization = new AuthorizationService();
  const assetScope = new AssetScopeService();
  const taskManagement = new TaskManagementService({
    auditLog,
    taskRepository,
    authorization,
    assetScope,
  });

  return {
    auditLog,
    taskRepository,
    authorization,
    assetScope,
    taskManagement,
    presentDomainError,
  };
};
