import { describe, expect, it } from 'vitest';

import {
  parseDashboardFilter,
  serializeDashboardFilter,
} from '@/features/dashboard/state/dashboard-filter.contract';

describe('dashboard-filter URL state', () => {
  it('defaults to scope=owned with no asset groups when no params present', () => {
    const filter = parseDashboardFilter(new URLSearchParams());
    expect(filter).toEqual({ scope: 'owned', assetGroupIds: [] });
  });

  it('parses scope=global', () => {
    const filter = parseDashboardFilter(new URLSearchParams('scope=global'));
    expect(filter.scope).toBe('global');
  });

  it('parses comma-separated assetGroupIds and sorts them for stability', () => {
    const filter = parseDashboardFilter(
      new URLSearchParams('assetGroupIds=zeta,alpha,beta'),
    );
    expect(filter.assetGroupIds).toEqual(['alpha', 'beta', 'zeta']);
  });

  it('falls back when scope is invalid', () => {
    const filter = parseDashboardFilter(
      new URLSearchParams('scope=intergalactic'),
    );
    expect(filter).toEqual({ scope: 'owned', assetGroupIds: [] });
  });

  it('serializes only non-default fields', () => {
    expect(serializeDashboardFilter({ scope: 'owned', assetGroupIds: [] }).toString()).toBe('');
    expect(
      serializeDashboardFilter({ scope: 'global', assetGroupIds: [] }).toString(),
    ).toBe('scope=global');
  });

  it('serializes assetGroupIds sorted', () => {
    const sp = serializeDashboardFilter({
      scope: 'owned',
      assetGroupIds: ['z_group', 'a_group'],
    });
    expect(sp.get('assetGroupIds')).toBe('a_group,z_group');
  });

  it('round-trips parse → serialize → parse', () => {
    const original = { scope: 'global' as const, assetGroupIds: ['ag_a', 'ag_b'] };
    const sp = serializeDashboardFilter(original);
    const reparsed = parseDashboardFilter(new URLSearchParams(sp.toString()));
    expect(reparsed).toEqual(original);
  });
});
