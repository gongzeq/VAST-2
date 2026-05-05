/**
 * URL state parser/serializer for the audit log filter contract.
 *
 * Covers:
 *  - Round-trip: serialize → parse returns the same filter.
 *  - Invalid `page`, `pageSize`, `since`, `until` fall back to the entire
 *    FALLBACK shape (page=1, pageSize=50, empty arrays, no scalars).
 *  - Unknown `actions` and `outcomes` are dropped (filtered) without crashing.
 *  - `actorIds`, `actions`, `outcomes` come back sorted lexicographically.
 *  - Serializer omits page=1 / pageSize=50 defaults.
 */
import { describe, expect, it } from 'vitest';

import {
  parseAuditLogFilter,
  serializeAuditLogFilter,
  type AuditLogFilter,
} from '@/features/audit/state/audit-log-filter.contract';

const FALLBACK: AuditLogFilter = {
  actorIds: [],
  actions: [],
  outcomes: [],
  page: 1,
  pageSize: 50,
};

describe('audit-log filter URL state', () => {
  it('round-trips a representative filter through serialize → parse', () => {
    const filter: AuditLogFilter = {
      actorIds: ['actor_alice', 'actor_root'],
      actions: ['task.create', 'task.execute'],
      outcomes: ['FAILURE', 'SUCCESS'],
      targetKind: 'task',
      targetIdQuery: 'task_running',
      since: '2026-05-01T00:00:00.000Z',
      until: '2026-05-04T00:00:00.000Z',
      page: 2,
      pageSize: 25,
    };
    const sp = serializeAuditLogFilter(filter);
    const reparsed = parseAuditLogFilter(sp);
    expect(reparsed).toEqual(filter);
  });

  it('falls back to the full FALLBACK object when page is invalid', () => {
    const filter = parseAuditLogFilter(new URLSearchParams('page=-3'));
    expect(filter).toEqual(FALLBACK);
  });

  it('falls back to the full FALLBACK object when pageSize exceeds the cap', () => {
    const filter = parseAuditLogFilter(new URLSearchParams('pageSize=500'));
    expect(filter).toEqual(FALLBACK);
  });

  it('falls back to the full FALLBACK object when since is not an ISO datetime', () => {
    const filter = parseAuditLogFilter(new URLSearchParams('since=not-a-date'));
    expect(filter).toEqual(FALLBACK);
  });

  it('falls back to the full FALLBACK object when until is not an ISO datetime', () => {
    const filter = parseAuditLogFilter(new URLSearchParams('until=2026-99-99'));
    expect(filter).toEqual(FALLBACK);
  });

  it('drops unknown actions without crashing the parse', () => {
    const filter = parseAuditLogFilter(
      new URLSearchParams('actions=invalid_action,task.create,another.bogus'),
    );
    expect(filter.actions).toEqual(['task.create']);
  });

  it('drops unknown outcomes without crashing the parse', () => {
    const filter = parseAuditLogFilter(
      new URLSearchParams('outcomes=NOT_A_REAL_OUTCOME,SUCCESS'),
    );
    expect(filter.outcomes).toEqual(['SUCCESS']);
  });

  it('returns actorIds sorted lexicographically', () => {
    const filter = parseAuditLogFilter(
      new URLSearchParams('actorIds=zeta,alpha,beta'),
    );
    expect(filter.actorIds).toEqual(['alpha', 'beta', 'zeta']);
  });

  it('returns actions sorted lexicographically', () => {
    const filter = parseAuditLogFilter(
      new URLSearchParams('actions=task.execute,task.cancel,task.create'),
    );
    expect(filter.actions).toEqual(['task.cancel', 'task.create', 'task.execute']);
  });

  it('returns outcomes sorted lexicographically', () => {
    const filter = parseAuditLogFilter(
      new URLSearchParams('outcomes=SUCCESS,BLOCKED,FAILURE'),
    );
    expect(filter.outcomes).toEqual(['BLOCKED', 'FAILURE', 'SUCCESS']);
  });

  it('serializeAuditLogFilter omits the page=1 default', () => {
    const sp = serializeAuditLogFilter({
      ...FALLBACK,
      page: 1,
    });
    expect(sp.has('page')).toBe(false);
  });

  it('serializeAuditLogFilter omits the pageSize=50 default', () => {
    const sp = serializeAuditLogFilter({
      ...FALLBACK,
      pageSize: 50,
    });
    expect(sp.has('pageSize')).toBe(false);
  });

  it('serializeAuditLogFilter emits page when non-default', () => {
    const sp = serializeAuditLogFilter({
      ...FALLBACK,
      page: 3,
    });
    expect(sp.get('page')).toBe('3');
  });

  it('serializeAuditLogFilter emits pageSize when non-default', () => {
    const sp = serializeAuditLogFilter({
      ...FALLBACK,
      pageSize: 25,
    });
    expect(sp.get('pageSize')).toBe('25');
  });

  it('serializeAuditLogFilter on the FALLBACK produces an empty query string', () => {
    expect(serializeAuditLogFilter(FALLBACK).toString()).toBe('');
  });
});
