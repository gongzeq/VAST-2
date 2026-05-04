/**
 * Renders the seven discriminated TaskExecutionViewState variants. Tests load
 * this component directly with crafted records so each branch has a smoke
 * test. The page wires it up with useTaskDetail.
 */
import { Button, Card, CardBody, CardHeader, CardTitle, ConfirmationDialog, StatusBadge, TaskStepTimeline } from '@/shared/components';
import { selectTaskExecutionViewState, type TaskRecord } from '@/shared/contracts';
import { intensityVocabulary } from '@/shared/formatting/state-vocabulary';
import { useState } from 'react';

import { ClarificationList } from '@/features/task-console/components/clarification-list';

export interface TaskDetailViewProps {
  task: TaskRecord;
  /** Hook into actions; null = action not allowed in this context. */
  onCancel?: () => void;
  canCancel?: boolean;
  onConfirm?: (highRiskConfirmed: boolean) => void;
  canConfirm?: boolean;
  onAnswerClarification?: (clarificationId: string, answer: string) => void;
  pendingClarification?: boolean;
}

export function TaskDetailView({
  task,
  onCancel,
  canCancel,
  onConfirm,
  canConfirm,
  onAnswerClarification,
  pendingClarification,
}: TaskDetailViewProps) {
  const view = selectTaskExecutionViewState(task);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="space-y-4" data-testid={`task-detail-${task.taskId}`}>
      <Card>
        <CardHeader>
          <CardTitle>任务 {task.taskId}</CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge status={{ kind: 'task-lifecycle', value: task.lifecycleStage }} />
            {task.state ? (
              <StatusBadge status={{ kind: 'task-state', value: task.state }} />
            ) : null}
            <StatusBadge status={{ kind: 'intensity', value: task.requestedIntensity }} />
            {task.yoloRequested ? <StatusBadge status={{ kind: 'yolo' }} /> : null}
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">工作流</p>
              <p className="font-medium">{task.workflowType}</p>
            </div>
            <div>
              <p className="text-gray-500">资产组</p>
              <p className="font-medium">{task.assetGroupId ?? '—'}</p>
            </div>
          </div>
          {canCancel && task.lifecycleStage !== 'FINISHED' && onCancel ? (
            <div className="mt-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={onCancel}
                data-testid="task-cancel-button"
              >
                Kill Switch · 取消任务
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {!view ? (
        <Card data-testid="view-state-fallback">
          <CardBody>
            <p className="text-sm text-gray-500">任务尚无可呈现的视图状态。</p>
          </CardBody>
        </Card>
      ) : null}

      {view?.kind === 'needs_clarification' ? (
        <Card data-testid="view-state-needs_clarification">
          <CardHeader>
            <CardTitle>等待澄清</CardTitle>
          </CardHeader>
          <CardBody>
            <ClarificationList
              questions={view.questions}
              onAnswer={(cid, answer) =>
                onAnswerClarification?.(cid, answer)
              }
              pending={pendingClarification}
            />
          </CardBody>
        </Card>
      ) : null}

      {view?.kind === 'blocked' ? (
        <Card data-testid="view-state-blocked">
          <CardHeader>
            <CardTitle>任务被阻断</CardTitle>
            <StatusBadge status={{ kind: 'task-state', value: 'BLOCKED' }} />
          </CardHeader>
          <CardBody>
            <p className="text-sm text-red-700">{view.reason}</p>
          </CardBody>
        </Card>
      ) : null}

      {view?.kind === 'awaiting_confirmation' ? (
        <Card data-testid="view-state-awaiting_confirmation">
          <CardHeader>
            <CardTitle>等待确认</CardTitle>
            <StatusBadge status={{ kind: 'intensity', value: view.intensity }} />
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-gray-700">
              该任务需要操作者确认才能进入执行。
              {view.intensity === 'HIGH' ? '当前强度为 HIGH，必须显式确认。' : ''}
            </p>
            <TaskStepTimeline steps={view.plan} />
            {canConfirm && onConfirm ? (
              <Button
                onClick={() => setConfirmOpen(true)}
                data-testid="confirm-task-button"
              >
                预览并确认执行
              </Button>
            ) : null}
            <ConfirmationDialog
              open={confirmOpen}
              actionDescription={`执行工作流 ${task.workflowType}`}
              targetScope={`任务 ${task.taskId}`}
              riskLevelText={`强度 ${intensityVocabulary[view.intensity].label}（${view.intensity}）`}
              onCancel={() => setConfirmOpen(false)}
              onConfirm={() => {
                setConfirmOpen(false);
                onConfirm?.(view.intensity === 'HIGH');
              }}
            />
          </CardBody>
        </Card>
      ) : null}

      {view?.kind === 'running' ? (
        <Card data-testid="view-state-running">
          <CardHeader>
            <CardTitle>正在执行</CardTitle>
            <StatusBadge status={{ kind: 'task-lifecycle', value: 'RUNNING' }} />
          </CardHeader>
          <CardBody>
            <p className="mb-3 text-sm text-gray-700">
              当前步骤：{view.currentStepId ?? '尚未开始'}
            </p>
            <TaskStepTimeline steps={view.steps} currentStepId={view.currentStepId} />
          </CardBody>
        </Card>
      ) : null}

      {view?.kind === 'partial_success' ? (
        <Card data-testid="view-state-partial_success">
          <CardHeader>
            <CardTitle>部分成功</CardTitle>
            <StatusBadge status={{ kind: 'task-state', value: 'PARTIAL_SUCCESS' }} />
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-gray-700">
              {view.successfulSteps.length} 步成功，{view.failedSteps.length} 步失败。失败步骤已标红，其余按原顺序展示。
            </p>
            <TaskStepTimeline
              steps={[...view.successfulSteps, ...view.failedSteps].sort((a, b) =>
                a.stepId.localeCompare(b.stepId),
              )}
            />
          </CardBody>
        </Card>
      ) : null}

      {view?.kind === 'success' ? (
        <Card data-testid="view-state-success">
          <CardHeader>
            <CardTitle>执行成功</CardTitle>
            <StatusBadge status={{ kind: 'task-state', value: 'SUCCESS' }} />
          </CardHeader>
          <CardBody>
            <TaskStepTimeline steps={view.steps} />
          </CardBody>
        </Card>
      ) : null}

      {view?.kind === 'cancelled' ? (
        <Card data-testid="view-state-cancelled">
          <CardHeader>
            <CardTitle>已取消</CardTitle>
            <StatusBadge status={{ kind: 'task-state', value: 'CANCELLED' }} />
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-700">
              取消时间：{view.cancelledAt}
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
