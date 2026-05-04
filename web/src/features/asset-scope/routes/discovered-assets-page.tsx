import { useSearchParams } from 'react-router-dom';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
  UnauthorizedState,
} from '@/shared/components';
import {
  type AssetDiscoveryState,
  assetDiscoveryStates,
} from '@/shared/contracts/foundation';
import { useCanManageAssetScope } from '@/shared/hooks/use-can';
import { useToast } from '@/shared/hooks/use-toast';

import {
  parseDiscoveredAssetFilter,
  serializeDiscoveredAssetFilter,
} from '../state/discovered-asset-filter.contract';
import { useDiscoveredAssets } from '../hooks/use-discovered-assets';
import {
  useConfirmDiscoveredAsset,
  useRejectDiscoveredAsset,
} from '../hooks/use-discovered-asset-actions';
import { DiscoveredAssetRow } from '../components/discovered-asset-row';

export function DiscoveredAssetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseDiscoveredAssetFilter(searchParams);
  const { pushToast } = useToast();

  const canManage = useCanManageAssetScope();
  const query = useDiscoveredAssets({ state: filter.state });
  const confirmMutation = useConfirmDiscoveredAsset();
  const rejectMutation = useRejectDiscoveredAsset();

  const updateFilter = (next: Partial<typeof filter>) => {
    setSearchParams(serializeDiscoveredAssetFilter({ ...filter, ...next }));
  };

  const onConfirm = (id: string) =>
    confirmMutation.mutate(
      { discoveredAssetId: id },
      {
        onSuccess: () => pushToast('success', `资产 ${id} 已确认入组`),
        onError: (err) => pushToast('error', err.message),
      },
    );

  const onReject = (id: string) =>
    rejectMutation.mutate(
      { discoveredAssetId: id },
      {
        onSuccess: () => pushToast('info', `资产 ${id} 已标记拒绝`),
        onError: (err) => pushToast('error', err.message),
      },
    );

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">待确认资产</h1>
        <p className="text-sm text-gray-600">
          子域发现 / 日志解析等工作流产生的新资产需要操作员显式确认才会进入授权范围。
        </p>
      </header>

      {!canManage ? (
        <UnauthorizedState
          missingPermission="asset_scope:manage"
          description="可以查看待确认列表，但无法 confirm / reject。"
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
        </CardHeader>
        <CardBody>
          <label className="flex flex-col gap-1 text-sm">
            状态
            <Select
              data-testid="discovered-filter-state"
              value={filter.state ?? ''}
              onChange={(event) =>
                updateFilter({
                  state: event.target.value
                    ? (event.target.value as AssetDiscoveryState)
                    : undefined,
                })
              }
            >
              <option value="">全部</option>
              {assetDiscoveryStates.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
          </label>
        </CardBody>
      </Card>

      {query.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : query.isError ? (
        <ErrorState description={query.error.message} />
      ) : query.data.items.length === 0 ? (
        <EmptyState title="队列为空" description="当前筛选下无待确认资产。" />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">资产 ID</th>
                  <th className="px-3 py-2 text-left">状态</th>
                  <th className="px-3 py-2 text-left">目标</th>
                  <th className="px-3 py-2 text-left">探测</th>
                  <th className="px-3 py-2 text-left">发现时间</th>
                  <th className="px-3 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100" data-testid="discovered-table-body">
                {query.data.items.map((asset) => (
                  <DiscoveredAssetRow
                    key={asset.discoveredAssetId}
                    asset={asset}
                    canManage={canManage}
                    onConfirm={onConfirm}
                    onReject={onReject}
                    pending={confirmMutation.isPending || rejectMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
