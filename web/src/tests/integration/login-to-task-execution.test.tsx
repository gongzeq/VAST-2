import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import { TaskConsolePage } from '@/features/task-console/routes/task-console-page';
import { TaskDetailPage } from '@/features/task-detail/routes/task-detail-page';

import { renderWithProviders, fixtureActor } from '../test-utils';

function App() {
  return (
    <Routes>
      <Route path="/" element={<TaskConsolePage />} />
      <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
    </Routes>
  );
}

describe('integration: prompt → clarification → preview → confirm → task-detail', () => {
  it('completes the full happy path for security-engineer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, {
      initialActor: fixtureActor.securityEngineer(),
      initialEntries: ['/'],
    });

    // 1. submit a clarification-triggering prompt
    const promptInput = await screen.findByTestId('prompt-input');
    await user.type(promptInput, '弱口令扫描');
    await user.click(screen.getByTestId('prompt-submit'));

    // 2. clarification list appears
    const clarificationList = await screen.findByTestId('clarification-list');
    expect(clarificationList).toBeInTheDocument();

    // 3. answer the first clarification
    const inputs = clarificationList.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThan(0);
    const firstInput = inputs[0]!;
    await user.type(firstInput, 'ag_corp_internal');
    const submitButtons = clarificationList.querySelectorAll('button');
    await user.click(submitButtons[0]!);

    // 4. plan preview should appear
    await waitFor(() => {
      expect(screen.getByTestId('plan-preview-card')).toBeInTheDocument();
    });

    // 5. trigger execute
    await user.click(screen.getByTestId('task-execute-button'));

    // 6. confirmation dialog appears (the planning step path may not include
    //    confirmation depending on intensity; the LOW intensity post-clarification
    //    plan should not require confirmation, so we tolerate either path).
    if (screen.queryByTestId('confirmation-dialog')) {
      await user.click(screen.getByTestId('confirmation-confirm'));
    }

    // 7. should navigate to task-detail
    await waitFor(() => {
      // The task-detail page renders a header showing the task id; just check
      // for one of the view-state containers.
      const detail = screen.queryByTestId(/^task-detail-/);
      expect(detail).not.toBeNull();
    }, { timeout: 5000 });
  });
});
