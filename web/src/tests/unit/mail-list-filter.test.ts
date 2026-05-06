import { describe, expect, it } from 'vitest';

import {
  parseMailListFilter,
  serializeMailListFilter,
  DEFAULT_MAIL_PAGE_SIZE,
} from '@/features/mails/state/mail-list-filter.contract';

describe('mail-list-filter URL state', () => {
  it('parses defaults from empty params', () => {
    const filter = parseMailListFilter(new URLSearchParams());
    expect(filter.assetGroupId).toBeUndefined();
    expect(filter.gatewayId).toBeUndefined();
    expect(filter.phishingLabel).toBeUndefined();
    expect(filter.since).toBeUndefined();
    expect(filter.until).toBeUndefined();
    expect(filter.sort).toEqual({ field: 'receivedAt', dir: 'desc' });
    expect(filter.page).toBe(1);
    expect(filter.pageSize).toBe(DEFAULT_MAIL_PAGE_SIZE);
  });

  it('parses the full set of filters', () => {
    const sp = new URLSearchParams({
      assetGroupId: 'ag_corp_public',
      gatewayId: 'mgw_corp_primary',
      phishingLabel: 'suspected',
      since: '2025-01-01T00:00:00.000Z',
      until: '2025-01-31T23:59:59.000Z',
      sort: 'riskScore:desc',
      page: '2',
      pageSize: '50',
    });
    const filter = parseMailListFilter(sp);
    expect(filter.assetGroupId).toBe('ag_corp_public');
    expect(filter.gatewayId).toBe('mgw_corp_primary');
    expect(filter.phishingLabel).toBe('suspected');
    expect(filter.sort).toEqual({ field: 'riskScore', dir: 'desc' });
    expect(filter.page).toBe(2);
    expect(filter.pageSize).toBe(50);
  });

  it('falls back to defaults when an enum is corrupt', () => {
    const sp = new URLSearchParams({ phishingLabel: 'definitely-not-a-label' });
    const filter = parseMailListFilter(sp);
    expect(filter.phishingLabel).toBeUndefined();
  });

  it('serialise -> parse round-trip preserves non-default fields only', () => {
    const filter = parseMailListFilter(
      new URLSearchParams({
        phishingLabel: 'suspicious',
        page: '3',
        sort: 'receivedAt:asc',
      }),
    );
    const serialised = serializeMailListFilter(filter);
    expect(serialised.get('phishingLabel')).toBe('suspicious');
    expect(serialised.get('page')).toBe('3');
    expect(serialised.get('sort')).toBe('receivedAt:asc');
    expect(serialised.get('pageSize')).toBeNull();
  });

  it('does not emit defaults for sort=receivedAt:desc / page=1 / pageSize=25', () => {
    const filter = parseMailListFilter(new URLSearchParams());
    const sp = serializeMailListFilter(filter);
    expect(Array.from(sp.keys())).toEqual([]);
  });
});
