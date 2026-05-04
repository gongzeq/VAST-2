import { describe, expect, it } from 'vitest';

import {
  parseTaskListFilter,
  serializeTaskListFilter,
} from '@/features/task-list/state/task-list-filter.contract';
import {
  parseDiscoveredAssetFilter,
  serializeDiscoveredAssetFilter,
} from '@/features/asset-scope/state/discovered-asset-filter.contract';

describe('task-list URL state parser', () => {
  it('falls back to defaults when params are missing', () => {
    const filter = parseTaskListFilter(new URLSearchParams());
    expect(filter.page).toBe(1);
    expect(filter.pageSize).toBe(20);
    expect(filter.workflowType).toBeUndefined();
    expect(filter.lifecycleStage).toBeUndefined();
  });

  it('parses well-formed query string', () => {
    const filter = parseTaskListFilter(
      new URLSearchParams('workflowType=ASSET_DISCOVERY&lifecycleStage=RUNNING&page=3&pageSize=50&sort=updatedAt:asc'),
    );
    expect(filter.workflowType).toBe('ASSET_DISCOVERY');
    expect(filter.lifecycleStage).toBe('RUNNING');
    expect(filter.page).toBe(3);
    expect(filter.pageSize).toBe(50);
    expect(filter.sort).toEqual({ field: 'updatedAt', dir: 'asc' });
  });

  it('falls back to defaults on invalid values', () => {
    const filter = parseTaskListFilter(
      new URLSearchParams('workflowType=NOT_A_WORKFLOW&page=-3'),
    );
    expect(filter.workflowType).toBeUndefined();
    expect(filter.page).toBe(1);
  });

  it('serialize is roundtrip-stable with non-default values only', () => {
    const sp = serializeTaskListFilter({
      workflowType: 'VULNERABILITY_SCAN',
      lifecycleStage: 'RUNNING',
      page: 2,
      pageSize: 50,
      sort: { field: 'createdAt', dir: 'desc' },
    });
    const reparsed = parseTaskListFilter(sp);
    expect(reparsed.workflowType).toBe('VULNERABILITY_SCAN');
    expect(reparsed.page).toBe(2);
    expect(reparsed.sort).toEqual({ field: 'createdAt', dir: 'desc' });
  });
});

describe('discovered-asset URL state parser', () => {
  it('parses state filter', () => {
    expect(
      parseDiscoveredAssetFilter(
        new URLSearchParams('state=DISCOVERED_PENDING_CONFIRMATION'),
      ).state,
    ).toBe('DISCOVERED_PENDING_CONFIRMATION');
  });

  it('drops unknown values', () => {
    expect(
      parseDiscoveredAssetFilter(new URLSearchParams('state=INVALID')).state,
    ).toBeUndefined();
  });

  it('serialize keeps only non-empty fields', () => {
    expect(serializeDiscoveredAssetFilter({}).toString()).toBe('');
    expect(
      serializeDiscoveredAssetFilter({ state: 'OUT_OF_SCOPE_DISCOVERED' }).toString(),
    ).toBe('state=OUT_OF_SCOPE_DISCOVERED');
  });
});
