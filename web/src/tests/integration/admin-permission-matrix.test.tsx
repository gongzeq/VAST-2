/**
 * PR5 cross-feature consistency tests for the operations surfaces.
 *
 * Goals:
 *   - 4 actor roles × 5 admin routes table-driven permission matrix.
 *   - Each combination either renders content or <UnauthorizedState/>.
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import {
  KillSwitchPage,
  LlmProvidersPage,
  LogSourcesPage,
  MailSourcesPage,
  ToolConfigsPage,
} from '@/features/admin-settings';
import { db, resetDb } from '@/app/msw/db';
import { fixtureActor, renderWithProviders } from '@/tests/test-utils';
import type { ActorContext } from '@/shared/contracts/actor-context.contract';
import type { PermissionPoint } from '@/shared/contracts/foundation';

interface MatrixEntry {
  routeLabel: string;
  Page: () => JSX.Element;
  /** Required permission point. Empty string means admin-aggregate. */
  requiredPermission: string;
}

const ROUTES: MatrixEntry[] = [
  {
    routeLabel: '/admin/llm-providers',
    Page: LlmProvidersPage,
    requiredPermission: 'llm_provider:manage',
  },
  {
    routeLabel: '/admin/tool-configs',
    Page: ToolConfigsPage,
    requiredPermission: 'tool_config:manage',
  },
  {
    routeLabel: '/admin/log-sources',
    Page: LogSourcesPage,
    requiredPermission: 'log_source:manage',
  },
  {
    routeLabel: '/admin/mail-sources',
    Page: MailSourcesPage,
    requiredPermission: 'asset_scope:manage',
  },
  {
    routeLabel: '/admin/kill-switch',
    Page: KillSwitchPage,
    requiredPermission: 'kill_switch:operate',
  },
];

interface ActorRow {
  name: string;
  build: () => ActorContext;
}

const ACTORS: ActorRow[] = [
  { name: 'admin', build: fixtureActor.admin },
  { name: 'auditor', build: fixtureActor.auditor },
  { name: 'viewer', build: fixtureActor.viewer },
  { name: 'securityEngineer', build: fixtureActor.securityEngineer },
  { name: 'killSwitchOperator', build: fixtureActor.killSwitchOperator },
];

function actorHasAdminPerms(actor: ActorContext, requiredPermission: string): boolean {
  if (requiredPermission === '') {
    return actor.permissionPoints.some((p) =>
      [
        'asset_scope:manage',
        'log_source:manage',
        'llm_provider:manage',
        'tool_config:manage',
        'kill_switch:operate',
      ].includes(p),
    );
  }
  // Mail source page checks any-of admin-class perms.
  if (requiredPermission === 'asset_scope:manage') {
    return actor.permissionPoints.some((p) =>
      [
        'asset_scope:manage',
        'log_source:manage',
        'llm_provider:manage',
        'tool_config:manage',
      ].includes(p),
    );
  }
  // Kill switch page is visible to admin-aggregate OR kill_switch:operate.
  if (requiredPermission === 'kill_switch:operate') {
    return actor.permissionPoints.some((p) =>
      [
        'asset_scope:manage',
        'log_source:manage',
        'llm_provider:manage',
        'tool_config:manage',
        'kill_switch:operate',
      ].includes(p),
    );
  }
  return actor.permissionPoints.includes(requiredPermission as PermissionPoint);
}

describe('admin permission matrix', () => {
  for (const actor of ACTORS) {
    for (const route of ROUTES) {
      it(`${actor.name} → ${route.routeLabel}`, async () => {
        resetDb();
        const ctx = actor.build();
        db().actor = ctx;
        const expectVisible = actorHasAdminPerms(ctx, route.requiredPermission);

        const { Page } = route;
        renderWithProviders(<Page />, {
          initialActor: ctx,
          initialEntries: [route.routeLabel],
        });

        if (expectVisible) {
          // Demo banner only renders when the actor passed the perm gate.
          await waitFor(() => {
            expect(screen.getByTestId('admin-demo-banner')).toBeInTheDocument();
          });
        } else {
          expect(screen.getByTestId('unauthorized-state')).toBeInTheDocument();
        }
      });
    }
  }
});
