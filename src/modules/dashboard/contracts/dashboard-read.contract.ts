import { z } from 'zod';

import {
  attackTrendBucketSchema,
  logTypeSchema,
  normalizedSecurityLogEventSchema,
} from '../../log-ingestion/contracts/log-ingestion.contract.js';

export const dashboardQuerySchema = z.object({
  assetGroupId: z.string().min(1),
  logType: logTypeSchema.optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  trendLimit: z.number().int().min(1).max(500).default(50),
  eventLimit: z.number().int().min(1).max(500).default(50),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const dashboardMetricsSchema = z.object({
  totalEvents: z.number().int().min(0),
  blockedEvents: z.number().int().min(0),
  unresolvedTargets: z.number().int().min(0),
  topAttackTypes: z.array(z.object({
    attackType: z.string().min(1),
    eventCount: z.number().int().min(0),
  })),
  trends: z.array(attackTrendBucketSchema),
  recentEvents: z.array(normalizedSecurityLogEventSchema),
});

export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>;
