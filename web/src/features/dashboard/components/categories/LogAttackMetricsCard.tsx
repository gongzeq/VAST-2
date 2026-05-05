/**
 * Log-attack category card.
 *
 * Renders firewall + web event counts, attack-trend sparkline, top attack
 * types / source IPs / target assets, and a spike-alert badge when the last
 * 15-minute window exceeded baseline×3 (PRD §11).
 */
import type { DashboardLogAttackMetrics } from '@/shared/contracts/dashboard-summary.contract';

import { DashboardCard } from '../DashboardCard';
import { Sparkline } from '../Sparkline';

export interface LogAttackMetricsCardProps {
  metrics: DashboardLogAttackMetrics;
}

function SpikeAlertBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
      data-testid="dashboard-log-attack-spike"
      role="status"
    >
      <span aria-hidden="true">●</span>
      <span>异常峰值</span>
    </span>
  );
}

export function LogAttackMetricsCard({ metrics }: LogAttackMetricsCardProps) {
  return (
    <DashboardCard
      title="日志攻击态势"
      summary={metrics.summary}
      detailHref="/log-analysis"
      titleAccessory={metrics.spikeAlert ? <SpikeAlertBadge /> : null}
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-gray-500">防火墙事件</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.firewallEventCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Web 事件</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.webEventCount}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <p className="text-xs font-medium text-gray-500">攻击趋势</p>
        <Sparkline
          values={metrics.attackTrend.map((b) => b.value)}
          ariaLabel={`攻击趋势：${metrics.attackTrend.map((b) => b.value).join('、')}`}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics.topAttackTypes.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-500">Top 攻击类型</p>
            <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
              {metrics.topAttackTypes.slice(0, 3).map((entry) => (
                <li key={entry.attackType} className="flex justify-between gap-2">
                  <span className="truncate">{entry.attackType}</span>
                  <span className="tabular-nums text-gray-900">{entry.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {metrics.topSourceIps.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-500">Top 来源 IP</p>
            <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
              {metrics.topSourceIps.slice(0, 3).map((entry) => (
                <li key={entry.sourceIp} className="flex justify-between gap-2">
                  <span className="truncate">{entry.sourceIp}</span>
                  <span className="tabular-nums text-gray-900">{entry.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {metrics.topTargetAssets.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-500">Top 目标资产</p>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
            {metrics.topTargetAssets.slice(0, 3).map((entry) => (
              <li key={entry.asset} className="flex justify-between gap-2">
                <span className="truncate">{entry.asset}</span>
                <span className="tabular-nums text-gray-900">{entry.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </DashboardCard>
  );
}
