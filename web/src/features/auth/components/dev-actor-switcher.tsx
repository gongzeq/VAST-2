/**
 * Dev-only quick role switcher in the authenticated layout header.
 *
 * Calls `setActor()` directly without round-tripping through MSW so the
 * switch is instantaneous (R10). Persists to sessionStorage via the
 * ActorProvider.
 */
import {
  buildActorContextFromRole,
  labelForRole,
  presetRoleIds,
  type PresetRoleId,
} from '@/shared/auth/roles';
import { Select } from '@/shared/components';
import { useCurrentActor } from '@/shared/hooks/use-current-actor';
import { useToast } from '@/shared/hooks/use-toast';

export function DevActorSwitcher() {
  const { actor, setActor } = useCurrentActor();
  const { pushToast } = useToast();

  const currentRole = (actor?.roleIds[0] ?? 'security-engineer') as PresetRoleId;

  return (
    <label className="flex items-center gap-2 text-xs text-gray-600" data-testid="dev-actor-switcher">
      <span className="font-medium">DEV 角色：</span>
      <Select
        className="w-48"
        value={currentRole}
        onChange={(event) => {
          const next = event.target.value as PresetRoleId;
          const username = actor?.actorId.replace(/^actor_/, '') ?? next;
          const nextActor = buildActorContextFromRole(username, next);
          setActor(nextActor);
          pushToast('info', `已切换为：${labelForRole(next)}`);
        }}
      >
        {presetRoleIds.map((roleId) => (
          <option key={roleId} value={roleId}>
            {labelForRole(roleId)} ({roleId})
          </option>
        ))}
      </Select>
    </label>
  );
}
