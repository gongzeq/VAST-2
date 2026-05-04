import { authHandlers } from './auth-handlers';
import { taskHandlers } from './task-handlers';
import { assetGroupHandlers } from './asset-group-handlers';
import { discoveredAssetHandlers } from './discovered-asset-handlers';

export const handlers = [
  ...authHandlers,
  ...taskHandlers,
  ...assetGroupHandlers,
  ...discoveredAssetHandlers,
];

export { authHandlers, taskHandlers, assetGroupHandlers, discoveredAssetHandlers };
