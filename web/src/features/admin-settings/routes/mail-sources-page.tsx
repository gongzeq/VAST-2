/**
 * Mail source admin placeholder. Real implementation lands in PR4.
 *
 * No dedicated permission point in PRD §3 — uses admin-like aggregate.
 */
import { UnauthorizedState } from '@/shared/components/UnauthorizedState';
import { useCanManageMailSource } from '@/shared/hooks/use-can';

export function MailSourcesPage() {
  const canManage = useCanManageMailSource();
  if (!canManage) {
    return (
      <UnauthorizedState
        missingPermission="asset_scope:manage"
        title="无管理权限"
        description="邮件源管理仅对管理员角色开放。"
      />
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">邮件源</h1>
        <p className="text-sm text-gray-600">上下游邮件网关配置将在 PR4 中接入。</p>
      </header>
      <div
        className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500"
        data-testid="mail-sources-placeholder"
      >
        开发中
      </div>
    </div>
  );
}
