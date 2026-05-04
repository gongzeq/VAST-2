import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { AssetScopePage } from '@/features/asset-scope/routes/asset-scope-page';

import { renderWithProviders, fixtureActor } from '../test-utils';

describe('permission-gated buttons hide for viewer', () => {
  it('admin sees the "新增白名单条目" button', async () => {
    renderWithProviders(<AssetScopePage />, {
      initialActor: fixtureActor.admin(),
    });
    await waitFor(() => {
      expect(screen.getByTestId('add-whitelist-ag_corp_internal')).toBeInTheDocument();
    });
  });

  it('viewer does NOT see the "新增白名单条目" button and is shown an UnauthorizedState', async () => {
    renderWithProviders(<AssetScopePage />, {
      initialActor: fixtureActor.viewer(),
    });
    await waitFor(() => {
      expect(screen.getByTestId('asset-group-ag_corp_internal')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('add-whitelist-ag_corp_internal')).toBeNull();
    const unauthorized = screen.getByTestId('unauthorized-state');
    expect(unauthorized.textContent).toMatch(/asset_scope:manage/);
  });

  it('auditor also lacks asset_scope:manage and the button is hidden', async () => {
    renderWithProviders(<AssetScopePage />, {
      initialActor: fixtureActor.auditor(),
    });
    await waitFor(() => {
      expect(screen.getByTestId('asset-group-ag_corp_internal')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('add-whitelist-ag_corp_internal')).toBeNull();
  });
});
