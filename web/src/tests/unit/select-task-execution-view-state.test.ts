import { describe, expect, it } from 'vitest';

import {
  selectTaskExecutionViewState,
  type TaskRecord,
} from '@/shared/contracts';

function baseTask(): TaskRecord {
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

describe('selectTaskExecutionViewState', () => {
  it('returns null for CREATED with no signals', () => {
    expect(selectTaskExecutionViewState(baseTask())).toBeNull();
  });

  it('returns needs_clarification when stage AWAITING_CLARIFICATION', () => {
    const task: TaskRecord = {
      ...baseTask(),
      lifecycleStage: 'AWAITING_CLARIFICATION',
      state: 'NEEDS_CLARIFICATION',
      clarifications: [
        {
          clarificationId: 'cl1',
          question: 'q?',
          answer: null,
          createdAt: '2025-01-01T00:00:00.000Z',
          answeredAt: null,
        },
      ],
    };
    const v = selectTaskExecutionViewState(task);
    expect(v?.kind).toBe('needs_clarification');
  });

  it('returns blocked for state=BLOCKED with reason from failed step', () => {
    const task: TaskRecord = {
      ...baseTask(),
      lifecycleStage: 'FINISHED',
      state: 'BLOCKED',
      steps: [
        {
          stepId: 's1',
          stepType: 'authorization',
          description: 'unauthorized target',
          targetRefs: [],
          dependsOnStepIds: [],
          requiresConfirmation: false,
          executionStatus: 'FAILED',
        },
      ],
    };
    const v = selectTaskExecutionViewState(task);
    expect(v?.kind).toBe('blocked');
    if (v?.kind === 'blocked') expect(v.reason).toMatch(/unauthorized/);
  });

  it('returns awaiting_confirmation when stage = AWAITING_CONFIRMATION', () => {
    const task: TaskRecord = {
      ...baseTask(),
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
    const v = selectTaskExecutionViewState(task);
    expect(v?.kind).toBe('awaiting_confirmation');
    if (v?.kind === 'awaiting_confirmation') {
      expect(v.intensity).toBe('HIGH');
      expect(v.plan).toHaveLength(1);
    }
  });

  it('returns running when stage = RUNNING and identifies first PENDING step', () => {
    const task: TaskRecord = {
      ...baseTask(),
      lifecycleStage: 'RUNNING',
      steps: [
        {
          stepId: 's1',
          stepType: 'nmap',
          description: 'a',
          targetRefs: [],
          dependsOnStepIds: [],
          requiresConfirmation: false,
          executionStatus: 'SUCCESS',
        },
        {
          stepId: 's2',
          stepType: 'nuclei',
          description: 'b',
          targetRefs: [],
          dependsOnStepIds: [],
          requiresConfirmation: false,
          executionStatus: 'PENDING',
        },
      ],
    };
    const v = selectTaskExecutionViewState(task);
    expect(v?.kind).toBe('running');
    if (v?.kind === 'running') expect(v.currentStepId).toBe('s2');
  });

  it('returns partial_success splitting failed and successful steps', () => {
    const task: TaskRecord = {
      ...baseTask(),
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
    const v = selectTaskExecutionViewState(task);
    expect(v?.kind).toBe('partial_success');
    if (v?.kind === 'partial_success') {
      expect(v.failedSteps.map((s) => s.stepId)).toEqual(['s2']);
      expect(v.successfulSteps.map((s) => s.stepId)).toEqual(['s1']);
    }
  });

  it('returns success for SUCCESS state', () => {
    const task: TaskRecord = {
      ...baseTask(),
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
    expect(selectTaskExecutionViewState(task)?.kind).toBe('success');
  });

  it('returns cancelled for CANCELLED state', () => {
    const task: TaskRecord = {
      ...baseTask(),
      lifecycleStage: 'FINISHED',
      state: 'CANCELLED',
    };
    const v = selectTaskExecutionViewState(task);
    expect(v?.kind).toBe('cancelled');
  });
});
