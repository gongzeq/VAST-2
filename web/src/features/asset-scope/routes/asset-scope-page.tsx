import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Skeleton,
  UnauthorizedState,
} from '@/shared/components';
import { useCanManageAssetScope } from '@/shared/hooks/use-can';

import { useAssetGroups } from '../hooks/use-asset-groups';
import { AddWhitelistEntryDialog } from '../components/add-whitelist-entry-dialog';
import { WhitelistEntryList } from '../components/whitelist-entry-list';

export function AssetScopePage() {
  const groupsQuery = useAssetGroups();
  const canManage = useCanManageAssetScope();
  const [addingFor, setAddingFor] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">资产范围</h1>
        <Link to="/asset-scope/discovered" className="text-sm text-blue-700 hover:underline">
          → 待确认资产队列
        </Link>
      </header>

      {!canManage ? (
        <UnauthorizedState
          missingPermission="asset_scope:manage"
          title="只读视图"
          description="可以查看资产组与已有白名单条目，但不能新增条目。"
        />
      ) : null}

      {groupsQuery.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : groupsQuery.isError ? (
        <ErrorState description={groupsQuery.error.message} />
      ) : groupsQuery.data.items.length === 0 ? (
        <EmptyState title="暂无资产组" description="平台尚未配置任何资产组。" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groupsQuery.data.items.map((group) => (
            <Card key={group.assetGroupId} data-testid={`asset-group-${group.assetGroupId}`}>
              <CardHeader>
                <div>
                  <CardTitle>{group.name}</CardTitle>
                  <p className="text-xs font-mono text-gray-500">{group.assetGroupId}</p>
                </div>
                {canManage ? (
                  <Button
                    size="sm"
                    data-testid={`add-whitelist-${group.assetGroupId}`}
                    onClick={() => setAddingFor(group.assetGroupId)}
                  >
                    新增白名单条目
                  </Button>
                ) : null}
              </CardHeader>
              <CardBody className="space-y-2">
                <p className="text-sm text-gray-700">{group.description}</p>
                <p className="text-xs text-gray-500">白名单条目（{group.whitelistEntries.length}）</p>
                <WhitelistEntryList entries={group.whitelistEntries} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {addingFor ? (
        <AddWhitelistEntryDialog
          open={addingFor !== null}
          groupId={addingFor}
          onClose={() => setAddingFor(null)}
        />
      ) : null}
    </div>
  );
}
