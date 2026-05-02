import { AuthorizationDeniedError, type PermissionPoint } from '../../../shared/contracts/foundation.js';
import { type ActorContext } from '../contracts/actor-context.contract.js';

export class AuthorizationService {
  requirePermission(actor: ActorContext, permissionPoint: PermissionPoint): void {
    if (!actor.permissionPoints.includes(permissionPoint)) {
      throw new AuthorizationDeniedError({
        actor_id: actor.actorId,
        permission_point: permissionPoint,
      });
    }
  }

  canAccessAssetGroup(actor: ActorContext, assetGroupId: string): boolean {
    return actor.assetGroupIds.includes(assetGroupId);
  }
}
