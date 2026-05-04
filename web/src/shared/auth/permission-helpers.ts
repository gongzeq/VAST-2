/**
 * Pure permission-point helpers. Components should use the `useCan*` hooks,
 * but selectors here keep the string literals out of components.
 */
import type { ActorContext, PermissionPoint } from '@/shared/contracts';

export function hasPermission(
  actor: ActorContext | null | undefined,
  point: PermissionPoint,
): boolean {
  if (!actor) return false;
  return actor.permissionPoints.includes(point);
}

export function hasAnyPermission(
  actor: ActorContext | null | undefined,
  points: PermissionPoint[],
): boolean {
  if (!actor) return false;
  return points.some((p) => actor.permissionPoints.includes(p));
}
