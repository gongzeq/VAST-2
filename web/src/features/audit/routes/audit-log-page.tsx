/**
 * Audit log placeholder. Real implementation lands in PR3.
 */
import { UnauthorizedState } from '@/shared/components/UnauthorizedState';
import { useCanViewAuditLog } from '@/shared/hooks/use-can';

export function AuditLogPage() {
  const canView = useCanViewAuditLog();
  if (!canView) {
    return (
      <UnauthorizedState
        missingPermission="audit_log:view"
        title="无 audit_log:view 权限"
        description="审计轨迹仅对具备 audit_log:view 权限的角色开放。"
      />
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">审计轨迹</h1>
        <p className="text-sm text-gray-600">
          多维过滤 / 详情对话框 / 明文脱敏将在 PR3 中接入。
        </p>
      </header>
      <div
        className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500"
        data-testid="audit-log-placeholder"
      >
        开发中
      </div>
    </div>
  );
}
