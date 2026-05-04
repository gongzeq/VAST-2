import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes } from 'react-router-dom';

import { AssetScopePage } from '@/features/asset-scope/routes/asset-scope-page';
import { DiscoveredAssetsPage } from '@/features/asset-scope/routes/discovered-assets-page';

import { renderWithProviders, fixtureActor } from '../test-utils';
import { db } from '@/app/msw/db';

function AppShell() {
  return (
    <>
      <nav>
        <Link to="/asset-scope" data-testid="nav-asset-scope">
          asset-scope
        </Link>
        <Link to="/asset-scope/discovered" data-testid="nav-discovered">
          discovered
        </Link>
      </nav>
      <Routes>
        <Route path="/asset-scope" element={<AssetScopePage />} />
        <Route path="/asset-scope/discovered" element={<DiscoveredAssetsPage />} />
      </Routes>
    </>
  );
}

describe('integration: discovered-asset confirm updates asset-scope list', () => {
  it('confirming a pending asset adds a new whitelist entry visible in /asset-scope', async () => {
    const user = userEvent.setup();
    // Pre-establish session in the MSW db so the handler authorizes the action.
    // The React-side ActorContext is set independently via `initialActor`.
    db().actor = fixtureActor.admin();

    renderWithProviders(<AppShell />, {
      initialActor: fixtureActor.admin(),
      initialEntries: ['/asset-scope/discovered'],
    });

    const confirmBtn = await screen.findByTestId('confirm-da_pending_1');
    await user.click(confirmBtn);

    // Database is updated by the MSW handler.
    await waitFor(() => {
      const ag = db().assetGroups.get('ag_corp_public');
      expect(
        ag?.whitelistEntries.some(
          (e) => e.kind === 'root_domain' && e.rootDomain === 'api.example.com',
        ),
      ).toBe(true);
    });

    // Navigate to /asset-scope and verify the UI shows the new entry.
    await user.click(screen.getByTestId('nav-asset-scope'));

    await waitFor(() => {
      const card = screen.getByTestId('asset-group-ag_corp_public');
      expect(card.textContent).toMatch(/api\.example\.com/);
    });
  });
});
