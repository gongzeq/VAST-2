import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import type { TaskRecord } from '@/shared/contracts';
import { TaskDetailView } from '@/features/task-detail/components/task-detail-view';

import { renderWithProviders, fixtureActor } from '../test-utils';

function buildBase(): TaskRecord {
  return {
    taskId: 't1',
    assetGroupId: null,
    workflowType: 'ASSET_DISCOVERY',
    requestedIntensity: 'LOW',
    yoloRequested: false,
    lifecycleStage: 'CREATED',
    state: null,
    targets: [],
    steps: [],
    clarifications: [],
    confirmations: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };
}

describe('TaskDetailView renders one branch per discriminated kind', () => {
  it('renders needs_clarification view', () => {
    const task: TaskRecord = {
      ...buildBase(),
      lifecycleStage: 'AWAITING_CLARIFICATION',
      state: 'NEEDS_CLARIFICATION',
      clarifications: [
        {
          clarificationId: 'cl1',
          question: '指定资产组？',
          answer: null,
          createdAt: '2025-01-01T00:00:00.000Z',
          answeredAt: null,
        },
      ],
    };
    renderWithProviders(<TaskDetailView task={task} />, {
      initialActor: fixtureActor.securityEngineer(),
    });
    expect(screen.getByTestId('view-state-needs_clarification')).toBeInTheDocument();
    expect(screen.getByText('指定资产组？')).toBeInTheDocument();
  });

  it('renders blocked view with reason', () => {
    const task: TaskRecord = {
      ...buildBase(),
      lifecycleStage: 'FINISHED',
      state: 'BLOCKED',
      steps: [
        {
          stepId: 's1',
          stepType: 'authorization',
          description: '目标超出授权范围',
          targetRefs: [],
          dependsOnStepIds: [],
          requiresConfirmation: false,
          executionStatus: 'FAILED',
        },
      ],
    };
    renderWithProviders(<TaskDetailView task={task} />, {
      initialActor: fixtureActor.securityEngineer(),
    });
    expect(screen.getByTestId('view-state-blocked')).toBeInTheDocument();
    expect(screen.getByText('目标超出授权范围')).toBeInTheDocument();
  });

  it('renders awaiting_confirmation view with HIGH intensity', () => {
    const task: TaskRecord = {
      ...buildBase(),
      lifecycleStage: 'AWAITING_CONFIRMATION',
      requestedIntensity: 'HIGH',
      steps: [
        {
          stepId: 's1',
          stepType: 'nmap',
          description: 'do scan',
          targetRefs: [],
          dependsOnStepIds: [],
          requiresConfirmation: true,
          executionStatus: 'PENDING',
        },
      ],
    };
    renderWithProviders(<TaskDetailView task={task} canConfirm onConfirm={() => undefined} />, {
      initialActor: fixtureActor.securityEngineer(),
    });
    expect(screen.getByTestId('view-state-awaiting_confirmation')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-task-button')).toBeInTheDocument();
  });

  it('renders running view and surfaces current step id', () => {
    const task: TaskRecord = {
      ...buildBase(),
      lifecycleStage: 'RUNNING',
      steps: [
        {
          stepId: 's1',
          stepType: 'a',
          description: 'a',
          targetRefs: [],
          dependsOnStepIds: [],
          requiresConfirmation: false,
          executionStatus: 'SUCCESS',
        },
        {
          stepId: 's2',
          stepType: 'b',
          description: 'b',
          targetRefs: [],
          dependsOnStepIds: [],
          requiresConfirmation: false,
          executionStatus: 'PENDING',
        },
      ],
    };
    renderWithProviders(<TaskDetailView task={task} />, {
      initialActor: fixtureActor.securityEngineer(),
    });
    expect(screen.getByTestId('view-state-running')).toBeInTheDocument();
    expect(screen.getByText(/当前步骤：s2/)).toBeInTheDocument();
  });

  it('renders partial_success view with failed step highlighted', () => {
    const task: TaskRecord = {
      ...buildBase(),
      lifecycleStage: 'FINISHED',
      state: 'PARTIAL_SUCCESS',
      steps: [
        {
          stepId: 's1',
          stepType: 'a',
          description: 'a',
          targetRefs: [],
          dependsOnStepIds: [],
          requiresConfirmation: false,
          executionStatus: 'SUCCESS',
        },
        {
          stepId: 's2',
          stepType: 'b',
          description: 'b',
          targetRefs: [],
          dependsOnStepIds: [],
          requiresConfirmation: false,
          executionStatus: 'FAILED',
        },
      ],
    };
    renderWithProviders(<TaskDetailView task={task} />, {
      initialActor: fixtureActor.securityEngineer(),
    });
    expect(screen.getByTestId('view-state-partial_success')).toBeInTheDocument();
    const failed = screen.getByTestId('timeline-step-s2');
    expect(failed.getAttribute('data-failed')).toBe('true');
  });

  it('renders success view', () => {
    const task: TaskRecord = {
      ...buildBase(),
      lifecycleStage: 'FINISHED',
      state: 'SUCCESS',
      steps: [
        {
          stepId: 's1',
          stepType: 'a',
          description: 'a',
          targetRefs: [],
          dependsOnStepIds: [],
          requiresConfirmation: false,
          executionStatus: 'SUCCESS',
        },
      ],
    };
    renderWithProviders(<TaskDetailView task={task} />, {
      initialActor: fixtureActor.securityEngineer(),
    });
    expect(screen.getByTestId('view-state-success')).toBeInTheDocument();
  });

  it('renders cancelled view', () => {
    const task: TaskRecord = {
      ...buildBase(),
      lifecycleStage: 'FINISHED',
      state: 'CANCELLED',
    };
    renderWithProviders(<TaskDetailView task={task} />, {
      initialActor: fixtureActor.securityEngineer(),
    });
    expect(screen.getByTestId('view-state-cancelled')).toBeInTheDocument();
  });
});
