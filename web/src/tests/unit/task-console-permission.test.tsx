import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { TaskConsolePage } from '@/features/task-console/routes/task-console-page';

import { renderWithProviders, fixtureActor } from '../test-utils';

describe('task-console — permission gating', () => {
  it('shows UnauthorizedState and disables submit for viewer (no task:create)', () => {
    renderWithProviders(<TaskConsolePage />, {
      initialActor: fixtureActor.viewer(),
    });
    expect(screen.getByTestId('unauthorized-state').textContent).toMatch(/task:create/);
    const submit = screen.getByTestId('prompt-submit');
    expect(submit).toBeDisabled();
    expect(screen.getByTestId('prompt-disabled-reason').textContent).toMatch(/task:create/);
  });

  it('does not show UnauthorizedState for security-engineer', () => {
    renderWithProviders(<TaskConsolePage />, {
      initialActor: fixtureActor.securityEngineer(),
    });
    expect(screen.queryByTestId('unauthorized-state')).toBeNull();
  });
});
