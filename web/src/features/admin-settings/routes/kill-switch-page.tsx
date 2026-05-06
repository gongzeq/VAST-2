/**
 * Kill switch page (PR4).
 *
 * Status visible to any admin-class actor. Toggling requires:
 *   1. `kill_switch:operate` permission point (else read-only card +
 *      <UnauthorizedState/> in the operator area).
 *   2. The user types the literal `CONFIRM` (case-sensitive).
 *   3. A second ConfirmationDialog acknowledgement.
 */
import { useState } from 'react';

import { Button } from '@/shared/components/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/components/Card';
import { ConfirmationDialog } from '@/shared/components/ConfirmationDialog';
import { ErrorState, Skeleton } from '@/shared/components';
import { Input } from '@/shared/components/Input';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { UnauthorizedState } from '@/shared/components/UnauthorizedState';
import type { KillSwitchStatus } from '@/shared/contracts';
import { formatDate } from '@/shared/formatting/format-date';
import {
  useCanManageAdminConfig,
  useCanOperateKillSwitch,
} from '@/shared/hooks/use-can';

import { AdminPageShell } from '../components/_shared';
import { useKillSwitchState, useToggleKillSwitch } from '../hooks';

const CONFIRM_TOKEN = 'CONFIRM';

export function KillSwitchPage() {
  // Both hooks must run unconditionally so the React hook order is stable.
  const canManageAdmin = useCanManageAdminConfig();
  const canOperate = useCanOperateKillSwitch();
  const canSeePage = canManageAdmin || canOperate;
  const query = useKillSwitchState();
  const toggleMutation = useToggleKillSwitch();
  const [confirmText, setConfirmText] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  return (
    <AdminPageShell
      title="Kill Switch"
      description="停止扫描工具与受控辅助命令；不影响邮件网关与日志接收链路。"
      permitted={canSeePage}
      missingPermission="kill_switch:operate"
      unauthorizedDescription="Kill Switch 仅对管理员角色开放。"
    >
      <Card data-testid="kill-switch-card">
        <CardHeader>
          <CardTitle>当前状态</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {query.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : query.isError ? (
            <ErrorState description={query.error.message} />
          ) : (
            <div className="space-y-3" data-testid="kill-switch-state">
              <div className="flex items-center gap-3">
                <StatusBadge
                  status={{ kind: 'kill-switch', value: query.data.status }}
                />
                <span className="text-sm text-gray-700">
                  {query.data.status === 'RUNNING' ? '所有受控工具可执行' : '受控工具已被冻结'}
                </span>
              </div>
              <p className="text-xs text-gray-500">{query.data.scopeNote}</p>
              <p className="text-xs text-gray-500">
                上次操作：
                {query.data.lastOperatorActorId
                  ? `${query.data.lastOperatorActorId} · ${
                      query.data.lastOperatedAt
                        ? formatDate(query.data.lastOperatedAt)
                        : '—'
                    }`
                  : '—'}
              </p>
              <hr className="border-gray-200" />
              {!canOperate ? (
                <UnauthorizedState
                  missingPermission="kill_switch:operate"
                  title="无 kill_switch:operate 权限"
                  description="状态可见，但无法触发开关。请联系管理员授予 kill_switch:operate 权限。"
                />
              ) : (
                <div className="space-y-3" data-testid="kill-switch-operator">
                  <p className="text-sm text-gray-700">
                    输入 <code className="rounded bg-gray-100 px-1 py-0.5">{CONFIRM_TOKEN}</code>{' '}
                    （区分大小写）以启用切换按钮。
                  </p>
                  <Input
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    placeholder={CONFIRM_TOKEN}
                    data-testid="kill-switch-confirm-input"
                  />
                  <Button
                    variant={query.data.status === 'RUNNING' ? 'destructive' : 'primary'}
                    disabled={confirmText !== CONFIRM_TOKEN}
                    onClick={() => setConfirmDialogOpen(true)}
                    data-testid="kill-switch-toggle-trigger"
                  >
                    {query.data.status === 'RUNNING'
                      ? '停止扫描工具与辅助命令'
                      : '恢复扫描工具与辅助命令'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmationDialog
        open={confirmDialogOpen}
        actionDescription={
          query.data?.status === 'RUNNING' ? '停止扫描工具与辅助命令' : '恢复扫描工具与辅助命令'
        }
        targetScope="全局 · 影响所有运行中的扫描工具"
        riskLevelText="高 — 立即生效"
        onCancel={() => setConfirmDialogOpen(false)}
        onConfirm={async () => {
          if (!query.data) return;
          const target: KillSwitchStatus =
            query.data.status === 'RUNNING' ? 'STOPPED' : 'RUNNING';
          await toggleMutation.mutateAsync({ confirm: 'CONFIRM', target });
          setConfirmDialogOpen(false);
          setConfirmText('');
        }}
        confirmLabel="确认操作"
      />
    </AdminPageShell>
  );
}
