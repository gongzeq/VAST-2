/**
 * Task category card.
 *
 * Renders today/running counts, by-state distribution as StatusBadge chips,
 * average duration, and a 7-day trend sparkline.
 */
import { StatusBadge } from '@/shared/components';
import type { DashboardTaskMetrics } from '@/shared/contracts/dashboard-summary.contract';

import { DashboardCard } from '../DashboardCard';
import { Sparkline } from '../Sparkline';

export interface TaskMetricsCardProps {
  metrics: DashboardTaskMetrics;
}

function formatDurationSeconds(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest === 0 ? `${minutes}min` : `${minutes}min ${rest}s`;
}

export function TaskMetricsCard({ metrics }: TaskMetricsCardProps) {
  return (
    <DashboardCard
      title="任务态势"
      summary={metrics.summary}
      detailHref="/tasks"
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-gray-500">今日任务</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.todayTaskCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">运行中</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.runningTaskCount}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-gray-500">平均耗时</dt>
          <dd className="text-base font-semibold text-gray-900">
            {formatDurationSeconds(metrics.averageDurationSeconds)}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-1">
        {metrics.byState.map((entry) => (
          <StatusBadge key={entry.state} status={{ kind: 'task-state', value: entry.state }}>
            <span className="ml-1 tabular-nums">{entry.count}</span>
          </StatusBadge>
        ))}
      </div>
      <div className="mt-3">
        <Sparkline
          values={metrics.trend7Days.map((b) => b.value)}
          ariaLabel={`近 7 日任务数趋势：${metrics.trend7Days.map((b) => b.value).join('、')}`}
        />
      </div>
    </DashboardCard>
  );
}
