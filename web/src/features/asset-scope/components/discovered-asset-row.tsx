import { Button, StatusBadge } from '@/shared/components';
import type { DiscoveredAssetRecord } from '@/shared/contracts';
import { assetDiscoveryVocabulary } from '@/shared/formatting/state-vocabulary';
import { formatDate } from '@/shared/formatting/format-date';

export interface DiscoveredAssetRowProps {
  asset: DiscoveredAssetRecord;
  /** Whether the actor has the required permission for confirm/reject. */
  canManage: boolean;
  onConfirm: (assetId: string) => void;
  onReject: (assetId: string) => void;
  pending?: boolean;
}

export function DiscoveredAssetRow({
  asset,
  canManage,
  onConfirm,
  onReject,
  pending,
}: DiscoveredAssetRowProps) {
  const isOutOfScope = asset.status === 'OUT_OF_SCOPE_DISCOVERED';
  const isPending = asset.status === 'DISCOVERED_PENDING_CONFIRMATION';

  return (
    <tr data-testid={`discovered-row-${asset.discoveredAssetId}`}>
      <td className="px-3 py-2 font-mono text-xs">{asset.discoveredAssetId}</td>
      <td className="px-3 py-2">
        <StatusBadge status={{ kind: 'asset-discovery', value: asset.status }} />
      </td>
      <td className="px-3 py-2">
        <span className="font-mono text-xs text-gray-700">{asset.target.kind}</span>{' '}
        {asset.target.value}
      </td>
      <td className="px-3 py-2 text-xs text-gray-600">
        {asset.probe ? (
          <>
            HTTP {asset.probe.statusCode ?? '—'} · {asset.probe.title ?? '—'}
          </>
        ) : (
          <span className="text-gray-400">未探测</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-gray-600">{formatDate(asset.discoveredAt)}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={!canManage || isOutOfScope || !isPending || pending}
            onClick={() => onConfirm(asset.discoveredAssetId)}
            data-testid={`confirm-${asset.discoveredAssetId}`}
            title={
              isOutOfScope
                ? assetDiscoveryVocabulary.OUT_OF_SCOPE_DISCOVERED.description
                : !canManage
                  ? '当前角色缺少 asset_scope:manage 权限'
                  : undefined
            }
          >
            确认
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canManage || isOutOfScope || !isPending || pending}
            onClick={() => onReject(asset.discoveredAssetId)}
            data-testid={`reject-${asset.discoveredAssetId}`}
          >
            拒绝
          </Button>
        </div>
        {isOutOfScope ? (
          <p
            className="mt-1 text-xs text-red-700"
            data-testid={`out-of-scope-note-${asset.discoveredAssetId}`}
          >
            {assetDiscoveryVocabulary.OUT_OF_SCOPE_DISCOVERED.description}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
