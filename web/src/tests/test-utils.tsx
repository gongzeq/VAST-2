import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderOptions } from '@testing-library/react';

import { AppProviders } from '@/app/providers/app-providers';
import type { ActorContext } from '@/shared/contracts/actor-context.contract';

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  initialActor?: ActorContext | null;
  initialEntries?: string[];
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
) {
  const { initialActor = null, initialEntries = ['/'], ...rtlOptions } = options;
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders initialActor={initialActor} noRetry>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </AppProviders>
  );
  return render(ui, { wrapper: Wrapper, ...rtlOptions });
}

export const fixtureActor = {
  securityEngineer: (): ActorContext => ({
    actorId: 'actor_alice',
    roleIds: ['security-engineer'],
    permissionPoints: [
      'task:create',
      'task:confirm',
      'task:cancel',
      'task:yolo_execute',
    ],
    assetGroupIds: ['ag_corp_internal', 'ag_corp_public'],
    yoloEnabled: false,
  }),
  admin: (): ActorContext => ({
    actorId: 'actor_root',
    roleIds: ['admin'],
    permissionPoints: ['asset_scope:manage', 'audit_log:view', 'log_source:manage'],
    assetGroupIds: ['ag_corp_internal', 'ag_corp_public'],
    yoloEnabled: false,
  }),
  auditor: (): ActorContext => ({
    actorId: 'actor_audit',
    roleIds: ['auditor'],
    permissionPoints: ['audit_log:view'],
    assetGroupIds: ['ag_corp_internal'],
    yoloEnabled: false,
  }),
  viewer: (): ActorContext => ({
    actorId: 'actor_view',
    roleIds: ['viewer'],
    permissionPoints: [],
    assetGroupIds: [],
    yoloEnabled: false,
  }),
};
