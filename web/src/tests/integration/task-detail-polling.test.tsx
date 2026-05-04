import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { TaskDetailPage } from '@/features/task-detail/routes/task-detail-page';

import { renderWithProviders, fixtureActor } from '../test-utils';

function App() {
  return (
    <Routes>
      <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
    </Routes>
  );
}

describe('integration: task-detail polling', () => {
  it('polls the demo task until it reaches FINISHED state', async () => {
    renderWithProviders(<App />, {
      initialActor: fixtureActor.securityEngineer(),
      initialEntries: ['/tasks/task_running_demo'],
    });

    // Initially renders an awaiting_confirmation view based on the seeded fixture.
    await waitFor(() => {
      expect(screen.getByTestId('view-state-awaiting_confirmation')).toBeInTheDocument();
    });

    // Each polling tick advances stages. The MSW poll counter ensures we
    // converge on FINISHED/SUCCESS within five reads. We simply wait for the
    // success view to appear within a reasonable window.
    await waitFor(
      () => {
        expect(screen.getByTestId('view-state-success')).toBeInTheDocument();
      },
      { timeout: 20_000, interval: 500 },
    );
  }, 30_000);
});
