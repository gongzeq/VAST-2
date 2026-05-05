/**
 * Kill switch admin placeholder. Real implementation lands in PR4.
 *
 * Status read is permissible to any admin-like actor; the toggle button area
 * shows UnauthorizedState for non-`kill_switch:operate` actors.
 */
import { UnauthorizedState } from '@/shared/components/UnauthorizedState';
import { useCanManageAdminConfig, useCanOperateKillSwitch } from '@/shared/hooks/use-can';

export function KillSwitchPage() {
  const canSeePage = useCanManageAdminConfig();
  const canOperate = useCanOperateKillSwitch();
  if (!canSeePage) {
    return (
      <UnauthorizedState
        missingPermission="kill_switch:operate"
        title="无管理权限"
        description="Kill Switch 仅对管理员角色开放。"
      />
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Kill Switch</h1>
        <p className="text-sm text-gray-600">
          停止扫描工具与受控辅助命令；不影响邮件网关与日志接收链路。
        </p>
      </header>
      <div
        className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500"
        data-testid="kill-switch-placeholder"
      >
        {canOperate ? '开发中（操作器）' : '开发中（只读视图）'}
      </div>
    </div>
  );
}
