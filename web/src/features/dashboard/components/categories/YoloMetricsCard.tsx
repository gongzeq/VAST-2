/**
 * YOLO / NL-agent category card.
 */
import type { DashboardYoloMetrics } from '@/shared/contracts/dashboard-summary.contract';

import { DashboardCard } from '../DashboardCard';

export interface YoloMetricsCardProps {
  metrics: DashboardYoloMetrics;
}

export function YoloMetricsCard({ metrics }: YoloMetricsCardProps) {
  return (
    <DashboardCard
      title="YOLO·智能体态势"
      summary={metrics.summary}
      detailHref="/tasks"
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-gray-500">自然语言任务</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.naturalLanguageTaskCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">YOLO 直接执行</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.yoloDirectExecutionCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">澄清次数</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.clarificationCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">白名单阻断</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.whitelistBlockedCount}</dd>
        </div>
      </dl>
    </DashboardCard>
  );
}
