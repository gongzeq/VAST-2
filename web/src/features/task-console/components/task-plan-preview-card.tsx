import type { TaskPlanStep, ExecutionIntensity, WorkflowType } from '@/shared/contracts';
import { Card, CardBody, CardHeader, CardTitle, StatusBadge } from '@/shared/components';

export interface TaskPlanPreviewCardProps {
  workflowType: WorkflowType;
  intensity: ExecutionIntensity;
  steps: TaskPlanStep[];
  yoloRequested: boolean;
}

export function TaskPlanPreviewCard({
  workflowType,
  intensity,
  steps,
  yoloRequested,
}: TaskPlanPreviewCardProps) {
  return (
    <Card data-testid="plan-preview-card">
      <CardHeader>
        <CardTitle>执行计划预览</CardTitle>
        <div className="flex items-center gap-2">
          <StatusBadge status={{ kind: 'intensity', value: intensity }} />
          {yoloRequested ? <StatusBadge status={{ kind: 'yolo' }} /> : null}
        </div>
      </CardHeader>
      <CardBody>
        <p className="mb-3 text-sm text-gray-700">
          工作流：<strong>{workflowType}</strong>，强度：<strong>{intensity}</strong>
        </p>
        <ol className="space-y-2" data-testid="plan-step-list">
          {steps.map((step, idx) => (
            <li
              key={step.stepId}
              className="flex gap-3 rounded border border-gray-200 bg-gray-50 p-2"
              data-testid={`plan-step-${step.stepId}`}
            >
              <span className="font-mono text-xs text-gray-500">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 text-sm">
                <div className="flex items-center gap-2">
                  <strong>{step.stepType}</strong>
                  {step.requiresConfirmation ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                      需要确认
                    </span>
                  ) : null}
                </div>
                <p className="text-gray-700">{step.description}</p>
                {step.targetRefs.length > 0 ? (
                  <p className="text-xs text-gray-500">
                    目标：{step.targetRefs.join(', ')}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
          {steps.length === 0 ? (
            <li className="text-sm text-gray-500" data-testid="plan-empty">
              当前无步骤。
            </li>
          ) : null}
        </ol>
      </CardBody>
    </Card>
  );
}
