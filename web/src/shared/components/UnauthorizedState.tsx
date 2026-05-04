import type { PermissionPoint } from '@/shared/contracts/foundation';

export interface UnauthorizedStateProps {
  /**
   * Permission point name that the actor is missing. Always rendered to the
   * user — required pattern from quality-guidelines.md.
   */
  missingPermission: PermissionPoint;
  /** Custom title override. */
  title?: string;
  /** Optional supporting copy. */
  description?: string;
}

export function UnauthorizedState({
  missingPermission,
  title = '没有权限',
  description,
}: UnauthorizedStateProps) {
  return (
    <div
      className="rounded border border-amber-200 bg-amber-50 p-6"
      data-testid="unauthorized-state"
      role="alert"
      aria-live="polite"
    >
      <h3 className="text-base font-semibold text-amber-900">{title}</h3>
      <p className="mt-1 text-sm text-amber-800">
        {description ?? '当前角色缺少所需权限点。'}
      </p>
      <p className="mt-2 text-xs font-mono text-amber-700">
        缺失权限点：<code>{missingPermission}</code>
      </p>
    </div>
  );
}
