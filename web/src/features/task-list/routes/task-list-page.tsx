import { Link, useSearchParams } from 'react-router-dom';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
  StatusBadge,
} from '@/shared/components';
import { Button } from '@/shared/components/Button';
import { taskLifecycleStages } from '@/shared/contracts/task-execution.contract';
import { workflowTypes } from '@/shared/contracts/task-plan.contract';
import { formatDate } from '@/shared/formatting/format-date';

import {
  parseTaskListFilter,
  serializeTaskListFilter,
} from '../state/task-list-filter.contract';
import { useTaskList } from '../hooks/use-task-list';

export function TaskListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseTaskListFilter(searchParams);

  const query = useTaskList({
    workflowType: filter.workflowType,
    lifecycleStage: filter.lifecycleStage,
    page: filter.page,
    pageSize: filter.pageSize,
  });

  const updateFilter = (next: Partial<typeof filter>) => {
    const merged = { ...filter, ...next, page: next.page ?? 1 };
    setSearchParams(serializeTaskListFilter(merged));
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">任务列表</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            工作流类型
            <Select
              data-testid="filter-workflow"
              value={filter.workflowType ?? ''}
              onChange={(event) =>
                updateFilter({
                  workflowType: event.target.value
                    ? (event.target.value as typeof filter.workflowType)
                    : undefined,
                })
              }
            >
              <option value="">全部</option>
              {workflowTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            生命周期
            <Select
              data-testid="filter-lifecycle"
              value={filter.lifecycleStage ?? ''}
              onChange={(event) =>
                updateFilter({
                  lifecycleStage: event.target.value
                    ? (event.target.value as typeof filter.lifecycleStage)
                    : undefined,
                })
              }
            >
              <option value="">全部</option>
              {taskLifecycleStages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            排序
            <Select
              data-testid="filter-sort"
              value={
                filter.sort
                  ? `${filter.sort.field}:${filter.sort.dir}`
                  : 'createdAt:desc'
              }
              onChange={(event) => {
                const [field = '', dir = 'desc'] = event.target.value.split(':');
                updateFilter({
                  sort: {
                    field: field as 'createdAt' | 'updatedAt',
                    dir: dir as 'asc' | 'desc',
                  },
                });
              }}
            >
              <option value="createdAt:desc">创建时间（新→旧）</option>
              <option value="createdAt:asc">创建时间（旧→新）</option>
              <option value="updatedAt:desc">更新时间（新→旧）</option>
              <option value="updatedAt:asc">更新时间（旧→新）</option>
            </Select>
          </label>
        </CardBody>
      </Card>

      {query.isPending ? (
        <Card>
          <CardBody className="space-y-3">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
          </CardBody>
        </Card>
      ) : query.isError ? (
        <ErrorState description={query.error.message} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          title="没有匹配的任务"
          description="可以调整上方筛选条件，或回到任务控制台创建新任务。"
        />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">任务 ID</th>
                  <th className="px-3 py-2 text-left">工作流</th>
                  <th className="px-3 py-2 text-left">强度</th>
                  <th className="px-3 py-2 text-left">生命周期</th>
                  <th className="px-3 py-2 text-left">状态</th>
                  <th className="px-3 py-2 text-left">YOLO</th>
                  <th className="px-3 py-2 text-left">创建时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100" data-testid="task-table-body">
                {query.data.items.map((task) => (
                  <tr key={task.taskId} data-testid={`task-row-${task.taskId}`}>
                    <td className="px-3 py-2">
                      <Link
                        className="text-blue-700 hover:underline"
                        to={`/tasks/${encodeURIComponent(task.taskId)}`}
                      >
                        {task.taskId}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{task.workflowType}</td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        status={{ kind: 'intensity', value: task.requestedIntensity }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        status={{ kind: 'task-lifecycle', value: task.lifecycleStage }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {task.state ? (
                        <StatusBadge status={{ kind: 'task-state', value: task.state }} />
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {task.yoloRequested ? (
                        <StatusBadge status={{ kind: 'yolo' }} />
                      ) : (
                        <span className="text-xs text-gray-500">否</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {formatDate(task.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {query.data ? (
        <div className="flex items-center justify-between text-sm text-gray-700">
          <span>
            第 {query.data.page} 页，共 {Math.max(1, Math.ceil(query.data.total / query.data.pageSize))} 页（{query.data.total} 条）
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={filter.page <= 1}
              data-testid="pager-prev"
              onClick={() => updateFilter({ page: Math.max(1, filter.page - 1) })}
            >
              上一页
            </Button>
            <Button
              variant="secondary"
              size="sm"
              data-testid="pager-next"
              disabled={filter.page * filter.pageSize >= query.data.total}
              onClick={() => updateFilter({ page: filter.page + 1 })}
            >
              下一页
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
