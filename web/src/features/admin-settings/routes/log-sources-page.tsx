/**
 * Log source admin placeholder. Real implementation lands in PR4.
 */
import { UnauthorizedState } from '@/shared/components/UnauthorizedState';
import { useCanManageLogSource } from '@/shared/hooks/use-can';

export function LogSourcesPage() {
  const canManage = useCanManageLogSource();
  if (!canManage) {
    return (
      <UnauthorizedState
        missingPermission="log_source:manage"
        title="无 log_source:manage 权限"
        description="日志源管理仅对具备 log_source:manage 权限的角色开放。"
      />
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">日志源</h1>
        <p className="text-sm text-gray-600">列表 / 新建 / 编辑 / 启停 将在 PR4 中接入。</p>
      </header>
      <div
        className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500"
        data-testid="log-sources-placeholder"
      >
        开发中
      </div>
    </div>
  );
}
