import { authHandlers } from './auth-handlers';
import { taskHandlers } from './task-handlers';
import { assetGroupHandlers } from './asset-group-handlers';
import { discoveredAssetHandlers } from './discovered-asset-handlers';
import { vulnerabilityHandlers } from './vulnerability-handlers';
import { dashboardHandlers } from './dashboard-handlers';
import { auditLogHandlers } from './audit-log-handlers';
import { adminLlmProviderHandlers } from './admin-llm-provider-handlers';
import { adminToolConfigHandlers } from './admin-tool-config-handlers';
import { adminLogSourceHandlers } from './admin-log-source-handlers';
import { adminMailSourceHandlers } from './admin-mail-source-handlers';
import { adminKillSwitchHandlers } from './admin-kill-switch-handlers';
import { mailHandlers } from './mail-handlers';

export const handlers = [
  ...authHandlers,
  ...taskHandlers,
  ...assetGroupHandlers,
  ...discoveredAssetHandlers,
  ...vulnerabilityHandlers,
  ...dashboardHandlers,
  ...auditLogHandlers,
  ...adminLlmProviderHandlers,
  ...adminToolConfigHandlers,
  ...adminLogSourceHandlers,
  ...adminMailSourceHandlers,
  ...adminKillSwitchHandlers,
  ...mailHandlers,
];

export {
  authHandlers,
  taskHandlers,
  assetGroupHandlers,
  discoveredAssetHandlers,
  vulnerabilityHandlers,
  dashboardHandlers,
  auditLogHandlers,
  adminLlmProviderHandlers,
  adminToolConfigHandlers,
  adminLogSourceHandlers,
  adminMailSourceHandlers,
  adminKillSwitchHandlers,
  mailHandlers,
};
