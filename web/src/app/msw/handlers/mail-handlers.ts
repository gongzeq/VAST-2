import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import {
  mailAnalysisDetailResponseSchema,
  mailAnalysisListResponseSchema,
  mailGatewayConfigSchema,
  phishingLabelSchema,
  type MailAnalysisRecord,
} from '@/shared/contracts';

import { db } from '../db';
import { errorResponse } from './_helpers';

const mailListQuerySchema = z.object({
  assetGroupId: z.string().min(1).optional(),
  gatewayId: z.string().min(1).optional(),
  phishingLabel: phishingLabelSchema.optional(),
  since: z.string().min(1).optional(),
  until: z.string().min(1).optional(),
  sort: z
    .enum(['receivedAt:desc', 'receivedAt:asc', 'riskScore:desc', 'riskScore:asc', 'messageSizeBytes:desc', 'messageSizeBytes:asc'])
    .default('receivedAt:desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

type MailListQuery = z.infer<typeof mailListQuerySchema>;

function recordsForActor(records: MailAnalysisRecord[], actorAssetGroupIds: string[]): MailAnalysisRecord[] {
  return records.filter((record) => actorAssetGroupIds.includes(record.assetGroupId));
}

function filterRecords(records: MailAnalysisRecord[], query: MailListQuery): MailAnalysisRecord[] {
  return records.filter((record) => {
    if (query.assetGroupId && record.assetGroupId !== query.assetGroupId) return false;
    if (query.gatewayId && record.gatewayId !== query.gatewayId) return false;
    if (query.phishingLabel && record.phishingLabel !== query.phishingLabel) return false;
    if (query.since && record.receivedAt < query.since) return false;
    if (query.until && record.receivedAt > query.until) return false;
    return true;
  });
}

function sortRecords(records: MailAnalysisRecord[], sort: MailListQuery['sort']): MailAnalysisRecord[] {
  const [field = 'receivedAt', dir = 'desc'] = sort.split(':');
  const direction = dir === 'asc' ? 1 : -1;
  return [...records].sort((a, b) => {
    if (field === 'receivedAt') return a.receivedAt.localeCompare(b.receivedAt) * direction;
    if (field === 'messageSizeBytes') return (a.messageSizeBytes - b.messageSizeBytes) * direction;
    // riskScore — nulls always last regardless of direction.
    if (a.riskScore === null && b.riskScore === null) return 0;
    if (a.riskScore === null) return 1;
    if (b.riskScore === null) return -1;
    return (a.riskScore - b.riskScore) * direction;
  });
}

export const mailHandlers = [
  http.get('/api/mails', ({ request }) => {
    const actor = db().actor;
    if (!actor || !actor.permissionPoints.includes('raw_evidence:view')) {
      return errorResponse({
        status: 403,
        errorCode: 'AUTHORIZATION_DENIED',
        message: '当前角色缺少 raw_evidence:view 权限。',
        details: { missingPermission: 'raw_evidence:view' },
      });
    }

    const queryObject = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = mailListQuerySchema.safeParse(queryObject);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Mail analysis list query invalid.',
      });
    }

    const query = parsed.data;
    if (query.assetGroupId && !actor.assetGroupIds.includes(query.assetGroupId)) {
      return errorResponse({
        status: 403,
        errorCode: 'AUTHORIZATION_DENIED',
        message: '当前角色无权查看该资产组的邮件分析记录。',
        details: { assetGroupId: query.assetGroupId },
      });
    }

    const visible = recordsForActor(Array.from(db().mailAnalyses.values()), actor.assetGroupIds);
    const filtered = filterRecords(visible, query);
    const sorted = sortRecords(filtered, query.sort);
    const start = (query.page - 1) * query.pageSize;
    const body = mailAnalysisListResponseSchema.parse({
      records: sorted.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: sorted.length,
    });
    return HttpResponse.json(body, { status: 200 });
  }),

  http.get('/api/mails/:mailTaskId', ({ params }) => {
    const actor = db().actor;
    if (!actor || !actor.permissionPoints.includes('raw_evidence:view')) {
      return errorResponse({
        status: 403,
        errorCode: 'AUTHORIZATION_DENIED',
        message: '当前角色缺少 raw_evidence:view 权限。',
        details: { missingPermission: 'raw_evidence:view' },
      });
    }

    const mailTaskId = String(params.mailTaskId);
    const record = db().mailAnalyses.get(mailTaskId);
    if (!record) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Mail analysis ${mailTaskId} not found.`,
      });
    }
    if (!actor.assetGroupIds.includes(record.assetGroupId)) {
      return errorResponse({
        status: 403,
        errorCode: 'AUTHORIZATION_DENIED',
        message: '当前角色无权查看该邮件所属资产组。',
        details: { assetGroupId: record.assetGroupId },
      });
    }

    return HttpResponse.json(mailAnalysisDetailResponseSchema.parse(record), { status: 200 });
  }),

  http.get('/api/mail-gateways/:gatewayId', ({ params }) => {
    const actor = db().actor;
    if (!actor || !actor.permissionPoints.includes('raw_evidence:view')) {
      return errorResponse({
        status: 403,
        errorCode: 'AUTHORIZATION_DENIED',
        message: '当前角色缺少 raw_evidence:view 权限。',
        details: { missingPermission: 'raw_evidence:view' },
      });
    }

    const gatewayId = String(params.gatewayId);
    const gateway = db().mailGateways.get(gatewayId);
    if (!gateway) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Mail gateway ${gatewayId} not found.`,
      });
    }

    return HttpResponse.json(mailGatewayConfigSchema.parse(gateway), { status: 200 });
  }),
];
