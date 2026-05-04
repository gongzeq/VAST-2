import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { DiscoveredAssetRecord } from '@/shared/contracts';
import { DiscoveredAssetRow } from '@/features/asset-scope/components/discovered-asset-row';

function row(status: DiscoveredAssetRecord['status']): DiscoveredAssetRecord {
  return {
    discoveredAssetId: `da_${status}`,
    assetGroupId: 'ag1',
    sourceTarget: 'a.com',
    target: { kind: 'domain', value: 'b.a.com' },
    status,
    probe: null,
    discoveredAt: '2025-01-01T00:00:00.000Z',
  };
}

describe('<DiscoveredAssetRow>', () => {
  it('disables confirm/reject for OUT_OF_SCOPE_DISCOVERED with explanatory note', () => {
    render(
      <table>
        <tbody>
          <DiscoveredAssetRow
            asset={row('OUT_OF_SCOPE_DISCOVERED')}
            canManage
            onConfirm={() => undefined}
            onReject={() => undefined}
          />
        </tbody>
      </table>,
    );
    expect(screen.getByTestId('confirm-da_OUT_OF_SCOPE_DISCOVERED')).toBeDisabled();
    expect(screen.getByTestId('reject-da_OUT_OF_SCOPE_DISCOVERED')).toBeDisabled();
    expect(screen.getByTestId('out-of-scope-note-da_OUT_OF_SCOPE_DISCOVERED').textContent).toMatch(
      /超出授权根域/,
    );
  });

  it('enables confirm for DISCOVERED_PENDING_CONFIRMATION when canManage=true', () => {
    const onConfirm = vi.fn();
    render(
      <table>
        <tbody>
          <DiscoveredAssetRow
            asset={row('DISCOVERED_PENDING_CONFIRMATION')}
            canManage
            onConfirm={onConfirm}
            onReject={() => undefined}
          />
        </tbody>
      </table>,
    );
    const btn = screen.getByTestId('confirm-da_DISCOVERED_PENDING_CONFIRMATION');
    expect(btn).not.toBeDisabled();
    btn.click();
    expect(onConfirm).toHaveBeenCalledWith('da_DISCOVERED_PENDING_CONFIRMATION');
  });

  it('disables confirm when canManage=false', () => {
    render(
      <table>
        <tbody>
          <DiscoveredAssetRow
            asset={row('DISCOVERED_PENDING_CONFIRMATION')}
            canManage={false}
            onConfirm={() => undefined}
            onReject={() => undefined}
          />
        </tbody>
      </table>,
    );
    expect(screen.getByTestId('confirm-da_DISCOVERED_PENDING_CONFIRMATION')).toBeDisabled();
  });
});
