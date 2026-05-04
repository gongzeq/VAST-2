import type { ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';

import { Button } from '@/shared/components/Button';
import { useCurrentActor } from '@/shared/hooks/use-current-actor';
import { useToast } from '@/shared/hooks/use-toast';

import { DevActorSwitcher } from '@/features/auth/components/dev-actor-switcher';

export interface AuthenticatedLayoutProps {
  /** When provided overrides <Outlet/>, used by tests rendering specific subtrees. */
  children?: ReactNode;
}

const NAV_ITEMS = [
  { to: '/', label: '任务控制台', exact: true },
  { to: '/tasks', label: '任务列表' },
  { to: '/asset-scope', label: '资产范围' },
  { to: '/asset-scope/discovered', label: '待确认资产' },
];

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { actor, clearActor } = useCurrentActor();
  const { pushToast } = useToast();

  if (!actor) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-base font-semibold text-gray-900">
              智能网络安全分析平台
            </Link>
            <nav className="flex items-center gap-1" aria-label="primary">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) =>
                    `rounded px-3 py-1.5 text-sm ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
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
