/**
 * PR4 kill switch integration tests.
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { KillSwitchPage } from '@/features/admin-settings';
import { db, resetDb } from '@/app/msw/db';
import { fixtureActor, renderWithProviders } from '@/tests/test-utils';

describe('admin / Kill Switch', () => {
  it('operator can toggle only after typing CONFIRM and confirming dialog', async () => {
    resetDb();
    db().actor = fixtureActor.killSwitchOperator();
    const initialStatus = db().killSwitch.status;
    const user = userEvent.setup();

    renderWithProviders(<KillSwitchPage />, {
      initialActor: fixtureActor.killSwitchOperator(),
      initialEntries: ['/admin/kill-switch'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('kill-switch-state')).toBeInTheDocument();
    });

    // Operator area visible.
    expect(screen.getByTestId('kill-switch-operator')).toBeInTheDocument();

    const trigger = screen.getByTestId('kill-switch-toggle-trigger') as HTMLButtonElement;
    expect(trigger).toBeDisabled();

    // Wrong token — still disabled.
    const input = screen.getByTestId('kill-switch-confirm-input');
    await user.type(input, 'confirm');
    expect(trigger).toBeDisabled();
    await user.clear(input);

    // Correct token — enables.
    await user.type(input, 'CONFIRM');
    expect(trigger).not.toBeDisabled();

    await user.click(trigger);
    await user.click(screen.getByTestId('confirmation-confirm'));

    await waitFor(() => {
      expect(db().killSwitch.status).not.toBe(initialStatus);
    });
  });

  it('non-operator sees the status card but UnauthorizedState replaces the operator area', async () => {
    resetDb();
    db().actor = fixtureActor.admin();
    // Strip kill_switch:operate from the admin fixture for this test.
    db().actor = {
      ...fixtureActor.admin(),
      permissionPoints: fixtureActor.admin().permissionPoints.filter(
        (p) => p !== 'kill_switch:operate',
      ),
    };

    renderWithProviders(<KillSwitchPage />, {
      initialActor: db().actor!,
      initialEntries: ['/admin/kill-switch'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('kill-switch-state')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('kill-switch-operator')).not.toBeInTheDocument();
    const unauthorized = screen.getByTestId('unauthorized-state');
    expect(unauthorized.textContent).toContain('kill_switch:operate');
  });
});
