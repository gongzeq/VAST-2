import { type PermissionPoint } from '../../../shared/contracts/foundation.js';

export type ActorContext = {
  actorId: string;
  roleIds: string[];
  permissionPoints: PermissionPoint[];
  assetGroupIds: string[];
  yoloEnabled: boolean;
};
