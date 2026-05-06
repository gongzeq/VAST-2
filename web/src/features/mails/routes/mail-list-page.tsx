import { Link, useSearchParams } from 'react-router-dom';

import { useAssetGroups } from '@/features/asset-scope/hooks/use-asset-groups';
import { ApiError, UnknownStateError } from '@/shared/api/fetch-json';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  UnauthorizedState,
} from '@/shared/components';
import {
  phishingLabels,
  type MailAnalysisRecord,
} from '@/shared/contracts/mail-analysis.contract';
import { formatDate } from '@/shared/formatting/format-date';
import { useCurrentActor } from '@/shared/hooks/use-current-actor';

import {
  formatRecipientsPreview,
  formatRiskScore,
  formatSender,
  formatSubject,
} from '../components/format-helpers';
import { useMailAnalyses } from '../hooks/use-mail-analyses';
import {
  parseMailListFilter,
  serializeMailListFilter,
  type MailListFilter,
} from '../state/mail-list-filter.contract';

function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

function PhishingCell({ record }: { record: MailAnalysisRecord }) {
  // R3 + Decision: when phishingLabel is null (UNAVAILABLE) we MUST NOT render
  // a "clean" badge — show "—" plus an explanatory analysis-mode angle badge.
  if (record.phishingLabel === null) {
    return (
      <div className="flex items-center gap-2" data-testid="mail-phishing-cell-null">
        <span className="text-gray-500">—</span>
        <StatusBadge status={{ kind: 'mail-analysis-mode', value: record.analysisMode }} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={{ kind: 'phishing-label', value: record.phishingLabel }} />
      {record.analysisMode !== 'FULL' ? (
        <StatusBadge status={{ kind: 'mail-analysis-mode', value: record.analysisMode }} />
      ) : null}
    </div>
  );
}

function RecipientsCell({ recipients }: { recipients: string[] }) {
  if (recipients.length === 0) {
    return <span className="text-gray-500">(无收件人)</span>;
  }
  const preview = formatRecipientsPreview(recipients, 3);
  return (
    <div className="space-y-0.5 text-xs text-gray-700">
      {preview.visible.map((recipient) => (
        <p key={recipient} className="font-mono">
          {recipient}
        </p>
      ))}
      {preview.more > 0 ? (
        <p className="text-gray-500" data-testid="mail-recipients-more">+{preview.more} more</p>
      ) : null}
    </div>
  );
}

export function MailListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { actor } = useCurrentActor();
  const filter = parseMailListFilter(searchParams);
  const assetGroupsQuery = useAssetGroups();
  const mailQuery = useMailAnalyses(filter);

  const visibleAssetGroups = (assetGroupsQuery.data?.items ?? []).filter((group) =>
    actor?.assetGroupIds.includes(group.assetGroupId) ?? false,
  );

  const updateFilter = (next: Partial<MailListFilter>) => {
    const merged: MailListFilter = { ...filter, ...next, page: next.page ?? 1 };
    setSearchParams(serializeMailListFilter(merged));
  };

  const renderContent = () => {
    if (mailQuery.isPending) {
      return (
        <Card>
          <CardBody className="space-y-3">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
          </CardBody>
        </Card>
      );
    }

    if (mailQuery.isError) {
      const err = mailQuery.error;
      if (err instanceof ApiError && err.errorCode === 'AUTHORIZATION_DENIED') {
        return (
          <UnauthorizedState
            missingPermission="raw_evidence:view"
            title="无权查看邮件分析记录"
            description={err.message}
          />
        );
      }
      if (err instanceof UnknownStateError) {
        return <ErrorState title="未知邮件分析数据状态" description={err.message} />;
      }
      return (
        <ErrorState
          description={err.message}
          errorCode={err instanceof ApiError ? err.errorCode : undefined}
        />
      );
    }

    if (mailQuery.data.records.length === 0) {
      return (
        <EmptyState
          title="没有匹配的邮件分析记录"
          description="可调整资产组、网关、风险标签或时间窗口筛选条件。"
        />
      );
    }

    return (
      <Card>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">风险标签</th>
                <th className="px-3 py-2 text-left">主题</th>
                <th className="px-3 py-2 text-left">发件人</th>
                <th className="px-3 py-2 text-left">收件人</th>
                <th className="px-3 py-2 text-left">风险分</th>
                <th className="px-3 py-2 text-left">接收时间</th>
                <th className="px-3 py-2 text-left">网关</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100" data-testid="mail-table-body">
              {mailQuery.data.records.map((record) => (
                <tr key={record.mailTaskId} data-testid={`mail-row-${record.mailTaskId}`}>
                  <td className="px-3 py-2">
                    <PhishingCell record={record} />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      className="font-medium text-blue-700 hover:underline"
                      to={`/mails/${encodeURIComponent(record.mailTaskId)}`}
                    >
                      {formatSubject(record.subject)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">
                    {formatSender(record.from)}
                  </td>
                  <td className="px-3 py-2">
                    <RecipientsCell recipients={record.recipients} />
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">
                    {formatRiskScore(record.riskScore)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {formatDate(record.receivedAt)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">
                    {record.gatewayId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    );
  };

  const data = mailQuery.data;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">钓鱼邮件分析</h1>
          <p className="mt-1 text-sm text-gray-600">
            跨网关聚合的邮件分析记录，按 receivedAt 倒序展示。
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            资产组
            <Select
              data-testid="mail-filter-asset-group"
              value={filter.assetGroupId ?? ''}
              onChange={(event) => updateFilter({ assetGroupId: event.target.value || undefined })}
            >
              <option value="">全部可见资产组</option>
              {visibleAssetGroups.map((group) => (
                <option key={group.assetGroupId} value={group.assetGroupId}>
                  {group.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            网关
            <Input
              data-testid="mail-filter-gateway"
              value={filter.gatewayId ?? ''}
              placeholder="如 mgw_corp_primary"
              onChange={(event) => updateFilter({ gatewayId: event.target.value.trim() || undefined })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            风险标签
            <Select
              data-testid="mail-filter-phishing-label"
              value={filter.phishingLabel ?? ''}
              onChange={(event) =>
                updateFilter({
                  phishingLabel: event.target.value
                    ? (event.target.value as MailListFilter['phishingLabel'])
                    : undefined,
                })
              }
            >
              <option value="">全部</option>
              {phishingLabels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            自
            <Input
              data-testid="mail-filter-since"
              type="datetime-local"
              value={filter.since ? toLocalInput(filter.since) : ''}
              onChange={(event) => updateFilter({ since: fromLocalInput(event.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            至
            <Input
              data-testid="mail-filter-until"
              type="datetime-local"
              value={filter.until ? toLocalInput(filter.until) : ''}
              onChange={(event) => updateFilter({ until: fromLocalInput(event.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            排序
            <Select
              data-testid="mail-filter-sort"
              value={`${filter.sort.field}:${filter.sort.dir}`}
              onChange={(event) => {
                const [field = 'receivedAt', dir = 'desc'] = event.target.value.split(':');
                updateFilter({
                  sort: {
                    field: field as MailListFilter['sort']['field'],
                    dir: dir as MailListFilter['sort']['dir'],
                  },
                });
              }}
            >
              <option value="receivedAt:desc">接收时间（新→旧）</option>
              <option value="receivedAt:asc">接收时间（旧→新）</option>
              <option value="riskScore:desc">风险分（高→低）</option>
              <option value="riskScore:asc">风险分（低→高）</option>
              <option value="messageSizeBytes:desc">大小（大→小）</option>
              <option value="messageSizeBytes:asc">大小（小→大）</option>
            </Select>
          </label>
        </CardBody>
      </Card>

      {renderContent()}

      {data ? (
        <div className="flex items-center justify-between text-sm text-gray-700">
          <span>
            第 {data.page} 页，共 {pageCount(data.total, data.pageSize)} 页（{data.total} 封）
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={filter.page <= 1}
              data-testid="mail-pager-prev"
              onClick={() => updateFilter({ page: Math.max(1, filter.page - 1) })}
            >
              上一页
            </Button>
            <Button
              variant="secondary"
              size="sm"
              data-testid="mail-pager-next"
              disabled={filter.page >= pageCount(data.total, data.pageSize)}
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

function toLocalInput(iso: string): string {
  // datetime-local expects "YYYY-MM-DDTHH:mm" without timezone.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
