/**
 * Asset category card.
 *
 * Renders authorized / discovered / live / new counters and the top services
 * exposed in scope.
 */
import type { DashboardAssetMetrics } from '@/shared/contracts/dashboard-summary.contract';

import { DashboardCard } from '../DashboardCard';

export interface AssetMetricsCardProps {
  metrics: DashboardAssetMetrics;
}

export function AssetMetricsCard({ metrics }: AssetMetricsCardProps) {
  return (
    <DashboardCard
      title="资产态势"
      summary={metrics.summary}
      detailHref="/asset-scope"
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-gray-500">授权资产组</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.authorizedAssetGroupCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">发现资产</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.discoveredAssetCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">存活资产</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.liveAssetCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">今日新增</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.newlyDiscoveredAssetCount}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-gray-500">暴露端口</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.exposedPortCount}</dd>
        </div>
      </dl>
      {metrics.topServices.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-500">Top 服务</p>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
            {metrics.topServices.slice(0, 5).map((entry) => (
              <li key={entry.service} className="flex justify-between">
                <span>{entry.service}</span>
                <span className="tabular-nums text-gray-900">{entry.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </DashboardCard>
  );
}
