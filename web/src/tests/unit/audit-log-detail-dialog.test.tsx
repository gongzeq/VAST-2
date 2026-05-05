/**
 * PR3 audit-log detail dialog rendering tests.
 *
 * Cleartext password / raw log body fields are stored as zod literals; the
 * dialog must surface them with explicit Chinese labels rather than rendering
 * the literal string verbatim.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AuditLogDetailDialog } from '@/features/audit/components';
import type { AuditLogEntry } from '@/shared/contracts/audit-log.contract';

function buildEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    auditLogEntryId: 'a1',
    occurredAt: '2026-05-04T08:00:00.000Z',
    actorId: 'actor_alice',
    roleIds: ['security-engineer'],
    action: 'weak_password.view',
    targetKind: 'task',
    targetId: 'task_demo',
    outcome: 'SUCCESS',
    requestPayload: { source: 'console' },
    validationResult: null,
    affectedResources: [{ kind: 'task', id: 'task_demo' }],
    clearTextPassword: null,
    rawLogBody: null,
    note: null,
    ...overrides,
  };
}

describe('AuditLogDetailDialog', () => {
  it('renders cleartextPassword as 已脱敏 marker, never the literal value', () => {
    render(
      <AuditLogDetailDialog
        entry={buildEntry({ clearTextPassword: '[redacted]' })}
        onClose={() => {}}
      />,
    );
    const node = screen.getByTestId('audit-detail-cleartext-password');
    expect(node.textContent).toContain('[已脱敏]');
    // Never the contract literal:
    expect(node.textContent).not.toContain('[redacted]');
  });

  it('renders rawLogBody as 原文不可用 marker', () => {
    render(
      <AuditLogDetailDialog
        entry={buildEntry({ rawLogBody: 'unavailable' })}
        onClose={() => {}}
      />,
    );
    const node = screen.getByTestId('audit-detail-raw-log-body');
    expect(node.textContent).toContain('[原文不可用]');
    expect(node.textContent).not.toContain('unavailable');
  });

  it('renders 不涉及 when sensitive fields are null', () => {
    render(
      <AuditLogDetailDialog entry={buildEntry()} onClose={() => {}} />,
    );
    expect(
      screen.getByTestId('audit-detail-cleartext-password').textContent,
    ).toContain('（不涉及）');
    expect(
      screen.getByTestId('audit-detail-raw-log-body').textContent,
    ).toContain('（不涉及）');
  });

  it('renders requestPayload entries', () => {
    render(
      <AuditLogDetailDialog
        entry={buildEntry({ requestPayload: { foo: 'bar', count: 3 } })}
        onClose={() => {}}
      />,
    );
    const content = screen.getByTestId('audit-detail-content');
    expect(content.textContent).toContain('foo');
    expect(content.textContent).toContain('bar');
    expect(content.textContent).toContain('count');
    expect(content.textContent).toContain('3');
  });
});
