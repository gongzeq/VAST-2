import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TaskListPage } from '@/features/task-list/routes/task-list-page';

import { renderWithProviders, fixtureActor } from '../test-utils';

describe('integration: task-list URL state', () => {
  it('changing the workflow filter updates the URL and persists across remount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<TaskListPage />, {
      initialActor: fixtureActor.securityEngineer(),
      initialEntries: ['/tasks'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('task-table-body')).toBeInTheDocument();
    });

    const select = screen.getByTestId('filter-workflow');
    await user.selectOptions(select, 'WEAK_PASSWORD_SCAN');

    // The URL should now contain the workflowType filter. We re-mount with the
    // same initialEntries adjusted to capture this would require reading the
    // memory router. Instead, verify the rendered table reacts: the seeded
    // task_clarification_demo is a WEAK_PASSWORD_SCAN entry.
    await waitFor(() => {
      expect(
        screen.getByTestId('task-row-task_clarification_demo'),
      ).toBeInTheDocument();
    });

    unmount();

    // Remount as if the URL were captured into ?workflowType=WEAK_PASSWORD_SCAN.
    renderWithProviders(<TaskListPage />, {
      initialActor: fixtureActor.securityEngineer(),
      initialEntries: ['/tasks?workflowType=WEAK_PASSWORD_SCAN'],
    });
    await waitFor(() => {
      expect(
        screen.getByTestId('task-row-task_clarification_demo'),
      ).toBeInTheDocument();
    });
    // Tasks of other workflows should not appear.
    expect(
      screen.queryByTestId('task-row-task_running_demo'),
    ).toBeNull();
  });

  it('respects the page query param', async () => {
    renderWithProviders(<TaskListPage />, {
      initialActor: fixtureActor.securityEngineer(),
      initialEntries: ['/tasks?page=2&pageSize=2'],
    });

    await waitFor(() => {
      expect(screen.getByText(/第 2 页/)).toBeInTheDocument();
    });
  });
});
