import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';

import { AnonymousLayout } from '@/app/layouts/anonymous-layout';
import { AuthenticatedLayout } from '@/app/layouts/authenticated-layout';

import { LoginPage } from '@/features/auth/routes/login-page';
import { TaskConsolePage } from '@/features/task-console/routes/task-console-page';
import { TaskListPage } from '@/features/task-list/routes/task-list-page';
import { TaskDetailPage } from '@/features/task-detail/routes/task-detail-page';
import { AssetScopePage } from '@/features/asset-scope/routes/asset-scope-page';
import { DiscoveredAssetsPage } from '@/features/asset-scope/routes/discovered-assets-page';
import { VulnerabilityListPage } from '@/features/vulnerability/routes/vulnerability-list-page';
import { VulnerabilityDetailPage } from '@/features/vulnerability/routes/vulnerability-detail-page';
import { DashboardPage } from '@/features/dashboard';
import { AuditLogPage } from '@/features/audit';
import {
  KillSwitchPage,
  LlmProvidersPage,
  LogSourcesPage,
  MailSourcesPage,
  ToolConfigsPage,
} from '@/features/admin-settings';

import { useCanViewRawEvidence, useCurrentActor } from '@/shared/hooks';

function RequireActor() {
  const { actor } = useCurrentActor();
  if (!actor) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function RequireRawEvidence() {
  const canViewRawEvidence = useCanViewRawEvidence();
  if (!canViewRawEvidence) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export const routes = [
  {
    path: '/login',
    element: (
      <AnonymousLayout>
        <LoginPage />
      </AnonymousLayout>
    ),
  },
  {
    element: <RequireActor />,
    children: [
      {
        element: <AuthenticatedLayout />,
        children: [
          { index: true, element: <TaskConsolePage /> },
          { path: 'tasks', element: <TaskListPage /> },
          { path: 'tasks/:taskId', element: <TaskDetailPage /> },
          { path: 'asset-scope', element: <AssetScopePage /> },
          { path: 'asset-scope/discovered', element: <DiscoveredAssetsPage /> },
          { path: 'dashboard', element: <DashboardPage /> },
          // PRD R-C: audit + admin pages render <UnauthorizedState/> rather
          // than redirect so users see a clear "missing permission point"
          // message instead of being silently bounced.
          { path: 'audit', element: <AuditLogPage /> },
          { path: 'admin/llm-providers', element: <LlmProvidersPage /> },
          { path: 'admin/tool-configs', element: <ToolConfigsPage /> },
          { path: 'admin/log-sources', element: <LogSourcesPage /> },
          { path: 'admin/mail-sources', element: <MailSourcesPage /> },
          { path: 'admin/kill-switch', element: <KillSwitchPage /> },
          {
            element: <RequireRawEvidence />,
            children: [
              { path: 'vulnerabilities', element: <VulnerabilityListPage /> },
              { path: 'vulnerabilities/:vulnerabilityId', element: <VulnerabilityDetailPage /> },
            ],
          },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
