/**
 * LLM Provider admin placeholder. Real implementation lands in PR4.
 */
import { UnauthorizedState } from '@/shared/components/UnauthorizedState';
import { useCanManageLlmProvider } from '@/shared/hooks/use-can';

export function LlmProvidersPage() {
  const canManage = useCanManageLlmProvider();
  if (!canManage) {
    return (
      <UnauthorizedState
        missingPermission="llm_provider:manage"
        title="无 llm_provider:manage 权限"
        description="LLM Provider 管理仅对具备 llm_provider:manage 权限的角色开放。"
      />
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">LLM Provider</h1>
        <p className="text-sm text-gray-600">
          列表 / 新建 / 编辑 / 启停 / 删除 将在 PR4 中接入。
        </p>
      </header>
      <div
        className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500"
        data-testid="llm-providers-placeholder"
      >
        开发中
      </div>
    </div>
  );
}
