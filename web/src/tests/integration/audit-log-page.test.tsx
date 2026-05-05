/**
 * Integration tests for the audit log page.
 *
 * Covers permission gating (UnauthorizedState rather than redirect), happy
 * path table render against the MSW seed, action-filter URL refetch,
 * masked-sensitive-fields detail dialog, and the unknown-state fallback when
 * MSW returns a contract-violating payload.
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { AuditLogPage } from '@/features/audit';
import { db } from '@/app/msw/db';
import { server } from '@/app/msw/server';

import { renderWithProviders, fixtureActor } from '../test-utils';

describe('integration: audit log page', () => {
  it('renders <UnauthorizedState> with audit_log:view when actor lacks permission', () => {
    db().actor = fixtureActor.viewer();
    renderWithProviders(<AuditLogPage />, {
      initialActor: fixtureActor.viewer(),
      initialEntries: ['/audit'],
    });

    const unauthorized = screen.getByTestId('unauthorized-state');
    expect(unauthorized).toBeInTheDocument();
    expect(unauthorized.textContent).toContain('audit_log:view');
    expect(screen.queryByTestId('audit-log-table')).toBeNull();
  });

  it('loads and renders the audit table with at least one seeded row for an auditor', async () => {
    db().actor = fixtureActor.auditor();
    renderWithProviders(<AuditLogPage />, {
      initialActor: fixtureActor.auditor(),
      initialEntries: ['/audit'],
    });

    const table = await screen.findByTestId('audit-log-table');
    expect(table).toBeInTheDocument();
    // The seed has 25 entries; audit_001 is the most recent (offset=-60s).
    expect(screen.getByTestId('audit-row-audit_001')).toBeInTheDocument();
  });

  it('selecting an action filter refetches and narrows the table to that action', async () => {
    db().actor = fixtureActor.auditor();
    const user = userEvent.setup();
    renderWithProviders(<AuditLogPage />, {
      initialActor: fixtureActor.auditor(),
      initialEntries: ['/audit'],
    });

    await screen.findByTestId('audit-log-table');
    // Pre-condition: audit_002 (task.execute) is present alongside audit_001
    // (task.create) before any filter is applied.
    expect(screen.getByTestId('audit-row-audit_001')).toBeInTheDocument();
    expect(screen.getByTestId('audit-row-audit_002')).toBeInTheDocument();

    const select = screen.getByTestId('audit-filter-action') as HTMLSelectElement;
    await user.selectOptions(select, 'task.create');

    // After applying the filter, audit_001 stays (task.create) and
    // audit_002 disappears (task.execute). This proves both the URL state
    // changed and the hook refetched with the new filter.
    await waitFor(() => {
      expect(screen.getByTestId('audit-row-audit_001')).toBeInTheDocument();
      expect(screen.queryByTestId('audit-row-audit_002')).toBeNull();
    });
  });

  it('clicking a row opens the detail dialog with masked sensitive fields', async () => {
    db().actor = fixtureActor.auditor();
    const user = userEvent.setup();
    renderWithProviders(<AuditLogPage />, {
      initialActor: fixtureActor.auditor(),
      initialEntries: ['/audit'],
    });

    await screen.findByTestId('audit-log-table');
    // audit_011 is the canonical mask demo: clearTextPassword is the literal
    // '[redacted]', rawLogBody is null (does not apply).
    const detailButton = screen.getByTestId('audit-row-detail-audit_011');
    await user.click(detailButton);

    const detailContent = await screen.findByTestId('audit-detail-content');
    expect(detailContent).toBeInTheDocument();

    const cleartextCell = screen.getByTestId('audit-detail-cleartext-password');
    expect(cleartextCell.textContent).toBe('[已脱敏]');

    const rawLogCell = screen.getByTestId('audit-detail-raw-log-body');
    expect(rawLogCell.textContent).toBe('（不涉及）');
  });

  it('renders unknown-state ErrorState when MSW returns a contract-violating payload', async () => {
    db().actor = fixtureActor.auditor();
    server.use(
      http.get('/api/audit-log', () =>
        HttpResponse.json({ totally: 'wrong', no: 'entries' }),
      ),
    );
    renderWithProviders(<AuditLogPage />, {
      initialActor: fixtureActor.auditor(),
      initialEntries: ['/audit'],
    });

    await waitFor(() => {
      expect(screen.getByText('未知数据状态')).toBeInTheDocument();
    });
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    expect(screen.queryByTestId('audit-log-table')).toBeNull();
  });
});
