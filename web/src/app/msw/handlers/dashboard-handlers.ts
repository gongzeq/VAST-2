/**
 * Dashboard MSW handlers.
 *
 * Endpoints:
 *   GET /api/dashboard/summary?scope=…&assetGroupIds=…
 *
 * Permission: any logged-in actor (per-card masking enforced inside the page).
 * scope=global requires `asset_scope:manage`; scope=owned filters categories
 * to the actor's asset group set (intersected with the optional filter).
 */
import { http, HttpResponse } from 'msw';

import {
  dashboardSummaryQuerySchema,
  dashboardSummarySchema,
  type DashboardSummary,
} from '@/shared/contracts';

import { db } from '../db';
import { errorResponse } from './_helpers';

export const dashboardHandlers = [
  http.get('/api/dashboard/summary', ({ request }) => {
    const actor = db().actor;
    if (!actor) {
      return errorResponse({
        status: 401,
        errorCode: 'AUTHORIZATION_DENIED',
        message: '需要登录后查看仪表盘。',
      });
    }

    const queryObject = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = dashboardSummaryQuerySchema.safeParse(queryObject);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Dashboard summary query invalid.',
      });
    }

    const query = parsed.data;
    if (query.scope === 'global' && !actor.permissionPoints.includes('asset_scope:manage')) {
      return errorResponse({
        status: 403,
        errorCode: 'AUTHORIZATION_DENIED',
        message: '当前角色无权查看全局视图，请切换为已授权资产组。',
        details: { missingPermission: 'asset_scope:manage' },
      });
    }

    // Resolve effective asset group set.
    let effectiveAssetGroupIds: string[];
    if (query.scope === 'global') {
      effectiveAssetGroupIds =
        query.assetGroupIds.length > 0
          ? query.assetGroupIds
          : Array.from(db().assetGroups.keys());
    } else {
      const owned = actor.assetGroupIds;
      effectiveAssetGroupIds =
        query.assetGroupIds.length > 0
          ? query.assetGroupIds.filter((id) => owned.includes(id))
          : owned;
    }

    const seed = db().dashboardSummary;
    const body: DashboardSummary = {
      generatedAt: new Date().toISOString(),
      scope: query.scope,
      assetGroupIds: effectiveAssetGroupIds,
      categories: seed.categories,
    };

    return HttpResponse.json(dashboardSummarySchema.parse(body), { status: 200 });
  }),
];
