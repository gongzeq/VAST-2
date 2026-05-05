/**
 * PR3 audit-log integration test.
 *
 * Verifies:
 * - auditor fixture sees the table populated with seeded entries
 * - non-audit_log:view actor (security-engineer) sees UnauthorizedState
 * - applying an action filter narrows the visible rows
 * - clicking a row opens the detail dialog with masked sensitive fields
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuditLogPage } from '@/features/audit';
import { db } from '@/app/msw/db';
import { fixtureActor, renderWithProviders } from '@/tests/test-utils';

describe('audit log surface', () => {
  it('auditor: loads + filters + opens detail dialog', async () => {
    db().actor = fixtureActor.auditor();
    const user = userEvent.setup();
    renderWithProviders(<AuditLogPage />, {
      initialActor: fixtureActor.auditor(),
      initialEntries: ['/audit'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('audit-log-table')).toBeInTheDocument();
    });

    const tableBeforeFilter = screen.getByTestId('audit-log-table');
    const initialRowCount = within(tableBeforeFilter).getAllByRole('row').length;
    expect(initialRowCount).toBeGreaterThan(2);

    // Filter by action — kill_switch.operate (seeded twice).
    const actionSelect = screen.getByTestId('audit-filter-action');
    await user.selectOptions(actionSelect, 'kill_switch.operate');

    await waitFor(() => {
      const tableAfter = screen.getByTestId('audit-log-table');
      const rowsAfter = within(tableAfter).getAllByRole('row');
      // header + at least 1 entry, fewer than initial.
      expect(rowsAfter.length).toBeLessThan(initialRowCount);
      expect(rowsAfter.length).toBeGreaterThanOrEqual(2);
    });

    // Open detail dialog on the first matching row.
    const detailButtons = screen.getAllByText('查看');
    await user.click(detailButtons[0]!);
    expect(screen.getByTestId('audit-detail-content')).toBeInTheDocument();
  });

  it('renders UnauthorizedState (no redirect) for actor missing audit_log:view', async () => {
    renderWithProviders(<AuditLogPage />, {
      initialActor: fixtureActor.securityEngineer(),
      initialEntries: ['/audit'],
    });
    const unauthorized = screen.getByTestId('unauthorized-state');
    expect(unauthorized).toBeInTheDocument();
    expect(unauthorized.textContent).toContain('audit_log:view');
  });

  it('renders cleartext masking marker for weak_password.view entries', async () => {
    db().actor = fixtureActor.auditor();
    const user = userEvent.setup();
    renderWithProviders(<AuditLogPage />, {
      initialActor: fixtureActor.auditor(),
      initialEntries: ['/audit'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('audit-log-table')).toBeInTheDocument();
    });

    const actionSelect = screen.getByTestId('audit-filter-action');
    await user.selectOptions(actionSelect, 'weak_password.view');

    await waitFor(() => {
      const rows = within(screen.getByTestId('audit-log-table')).getAllByRole('row');
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    const detailButtons = screen.getAllByText('查看');
    await user.click(detailButtons[0]!);

    const passwordField = await screen.findByTestId('audit-detail-cleartext-password');
    expect(passwordField.textContent).toContain('[已脱敏]');
  });
});
