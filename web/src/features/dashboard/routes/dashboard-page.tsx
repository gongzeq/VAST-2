import { useSearchParams } from 'react-router-dom';

import {
  ApiError,
  UnknownStateError,
} from '@/shared/api/fetch-json';
import {
  Card,
  CardBody,
  ErrorState,
  Skeleton,
  UnauthorizedState,
} from '@/shared/components';
import {
  dashboardCategoryKinds,
  type DashboardCategoryKind,
} from '@/shared/contracts/dashboard-summary.contract';
import { formatDate } from '@/shared/formatting/format-date';

import { AssetGroupFilter } from '../components/AssetGroupFilter';
import { DashboardCategoryDispatcher } from '../components/categories/DashboardCategoryDispatcher';
import { useDashboardSummary } from '../hooks/use-dashboard-summary';
import {
  parseDashboardFilter,
  serializeDashboardFilter,
  type DashboardFilter,
} from '../state/dashboard-filter.contract';

const KIND_ORDER: DashboardCategoryKind[] = [...dashboardCategoryKinds];

function orderCategories<T extends { kind: DashboardCategoryKind }>(categories: T[]): T[] {
  const byKind = new Map(categories.map((c) => [c.kind, c]));
  return KIND_ORDER.map((kind) => byKind.get(kind)).filter((c): c is T => c !== undefined);
}

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseDashboardFilter(searchParams);
  const summaryQuery = useDashboardSummary(filter);

  const updateFilter = (next: DashboardFilter) => {
    setSearchParams(serializeDashboardFilter(next));
  };

  const renderContent = () => {
    if (summaryQuery.isPending) {
      return (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="dashboard-loading"
        >
          {KIND_ORDER.map((kind) => (
            <Card key={kind}>
              <CardBody className="space-y-3">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardBody>
            </Card>
          ))}
        </div>
      );
    }

    if (summaryQuery.isError) {
      const err = summaryQuery.error;
      if (err instanceof ApiError && err.errorCode === 'AUTHORIZATION_DENIED') {
        return (
          <UnauthorizedState
            missingPermission="asset_scope:manage"
            title="无权查看全局视图"
            description={err.message}
          />
        );
      }
      if (err instanceof UnknownStateError) {
        return (
          <ErrorState
            title="未知仪表盘数据状态"
            description="服务返回的字段与前端契约不一致，请联系后端核对。"
          />
        );
      }
      return (
        <ErrorState
          description={err.message}
          errorCode={err instanceof ApiError ? err.errorCode : undefined}
        />
      );
    }

    const categories = orderCategories(summaryQuery.data.categories);
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="dashboard-grid"
      >
        {categories.map((category) => (
          <DashboardCategoryDispatcher key={category.kind} category={category} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-gray-900">仪表盘</h1>
        <p className="text-sm text-gray-600">
          7 类指标聚合视图（任务 / 资产 / 漏洞 / 弱口令 / 钓鱼邮件 / YOLO·智能体 / 日志攻击），默认每 60 秒自动刷新；标签页隐藏时暂停。
        </p>
        {summaryQuery.data ? (
          <p className="text-xs text-gray-500" data-testid="dashboard-generated-at">
            最近更新：{formatDate(summaryQuery.data.generatedAt)}
            {summaryQuery.isFetching ? '（刷新中…）' : ''}
          </p>
        ) : null}
      </header>
      <AssetGroupFilter value={filter} onChange={updateFilter} />
      {renderContent()}
    </div>
  );
}
