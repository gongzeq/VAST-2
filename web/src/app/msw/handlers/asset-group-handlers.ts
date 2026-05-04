import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import {
  assetGroupListResponseSchema,
  assetGroupSchema,
  assetWhitelistEntrySchema,
  type AssetWhitelistEntry,
} from '@/shared/contracts';

import { db } from '../db';
import { errorResponse } from './_helpers';

const newWhitelistEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('root_domain'),
    rootDomain: z.string().min(1),
    allowSubdomains: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal('cidr'),
    cidr: z.string().min(1),
  }),
  z.object({
    kind: z.literal('ip'),
    ip: z.string().min(1),
  }),
]);

export const assetGroupHandlers = [
  // GET /api/asset-groups — list
  http.get('/api/asset-groups', () => {
    const items = Array.from(db().assetGroups.values());
    return HttpResponse.json(
      assetGroupListResponseSchema.parse({ items }),
      { status: 200 },
    );
  }),

  // GET /api/asset-groups/:groupId
  http.get('/api/asset-groups/:groupId', ({ params }) => {
    const groupId = String(params.groupId);
    const group = db().assetGroups.get(groupId);
    if (!group) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Asset group ${groupId} not found.`,
      });
    }
    return HttpResponse.json(assetGroupSchema.parse(group), { status: 200 });
  }),

  // POST /api/asset-groups/:groupId/whitelist-entries
  http.post(
    '/api/asset-groups/:groupId/whitelist-entries',
    async ({ params, request }) => {
      const actor = db().actor;
      if (!actor || !actor.permissionPoints.includes('asset_scope:manage')) {
        return errorResponse({
          status: 403,
          errorCode: 'AUTHORIZATION_DENIED',
          message: '当前角色缺少 asset_scope:manage 权限。',
          details: { missingPermission: 'asset_scope:manage' },
        });
      }
      const groupId = String(params.groupId);
      const group = db().assetGroups.get(groupId);
      if (!group) {
        return errorResponse({
          status: 404,
          errorCode: 'TASK_EXECUTION_FAILED',
          message: `Asset group ${groupId} not found.`,
        });
      }
      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return errorResponse({
          status: 400,
          errorCode: 'SCHEMA_VALIDATION_FAILED',
          message: 'Body was not valid JSON.',
        });
      }
      const parsed = newWhitelistEntrySchema.safeParse(payload);
      if (!parsed.success) {
        return errorResponse({
          status: 400,
          errorCode: 'SCHEMA_VALIDATION_FAILED',
          message: 'whitelist entry payload invalid.',
        });
      }
      const entry = assetWhitelistEntrySchema.parse({
        ...parsed.data,
        assetGroupId: groupId,
      } as AssetWhitelistEntry);
      const updatedGroup = {
        ...group,
        whitelistEntries: [...group.whitelistEntries, entry],
      };
      db().assetGroups.set(groupId, updatedGroup);
      return HttpResponse.json(
        assetGroupSchema.parse(updatedGroup),
        { status: 201 },
      );
    },
  ),
];
