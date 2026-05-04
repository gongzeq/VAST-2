import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  asTaskId,
  type TaskPlanStep,
  type TaskRecord,
  type ExecutionIntensity,
} from '@/shared/contracts';
import { taskRecordSchema } from '@/shared/contracts/task-execution.contract';

export interface ConfirmTaskInput {
  taskId: string;
  highRiskConfirmed: boolean;
  yoloRequested: boolean;
  note?: string | null;
}

export interface ConfirmExecutionPolicy {
  /**
   * True when the plan or intensity demands an explicit confirmation step.
   * Components must NOT auto-execute when this is true.
   */
  requiresConfirmation: boolean;
  /**
   * True when the actor has the necessary permissions and there is nothing
   * blocking execution.
   */
  canExecute: boolean;
  /** Human-readable reason if blocked, otherwise null. */
  blockedReason: string | null;
}

export interface ConfirmExecutionPolicyInput {
  intensity: ExecutionIntensity;
  yoloEnabled: boolean;
  yoloRequested: boolean;
  steps: TaskPlanStep[];
  hasConfirmPermission: boolean;
}

/**
 * Pure helper, exported so the policy can be unit tested without a mock fetch.
 */
export function computeConfirmPolicy(
  input: ConfirmExecutionPolicyInput,
): ConfirmExecutionPolicy {
  if (!input.hasConfirmPermission) {
    return {
      requiresConfirmation: true,
      canExecute: false,
      blockedReason: '当前角色缺少 task:confirm 权限。',
    };
  }
  const hasStepRequiringConfirmation = input.steps.some(
    (s) => s.requiresConfirmation,
  );
  const isHigh = input.intensity === 'HIGH';
  // YOLO can skip confirmation only if NOT high intensity AND no step requires it.
  if (input.yoloEnabled && input.yoloRequested && !isHigh && !hasStepRequiringConfirmation) {
    return {
      requiresConfirmation: false,
      canExecute: true,
      blockedReason: null,
    };
  }
  return {
    requiresConfirmation: isHigh || hasStepRequiringConfirmation,
    canExecute: true,
    blockedReason: null,
  };
}

export function useConfirmExecutionPolicy(input: ConfirmExecutionPolicyInput): ConfirmExecutionPolicy {
  // Destructure so the dep array references concrete primitive/array fields
  // rather than the (often new-by-identity) `input` object. The hook contract
  // requires the policy result to update with every field change so the
  // confirm button can react before the user clicks execute.
  const { intensity, yoloEnabled, yoloRequested, hasConfirmPermission, steps } = input;
  return useMemo(
    () =>
      computeConfirmPolicy({
        intensity,
        yoloEnabled,
        yoloRequested,
        hasConfirmPermission,
        steps,
      }),
    [intensity, yoloEnabled, yoloRequested, hasConfirmPermission, steps],
  );
}

export function useConfirmTaskExecution() {
  const qc = useQueryClient();
  return useMutation<TaskRecord, Error, ConfirmTaskInput>({
    mutationFn: async ({ taskId, highRiskConfirmed, yoloRequested, note }) => {
      return fetchJson(
        `/api/tasks/${encodeURIComponent(taskId)}/confirmations`,
        taskRecordSchema,
        {
          method: 'POST',
          body: {
            highRiskConfirmed,
            yoloRequested,
            note: note ?? null,
          },
        },
      );
    },
    onSuccess: (record) => {
      qc.invalidateQueries({
        queryKey: queryKeys.taskDetail(asTaskId(record.taskId)),
      });
    },
  });
}
