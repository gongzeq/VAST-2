import type { ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';

import { Button } from '@/shared/components/Button';
import { cn } from '@/shared/components/class-names';
import { useCurrentActor } from '@/shared/hooks/use-current-actor';
import { useToast } from '@/shared/hooks/use-toast';
import {
  useCanManageAdminConfig,
  useCanManageLlmProvider,
  useCanManageLogSource,
  useCanManageMailSource,
  useCanManageToolConfig,
  useCanOperateKillSwitch,
  useCanViewAuditLog,
} from '@/shared/hooks/use-can';
import type { PermissionPoint } from '@/shared/contracts/foundation';

import { DevActorSwitcher } from '@/features/auth/components/dev-actor-switcher';

export interface AuthenticatedLayoutProps {
  /** When provided overrides <Outlet/>, used by tests rendering specific subtrees. */
  children?: ReactNode;
}

interface NavEntry {
  to: string;
  label: string;
  exact?: boolean;
  /** When false, render the entry as a disabled span with an explanation tooltip. */
  permitted: boolean;
  /**
   * Permission point name shown in the disabled tooltip. Empty string means no
   * tooltip (entry is always permitted).
   */
  missingPermission?: PermissionPoint;
}

const enabledLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded px-3 py-1.5 text-sm transition',
    isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100',
  );

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { actor, clearActor } = useCurrentActor();
  const { pushToast } = useToast();
  const canViewAuditLog = useCanViewAuditLog();
  const canManageLlmProvider = useCanManageLlmProvider();
  const canManageToolConfig = useCanManageToolConfig();
  const canManageLogSource = useCanManageLogSource();
  const canManageMailSource = useCanManageMailSource();
  const canOperateKillSwitch = useCanOperateKillSwitch();
  const canManageAdmin = useCanManageAdminConfig();

  if (!actor) {
    return <Navigate to="/login" replace />;
  }

  const navEntries: NavEntry[] = [
    { to: '/', label: '任务控制台', exact: true, permitted: true },
    { to: '/tasks', label: '任务列表', permitted: true },
    { to: '/asset-scope', label: '资产范围', permitted: true },
    { to: '/asset-scope/discovered', label: '待确认资产', permitted: true },
    { to: '/dashboard', label: '仪表盘', permitted: true },
    {
      to: '/audit',
      label: '审计',
      permitted: canViewAuditLog,
      missingPermission: 'audit_log:view',
    },
    {
      to: '/admin/llm-providers',
      label: 'LLM Provider',
      permitted: canManageLlmProvider,
      missingPermission: 'llm_provider:manage',
    },
    {
      to: '/admin/tool-configs',
      label: '工具配置',
      permitted: canManageToolConfig,
      missingPermission: 'tool_config:manage',
    },
    {
      to: '/admin/log-sources',
      label: '日志源',
      permitted: canManageLogSource,
      missingPermission: 'log_source:manage',
    },
    {
      to: '/admin/mail-sources',
      label: '邮件源',
      permitted: canManageMailSource,
      missingPermission: 'asset_scope:manage',
    },
    {
      to: '/admin/kill-switch',
      label: 'Kill Switch',
      // Kill switch status is visible to any admin-class actor; the operate
      // button area handles its own permission gate inside the page.
      permitted: canManageAdmin || canOperateKillSwitch,
      missingPermission: 'kill_switch:operate',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-base font-semibold text-gray-900">
              智能网络安全分析平台
            </Link>
            <nav className="flex flex-wrap items-center gap-1" aria-label="primary">
              {navEntries.map((item) => {
                if (item.permitted) {
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.exact}
                      className={enabledLinkClass}
                      data-testid={`nav-${item.to}`}
                    >
                      {item.label}
                    </NavLink>
                  );
                }
                return (
                  <span
                    key={item.to}
                    aria-disabled="true"
                    className="cursor-not-allowed rounded px-3 py-1.5 text-sm text-gray-400"
                    title={
                      item.missingPermission
                        ? `缺少 ${item.missingPermission} 权限`
                        : '当前角色不可见'
                    }
                    data-testid={`nav-${item.to}`}
                    data-disabled="true"
                  >
                    {item.label}
                  </span>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <DevActorSwitcher />
            <span
              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
              data-testid="current-actor"
            >
              {actor.actorId} · {actor.roleIds.join(', ')}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                clearActor();
                pushToast('info', '已退出登录');
              }}
            >
              退出
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
