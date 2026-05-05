/**
 * Weak-password category card.
 *
 * Renders aggregate counts only — never any password sample. PRD §7.5 / §11
 * forbid the dashboard from carrying cleartext or per-asset password data;
 * the contract itself omits those fields, but the card still renders an
 * explicit footnote so operators understand the masking rule.
 */
import type { DashboardWeakPasswordMetrics } from '@/shared/contracts/dashboard-summary.contract';

import { DashboardCard } from '../DashboardCard';
import { Sparkline } from '../Sparkline';

export interface WeakPasswordMetricsCardProps {
  metrics: DashboardWeakPasswordMetrics;
}

export function WeakPasswordMetricsCard({ metrics }: WeakPasswordMetricsCardProps) {
  return (
    <DashboardCard
      title="弱口令态势"
      summary={metrics.summary}
      detailHref="/weak-password"
    >
      <dl className="grid grid-cols-1 gap-y-2 text-xs">
        <div>
          <dt className="text-gray-500">弱口令资产数</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.weakPasswordAssetCount}</dd>
        </div>
      </dl>
      {metrics.byServiceType.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-500">服务类型分布</p>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
            {metrics.byServiceType.slice(0, 5).map((entry) => (
              <li key={entry.serviceType} className="flex justify-between">
                <span>{entry.serviceType}</span>
                <span className="tabular-nums text-gray-900">{entry.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-3">
        <p className="text-xs font-medium text-gray-500">30 日弱口令资产趋势</p>
        <Sparkline
          values={metrics.trend30Days.map((b) => b.value)}
          ariaLabel={`30 日弱口令资产趋势：${metrics.trend30Days.map((b) => b.value).join('、')}`}
        />
      </div>
      <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
        明文密码不在大屏展示；如需查看，请前往弱口令明细页并具备相应权限。
      </p>
    </DashboardCard>
  );
}
