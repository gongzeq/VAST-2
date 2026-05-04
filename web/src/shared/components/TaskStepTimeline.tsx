import type { TaskStepResult } from '@/shared/contracts/task-execution.contract';

import { StatusBadge } from './StatusBadge';

export interface TaskStepTimelineProps {
  steps: TaskStepResult[];
  /** Optional id of step currently executing (for RUNNING view). */
  currentStepId?: string | null;
}

export function TaskStepTimeline({ steps, currentStepId }: TaskStepTimelineProps) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-gray-500" data-testid="timeline-empty">
        暂无步骤。
      </p>
    );
  }

  return (
    <ol className="space-y-3" data-testid="task-step-timeline">
      {steps.map((step, index) => {
        const isCurrent = step.stepId === currentStepId;
        const isFailed = step.executionStatus === 'FAILED';
        return (
          <li
            key={step.stepId}
            data-testid={`timeline-step-${step.stepId}`}
            data-failed={isFailed ? 'true' : 'false'}
            className={`flex gap-3 rounded border p-3 ${
              isFailed
                ? 'border-red-200 bg-red-50'
                : isCurrent
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex-shrink-0 text-sm font-mono text-gray-500">
              {String(index + 1).padStart(2, '0')}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {step.stepType}
                </span>
                <StatusBadge
                  status={{ kind: 'step-status', value: step.executionStatus }}
                />
                {step.requiresConfirmation ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    需要确认
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-gray-700">{step.description}</p>
              {step.targetRefs.length > 0 ? (
                <p className="mt-1 text-xs text-gray-500">
                  目标：{step.targetRefs.join(', ')}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
