/**
 * Discriminated union view state derived from a TaskRecord. UI components
 * branch exhaustively on `kind` so unhandled future variants are caught at
 * compile time.
 *
 * The seven variants are defined exactly as the PRD demands: needs_clarification
 * / blocked / awaiting_confirmation / running / partial_success / success /
 * cancelled.
 */
import type {
  TaskClarification,
  TaskRecord,
  TaskStepResult,
} from './task-execution.contract';
import type { ExecutionIntensity } from './foundation';

export type TaskExecutionViewState =
  | { kind: 'needs_clarification'; questions: TaskClarification[] }
  | { kind: 'blocked'; reason: string }
  | {
      kind: 'awaiting_confirmation';
      plan: TaskStepResult[];
      intensity: ExecutionIntensity;
      yoloRequested: boolean;
    }
  | {
      kind: 'running';
      currentStepId: string | null;
      steps: TaskStepResult[];
    }
  | {
      kind: 'partial_success';
      failedSteps: TaskStepResult[];
      successfulSteps: TaskStepResult[];
    }
  | { kind: 'success'; steps: TaskStepResult[] }
  | { kind: 'cancelled'; cancelledAt: string };

/**
 * Project a TaskRecord into the seven-variant view state.
 * Returns `null` when the task is in a stage that has no canonical UI surface
 * (e.g. just CREATED — nothing to show beyond a brief loading state).
 */
export function selectTaskExecutionViewState(
  record: TaskRecord,
): TaskExecutionViewState | null {
  // Terminal states first — these win even if lifecycleStage is FINISHED.
  if (record.state === 'CANCELLED') {
    return { kind: 'cancelled', cancelledAt: record.updatedAt };
  }

  if (record.state === 'BLOCKED') {
    const detail = record.steps.find((s) => s.executionStatus === 'FAILED');
    return {
      kind: 'blocked',
      reason: detail?.description ?? '任务被资产范围或权限策略阻断。',
    };
  }

  if (record.state === 'PARTIAL_SUCCESS') {
    return {
      kind: 'partial_success',
      failedSteps: record.steps.filter((s) => s.executionStatus === 'FAILED'),
      successfulSteps: record.steps.filter((s) => s.executionStatus === 'SUCCESS'),
    };
  }

  if (record.state === 'SUCCESS') {
    return { kind: 'success', steps: record.steps };
  }

  // Lifecycle-driven branches.
  if (record.lifecycleStage === 'AWAITING_CLARIFICATION') {
    const unanswered = record.clarifications.filter((c) => c.answeredAt === null);
    return {
      kind: 'needs_clarification',
      questions: unanswered.length > 0 ? unanswered : record.clarifications,
    };
  }

  if (record.lifecycleStage === 'AWAITING_CONFIRMATION') {
    return {
      kind: 'awaiting_confirmation',
      plan: record.steps,
      intensity: record.requestedIntensity,
      yoloRequested: record.yoloRequested,
    };
  }

  if (record.lifecycleStage === 'RUNNING') {
    const current = record.steps.find((s) => s.executionStatus === 'PENDING') ?? null;
    return {
      kind: 'running',
      currentStepId: current?.stepId ?? null,
      steps: record.steps,
    };
  }

  // Fallback: nothing to render with branch granularity (e.g. CREATED, READY).
  return null;
}
