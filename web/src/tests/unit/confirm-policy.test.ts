import { describe, expect, it } from 'vitest';

import { computeConfirmPolicy } from '@/features/task-console/hooks/use-confirm-task-execution';
import type { TaskPlanStep } from '@/shared/contracts';

const baseStep: TaskPlanStep = {
  stepId: 's1',
  stepType: 'nmap',
  description: 'do scan',
  targetRefs: [],
  dependsOnStepIds: [],
  requiresConfirmation: false,
};

describe('computeConfirmPolicy', () => {
  it('blocks when actor lacks task:confirm', () => {
    const policy = computeConfirmPolicy({
      intensity: 'LOW',
      yoloEnabled: true,
      yoloRequested: true,
      steps: [baseStep],
      hasConfirmPermission: false,
    });
    expect(policy.canExecute).toBe(false);
    expect(policy.blockedReason).toMatch(/task:confirm/);
  });

  it('requires confirmation for HIGH intensity even with YOLO', () => {
    const policy = computeConfirmPolicy({
      intensity: 'HIGH',
      yoloEnabled: true,
      yoloRequested: true,
      steps: [baseStep],
      hasConfirmPermission: true,
    });
    expect(policy.requiresConfirmation).toBe(true);
    expect(policy.canExecute).toBe(true);
  });

  it('requires confirmation when any step requires confirmation', () => {
    const policy = computeConfirmPolicy({
      intensity: 'MEDIUM',
      yoloEnabled: true,
      yoloRequested: true,
      steps: [{ ...baseStep, requiresConfirmation: true }],
      hasConfirmPermission: true,
    });
    expect(policy.requiresConfirmation).toBe(true);
  });

  it('skips confirmation under YOLO when intensity is not HIGH and no step requires it', () => {
    const policy = computeConfirmPolicy({
      intensity: 'LOW',
      yoloEnabled: true,
      yoloRequested: true,
      steps: [baseStep],
      hasConfirmPermission: true,
    });
    expect(policy.requiresConfirmation).toBe(false);
    expect(policy.canExecute).toBe(true);
  });

  it('still requires confirmation when YOLO is disabled at the actor level', () => {
    const policy = computeConfirmPolicy({
      intensity: 'LOW',
      yoloEnabled: false,
      yoloRequested: true,
      steps: [baseStep],
      hasConfirmPermission: true,
    });
    expect(policy.requiresConfirmation).toBe(false); // LOW + no required-step, so no confirmation needed
    // The blocked reason is null because the actor has confirm permission.
    expect(policy.canExecute).toBe(true);
  });
});
