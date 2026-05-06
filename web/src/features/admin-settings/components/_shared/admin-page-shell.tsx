/**
 * Page shell for every admin-settings page.
 *
 * - Renders a "演示数据：刷新后回到初始状态" banner (R-E from the plan).
 * - Short-circuits to <UnauthorizedState/> when actor lacks the page perm.
 */
import type { ReactNode } from 'react';

import { UnauthorizedState } from '@/shared/components/UnauthorizedState';
import type { PermissionPoint } from '@/shared/contracts/foundation';

export interface AdminPageShellProps {
  title: string;
  description?: string;
  permitted: boolean;
  missingPermission: PermissionPoint;
  /** Custom "no permission" copy. */
  unauthorizedDescription?: string;
  children: ReactNode;
}

export function AdminPageShell({
  title,
  description,
  permitted,
  missingPermission,
  unauthorizedDescription,
  children,
}: AdminPageShellProps) {
  if (!permitted) {
    return (
      <UnauthorizedState
        missingPermission={missingPermission}
        title={`无 ${missingPermission} 权限`}
        description={unauthorizedDescription}
      />
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {description ? (
          <p className="text-sm text-gray-600">{description}</p>
        ) : null}
      </header>
      <div
        role="status"
        className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
        data-testid="admin-demo-banner"
      >
        演示数据：刷新页面后将回到初始状态。所有写操作都通过 MSW 在内存中生效。
      </div>
      {children}
    </div>
  );
}
