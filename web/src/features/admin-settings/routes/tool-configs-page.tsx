/**
 * Tool config admin placeholder. Real implementation lands in PR4.
 */
import { UnauthorizedState } from '@/shared/components/UnauthorizedState';
import { useCanManageToolConfig } from '@/shared/hooks/use-can';

export function ToolConfigsPage() {
  const canManage = useCanManageToolConfig();
  if (!canManage) {
    return (
      <UnauthorizedState
        missingPermission="tool_config:manage"
        title="无 tool_config:manage 权限"
        description="工具配置管理仅对具备 tool_config:manage 权限的角色开放。"
      />
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">工具配置</h1>
        <p className="text-sm text-gray-600">7 个工具的低/中/高档位将在 PR4 中接入。</p>
      </header>
      <div
        className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500"
        data-testid="tool-configs-placeholder"
      >
        开发中
      </div>
    </div>
  );
}
