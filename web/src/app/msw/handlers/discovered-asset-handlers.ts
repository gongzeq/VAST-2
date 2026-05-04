import { http, HttpResponse } from 'msw';

import {
  assetDiscoveryStateSchema,
  assetWhitelistEntrySchema,
  discoveredAssetListResponseSchema,
  discoveredAssetRecordSchema,
} from '@/shared/contracts';

import { db } from '../db';
import { errorResponse } from './_helpers';

export const discoveredAssetHandlers = [
  // GET /api/discovered-assets?state=...
  http.get('/api/discovered-assets', ({ request }) => {
    const url = new URL(request.url);
    const stateParam = url.searchParams.get('state');
    let items = Array.from(db().discoveredAssets.values());
    if (stateParam !== null) {
      const stateParsed = assetDiscoveryStateSchema.safeParse(stateParam);
      if (!stateParsed.success) {
        return errorResponse({
          status: 400,
          errorCode: 'SCHEMA_VALIDATION_FAILED',
          message: `Invalid state filter: ${stateParam}`,
        });
      }
      items = items.filter((a) => a.status === stateParsed.data);
    }
    return HttpResponse.json(
      discoveredAssetListResponseSchema.parse({ items }),
      { status: 200 },
    );
  }),

  // POST /api/discovered-assets/:assetId/confirm
  http.post('/api/discovered-assets/:assetId/confirm', ({ params }) => {
    const actor = db().actor;
    if (!actor || !actor.permissionPoints.includes('asset_scope:manage')) {
      return errorResponse({
        status: 403,
        errorCode: 'AUTHORIZATION_DENIED',
        message: '当前角色缺少 asset_scope:manage 权限。',
        details: { missingPermission: 'asset_scope:manage' },
      });
    }
    const assetId = String(params.assetId);
    const asset = db().discoveredAssets.get(assetId);
    if (!asset) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Discovered asset ${assetId} not found.`,
      });
    }
    if (asset.status === 'OUT_OF_SCOPE_DISCOVERED') {
      return errorResponse({
        status: 409,
        errorCode: 'ASSET_SCOPE_BLOCKED',
        message: '超出授权根域，不可纳入扫描范围。',
        taskState: 'BLOCKED',
        details: { discoveredAssetId: assetId },
      });
    }
    // Append a whitelist entry to the matching asset group.
    const group = db().assetGroups.get(asset.assetGroupId);
    if (group) {
      const newEntry =
        asset.target.kind === 'domain'
          ? assetWhitelistEntrySchema.parse({
              kind: 'root_domain',
              assetGroupId: asset.assetGroupId,
              rootDomain: asset.target.value,
              allowSubdomains: false,
            })
          : assetWhitelistEntrySchema.parse({
              kind: 'ip',
              assetGroupId: asset.assetGroupId,
              ip: asset.target.value,
            });
      const updatedGroup = {
        ...group,
        whitelistEntries: [...group.whitelistEntries, newEntry],
      };
      db().assetGroups.set(group.assetGroupId, updatedGroup);
    }
    const updated = { ...asset, status: 'CONFIRMED' as const };
    db().discoveredAssets.set(assetId, updated);
    return HttpResponse.json(
      discoveredAssetRecordSchema.parse(updated),
      { status: 200 },
    );
  }),

  // POST /api/discovered-assets/:assetId/reject
  http.post('/api/discovered-assets/:assetId/reject', ({ params }) => {
    const actor = db().actor;
    if (!actor || !actor.permissionPoints.includes('asset_scope:manage')) {
      return errorResponse({
        status: 403,
        errorCode: 'AUTHORIZATION_DENIED',
        message: '当前角色缺少 asset_scope:manage 权限。',
        details: { missingPermission: 'asset_scope:manage' },
      });
    }
    const assetId = String(params.assetId);
    const asset = db().discoveredAssets.get(assetId);
    if (!asset) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Discovered asset ${assetId} not found.`,
      });
    }
    if (asset.status === 'OUT_OF_SCOPE_DISCOVERED') {
      return errorResponse({
        status: 409,
        errorCode: 'ASSET_SCOPE_BLOCKED',
        message: '超出授权根域，不可改变状态。',
        taskState: 'BLOCKED',
      });
    }
    const updated = { ...asset, status: 'REJECTED' as const };
    db().discoveredAssets.set(assetId, updated);
    return HttpResponse.json(
      discoveredAssetRecordSchema.parse(updated),
      { status: 200 },
    );
  }),
];
