import { Navigate, useParams } from 'react-router-dom';

import { Card, CardBody, ErrorState, Skeleton } from '@/shared/components';
import { useCanCancelTask, useCanConfirmTask } from '@/shared/hooks/use-can';
import { useToast } from '@/shared/hooks/use-toast';
import { ApiError } from '@/shared/api/fetch-json';

import { useTaskDetail } from '../hooks/use-task-detail';
import { useCancelTask } from '../hooks/use-cancel-task';
import { useSubmitClarificationAnswer } from '@/features/task-console/hooks/use-submit-clarification-answer';
import { useConfirmTaskExecution } from '@/features/task-console/hooks/use-confirm-task-execution';

import { TaskDetailView } from '../components/task-detail-view';

export function TaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const { pushToast } = useToast();
  const canCancel = useCanCancelTask();
  const canConfirm = useCanConfirmTask();

  const taskId = params.taskId ?? '';
  const taskQuery = useTaskDetail(taskId, { enabled: taskId.length > 0 });
  const cancelMutation = useCancelTask();
  const confirmMutation = useConfirmTaskExecution();
  const clarificationMutation = useSubmitClarificationAnswer();

  if (!params.taskId) {
    return <Navigate to="/tasks" replace />;
  }

  if (taskQuery.isPending) {
    return (
      <Card>
        <CardBody className="space-y-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </CardBody>
      </Card>
    );
  }

  if (taskQuery.isError) {
    const err = taskQuery.error;
    if (err instanceof ApiError && err.errorCode === 'AUTHORIZATION_DENIED') {
      return (
        <ErrorState
          title="无权查看该任务"
          description={err.message}
          errorCode={err.errorCode}
        />
      );
    }
    return (
      <ErrorState
        description={taskQuery.error.message}
        errorCode={
          taskQuery.error instanceof ApiError ? taskQuery.error.errorCode : undefined
        }
      />
    );
  }

  const task = taskQuery.data;

  return (
    <TaskDetailView
      task={task}
      canCancel={canCancel}
      onCancel={() =>
        cancelMutation.mutate(
          { taskId: task.taskId },
          {
            onSuccess: () => pushToast('info', '任务已取消'),
            onError: (err) => pushToast('error', err.message),
          },
        )
      }
      canConfirm={canConfirm}
      onConfirm={(highRiskConfirmed) =>
        confirmMutation.mutate(
          {
            taskId: task.taskId,
            highRiskConfirmed,
            yoloRequested: task.yoloRequested,
            note: null,
          },
          {
            onSuccess: () => pushToast('success', '已确认执行'),
            onError: (err) => pushToast('error', err.message),
          },
        )
      }
      onAnswerClarification={(cid, answer) =>
        clarificationMutation.mutate(
          { taskId: task.taskId, clarificationId: cid, answer },
          {
            onSuccess: () => pushToast('success', '已提交澄清答案'),
            onError: (err) => pushToast('error', err.message),
          },
        )
      }
      pendingClarification={clarificationMutation.isPending}
    />
  );
}
