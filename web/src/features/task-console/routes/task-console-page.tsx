import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmationDialog,
  ErrorState,
  StatusBadge,
  UnauthorizedState,
} from '@/shared/components';
import {
  useCanCreateTask,
  useCanConfirmTask,
  useCanYoloExecute,
} from '@/shared/hooks/use-can';
import { useToast } from '@/shared/hooks/use-toast';
import {
  intensityVocabulary,
  taskLifecycleVocabulary,
} from '@/shared/formatting/state-vocabulary';
import type {
  TaskClarification,
  TaskIntentResponse,
  TaskPlanStep,
} from '@/shared/contracts';

import {
  ClarificationList,
  PromptForm,
  TaskPlanPreviewCard,
  YoloToggle,
} from '../components';
import { useTaskIntentPreview } from '../hooks/use-task-intent-preview';
import { useSubmitClarificationAnswer } from '../hooks/use-submit-clarification-answer';
import {
  computeConfirmPolicy,
  useConfirmTaskExecution,
} from '../hooks/use-confirm-task-execution';

interface PreviewState {
  taskId: string;
  lifecycleStage: TaskIntentResponse['lifecycleStage'];
  plan: TaskIntentResponse['plan'] | undefined;
  clarifications: TaskClarification[];
}

export function TaskConsolePage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const canCreateTask = useCanCreateTask();
  const canConfirmTask = useCanConfirmTask();
  const canYoloExecute = useCanYoloExecute();

  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [yoloRequested, setYoloRequested] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const intentMutation = useTaskIntentPreview();
  const clarificationMutation = useSubmitClarificationAnswer();
  const confirmMutation = useConfirmTaskExecution();

  // Sync preview when clarification answers come back.
  useEffect(() => {
    if (!clarificationMutation.data) return;
    const updated = clarificationMutation.data;
    const planSteps: TaskPlanStep[] = updated.steps.map((s) => ({
      stepId: s.stepId,
      stepType: s.stepType,
      description: s.description,
      targetRefs: s.targetRefs,
      dependsOnStepIds: s.dependsOnStepIds,
      requiresConfirmation: s.requiresConfirmation,
    }));
    setPreview({
      taskId: updated.taskId,
      lifecycleStage: updated.lifecycleStage,
      plan:
        updated.steps.length > 0
          ? {
              workflowType: updated.workflowType,
              requestedIntensity: updated.requestedIntensity,
              steps: planSteps,
            }
          : undefined,
      clarifications: updated.clarifications,
    });
  }, [clarificationMutation.data]);

  if (!canCreateTask) {
    return (
      <div className="space-y-3">
        <header>
          <h1 className="text-xl font-semibold text-gray-900">任务控制台</h1>
        </header>
        <UnauthorizedState
          missingPermission="task:create"
          description="当前角色无法创建新任务。请使用具有 task:create 权限的角色登录。"
        />
        <PromptForm
          onSubmit={() => undefined}
          disabled
          disabledReason="无 task:create 权限"
        />
      </div>
    );
  }

  const handlePromptSubmit = (prompt: string) => {
    intentMutation.mutate(
      { prompt },
      {
        onSuccess: (data) => {
          setPreview({
            taskId: data.taskId,
            lifecycleStage: data.lifecycleStage,
            plan: data.plan,
            clarifications: data.clarifications ?? [],
          });
        },
        onError: (err) => {
          pushToast('error', err.message);
        },
      },
    );
  };

  const intensity = preview?.plan?.requestedIntensity ?? 'LOW';
  const planSteps = preview?.plan?.steps ?? [];
  const policy = computeConfirmPolicy({
    intensity,
    yoloEnabled: canYoloExecute,
    yoloRequested,
    steps: planSteps,
    hasConfirmPermission: canConfirmTask,
  });

  const handleExecute = () => {
    if (!preview) return;
    if (policy.requiresConfirmation) {
      setConfirmOpen(true);
      return;
    }
    fireConfirm(false);
  };

  const fireConfirm = (highRiskConfirmed: boolean) => {
    if (!preview) return;
    confirmMutation.mutate(
      {
        taskId: preview.taskId,
        highRiskConfirmed,
        yoloRequested,
        note: null,
      },
      {
        onSuccess: () => {
          pushToast('success', '已提交执行');
          navigate(`/tasks/${encodeURIComponent(preview.taskId)}`);
        },
        onError: (err) => pushToast('error', err.message),
      },
    );
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">任务控制台</h1>
        <p className="text-sm text-gray-600">输入自然语言描述安全任务，系统将解析意图、提出澄清或预览计划。</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>意图输入</CardTitle>
        </CardHeader>
        <CardBody>
          <PromptForm
            onSubmit={handlePromptSubmit}
            pending={intentMutation.isPending}
          />
          {intentMutation.isError ? (
            <div className="mt-3">
              <ErrorState description={intentMutation.error.message} />
            </div>
          ) : null}
        </CardBody>
      </Card>

      {preview && preview.clarifications.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>澄清问题</CardTitle>
            <StatusBadge
              status={{ kind: 'task-lifecycle', value: 'AWAITING_CLARIFICATION' }}
            />
          </CardHeader>
          <CardBody>
            <ClarificationList
              questions={preview.clarifications}
              onAnswer={(cid, answer) =>
                clarificationMutation.mutate({
                  taskId: preview.taskId,
                  clarificationId: cid,
                  answer,
                })
              }
              pending={clarificationMutation.isPending}
            />
            <p
              className="mt-3 text-xs text-gray-500"
              data-testid="clarification-policy-note"
            >
              所有澄清问题需先回答完毕，系统才会切换到「{taskLifecycleVocabulary.AWAITING_CONFIRMATION.label}」并显示计划预览。
            </p>
          </CardBody>
        </Card>
      ) : null}

      {preview?.plan ? (
        <>
          <TaskPlanPreviewCard
            workflowType={preview.plan.workflowType}
            intensity={preview.plan.requestedIntensity}
            steps={preview.plan.steps}
            yoloRequested={yoloRequested}
          />
          <Card>
            <CardHeader>
              <CardTitle>执行控制</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <YoloToggle
                value={yoloRequested}
                onChange={setYoloRequested}
                disabled={!canYoloExecute}
                disabledReason={
                  canYoloExecute ? undefined : '当前角色无 task:yolo_execute 权限'
                }
              />
              <p className="text-sm text-gray-700">
                {policy.requiresConfirmation
                  ? `当前计划需要二次确认（强度 ${intensityVocabulary[intensity].label}）。`
                  : '当前计划无需二次确认（YOLO 通道）。'}
              </p>
              <Button
                onClick={handleExecute}
                disabled={!policy.canExecute || confirmMutation.isPending}
                data-testid="task-execute-button"
              >
                {policy.requiresConfirmation ? '预览并确认执行' : '直接执行'}
              </Button>
              {!policy.canExecute && policy.blockedReason ? (
                <p
                  className="text-sm text-red-700"
                  data-testid="execute-blocked-reason"
                >
                  {policy.blockedReason}
                </p>
              ) : null}
            </CardBody>
          </Card>
          <ConfirmationDialog
            open={confirmOpen}
            actionDescription={`执行工作流 ${preview.plan.workflowType}`}
            targetScope={`任务 ${preview.taskId}（共 ${planSteps.length} 步）`}
            riskLevelText={`强度 ${intensityVocabulary[intensity].label}（${intensity}）${
              yoloRequested ? '· 已请求 YOLO' : ''
            }`}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmOpen(false);
              fireConfirm(intensity === 'HIGH');
            }}
          />
        </>
      ) : null}
    </div>
  );
}
