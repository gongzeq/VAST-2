/**
 * Mail category card.
 *
 * Today / suspected counters, risk-bucket distribution, top induce-types,
 * URL domains and attachment types.
 */
import type { DashboardMailMetrics } from '@/shared/contracts/dashboard-summary.contract';

import { DashboardCard } from '../DashboardCard';

export interface MailMetricsCardProps {
  metrics: DashboardMailMetrics;
}

const RISK_BUCKET_LABEL: Record<string, string> = {
  suspected: '疑似钓鱼',
  suspicious: '可疑',
  clean: '正常',
};

export function MailMetricsCard({ metrics }: MailMetricsCardProps) {
  return (
    <DashboardCard
      title="钓鱼邮件态势"
      summary={metrics.summary}
      detailHref="/phishing-mail"
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-gray-500">今日邮件量</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.todayMailCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">疑似钓鱼</dt>
          <dd className="text-base font-semibold text-gray-900">{metrics.suspectedMailCount}</dd>
        </div>
      </dl>
      {metrics.riskBucketCounts.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-500">风险评分分布</p>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
            {metrics.riskBucketCounts.map((entry) => (
              <li key={entry.bucket} className="flex justify-between">
                <span>{RISK_BUCKET_LABEL[entry.bucket] ?? entry.bucket}</span>
                <span className="tabular-nums text-gray-900">{entry.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {metrics.topInduceTypes.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-500">Top 诱导话术</p>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
            {metrics.topInduceTypes.slice(0, 5).map((entry) => (
              <li key={entry.induceType} className="flex justify-between">
                <span>{entry.induceType}</span>
                <span className="tabular-nums text-gray-900">{entry.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics.topUrlDomains.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-500">Top URL 域名</p>
            <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
              {metrics.topUrlDomains.slice(0, 3).map((entry) => (
                <li key={entry.domain} className="flex justify-between gap-2">
                  <span className="truncate">{entry.domain}</span>
                  <span className="tabular-nums text-gray-900">{entry.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {metrics.topAttachmentTypes.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-500">Top 附件类型</p>
            <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
              {metrics.topAttachmentTypes.slice(0, 3).map((entry) => (
                <li key={entry.attachmentType} className="flex justify-between">
                  <span>{entry.attachmentType}</span>
                  <span className="tabular-nums text-gray-900">{entry.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </DashboardCard>
  );
}
