import { authHandlers } from './auth-handlers';
import { taskHandlers } from './task-handlers';
import { assetGroupHandlers } from './asset-group-handlers';
import { discoveredAssetHandlers } from './discovered-asset-handlers';
import { vulnerabilityHandlers } from './vulnerability-handlers';

export const handlers = [
  ...authHandlers,
  ...taskHandlers,
  ...assetGroupHandlers,
  ...discoveredAssetHandlers,
  ...vulnerabilityHandlers,
];

export { authHandlers, taskHandlers, assetGroupHandlers, discoveredAssetHandlers, vulnerabilityHandlers };
