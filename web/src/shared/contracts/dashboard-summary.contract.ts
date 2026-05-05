/**
 * Frontend mirror of the dashboard summary contract.
 *
 * Source of truth (partial): src/modules/dashboard/contracts/dashboard-read.contract.ts
 * (currently covers only the log-attack category — the other 6 categories are
 * frontend-first per task PRD decision D1; reconciliation owned by
 * 05-02-integration-and-quality-verification).
 *
 * Each category is a discriminated `kind` so contracts-parity can validate
 * one variant at a time as backend catches up.
 */
import { z } from 'zod';

import { severityLevelSchema } from './vulnerability.contract';
import { taskStateSchema } from './foundation';

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

export const trendBucketSchema = z.object({
  /** ISO timestamp of bucket start (e.g. day or hour boundary). */
  bucketAt: z.string().min(1),
  /** Numeric value plotted on the bucket. */
  value: z.number().min(0),
});
export type TrendBucket = z.infer<typeof trendBucketSchema>;

export const dashboardScopes = ['global', 'owned'] as const;
export const dashboardScopeSchema = z.enum(dashboardScopes);
export type DashboardScope = z.infer<typeof dashboardScopeSchema>;

// ---------------------------------------------------------------------------
// 1. Task category
// ---------------------------------------------------------------------------

export const dashboardTaskStateCountSchema = z.object({
  state: taskStateSchema,
  count: z.number().int().min(0),
});
export type DashboardTaskStateCount = z.infer<typeof dashboardTaskStateCountSchema>;

export const dashboardTaskMetricsSchema = z.object({
  kind: z.literal('task'),
  summary: z.string().min(1),
  todayTaskCount: z.number().int().min(0),
  runningTaskCount: z.number().int().min(0),
  byState: z.array(dashboardTaskStateCountSchema),
  averageDurationSeconds: z.number().min(0).nullable(),
  trend7Days: z.array(trendBucketSchema).default([]),
});
export type DashboardTaskMetrics = z.infer<typeof dashboardTaskMetricsSchema>;

// ---------------------------------------------------------------------------
// 2. Asset category
// ---------------------------------------------------------------------------

export const topServiceSchema = z.object({
  service: z.string().min(1),
  count: z.number().int().min(0),
});
export type TopService = z.infer<typeof topServiceSchema>;

export const dashboardAssetMetricsSchema = z.object({
  kind: z.literal('asset'),
  summary: z.string().min(1),
  authorizedAssetGroupCount: z.number().int().min(0),
  discoveredAssetCount: z.number().int().min(0),
  liveAssetCount: z.number().int().min(0),
  newlyDiscoveredAssetCount: z.number().int().min(0),
  exposedPortCount: z.number().int().min(0),
  topServices: z.array(topServiceSchema).default([]),
});
export type DashboardAssetMetrics = z.infer<typeof dashboardAssetMetricsSchema>;

// ---------------------------------------------------------------------------
// 3. Vulnerability category
// ---------------------------------------------------------------------------

export const severityCountSchema = z.object({
  severity: severityLevelSchema,
  count: z.number().int().min(0),
});
export type SeverityCount = z.infer<typeof severityCountSchema>;

export const topVulnerabilityTypeSchema = z.object({
  vulnerabilityType: z.string().min(1),
  count: z.number().int().min(0),
});

export const topRiskAssetSchema = z.object({
  asset: z.string().min(1),
  severity: severityLevelSchema,
  findingCount: z.number().int().min(0),
});

export const dashboardVulnerabilityMetricsSchema = z.object({
  kind: z.literal('vulnerability'),
  summary: z.string().min(1),
  severityCounts: z.array(severityCountSchema),
  topTypes: z.array(topVulnerabilityTypeSchema).default([]),
  topRiskAssets: z.array(topRiskAssetSchema).default([]),
  templateHitTrend: z.array(trendBucketSchema).default([]),
});
export type DashboardVulnerabilityMetrics = z.infer<typeof dashboardVulnerabilityMetricsSchema>;

// ---------------------------------------------------------------------------
// 4. Weak-password category
//   PRD §7.5 / §11: never carries cleartext or any per-asset password sample.
// ---------------------------------------------------------------------------

export const weakPasswordServiceCountSchema = z.object({
  serviceType: z.string().min(1),
  count: z.number().int().min(0),
});

export const dashboardWeakPasswordMetricsSchema = z.object({
  kind: z.literal('weak-password'),
  summary: z.string().min(1),
  weakPasswordAssetCount: z.number().int().min(0),
  byServiceType: z.array(weakPasswordServiceCountSchema).default([]),
  trend30Days: z.array(trendBucketSchema).default([]),
});
export type DashboardWeakPasswordMetrics = z.infer<typeof dashboardWeakPasswordMetricsSchema>;

// ---------------------------------------------------------------------------
// 5. Mail category
// ---------------------------------------------------------------------------

export const mailRiskBuckets = ['suspected', 'suspicious', 'clean'] as const;
export const mailRiskBucketSchema = z.enum(mailRiskBuckets);
export type MailRiskBucket = z.infer<typeof mailRiskBucketSchema>;

export const mailRiskBucketCountSchema = z.object({
  bucket: mailRiskBucketSchema,
  count: z.number().int().min(0),
});

export const topInduceTypeSchema = z.object({
  induceType: z.string().min(1),
  count: z.number().int().min(0),
});

export const topMailDomainSchema = z.object({
  domain: z.string().min(1),
  count: z.number().int().min(0),
});

export const topAttachmentTypeSchema = z.object({
  attachmentType: z.string().min(1),
  count: z.number().int().min(0),
});

export const dashboardMailMetricsSchema = z.object({
  kind: z.literal('mail'),
  summary: z.string().min(1),
  todayMailCount: z.number().int().min(0),
  suspectedMailCount: z.number().int().min(0),
  riskBucketCounts: z.array(mailRiskBucketCountSchema),
  topInduceTypes: z.array(topInduceTypeSchema).default([]),
  topUrlDomains: z.array(topMailDomainSchema).default([]),
  topAttachmentTypes: z.array(topAttachmentTypeSchema).default([]),
});
export type DashboardMailMetrics = z.infer<typeof dashboardMailMetricsSchema>;

// ---------------------------------------------------------------------------
// 6. YOLO / NL-agent category
// ---------------------------------------------------------------------------

export const dashboardYoloMetricsSchema = z.object({
  kind: z.literal('yolo'),
  summary: z.string().min(1),
  naturalLanguageTaskCount: z.number().int().min(0),
  yoloDirectExecutionCount: z.number().int().min(0),
  clarificationCount: z.number().int().min(0),
  whitelistBlockedCount: z.number().int().min(0),
});
export type DashboardYoloMetrics = z.infer<typeof dashboardYoloMetricsSchema>;

// ---------------------------------------------------------------------------
// 7. Log-attack category
//   Mirrors `src/modules/dashboard/contracts/dashboard-read.contract.ts` shape
//   but adapted for the discriminated-union envelope here.
// ---------------------------------------------------------------------------

export const topAttackTypeSchema = z.object({
  attackType: z.string().min(1),
  count: z.number().int().min(0),
});

export const topSourceIpSchema = z.object({
  sourceIp: z.string().min(1),
  count: z.number().int().min(0),
});

export const topTargetAssetSchema = z.object({
  asset: z.string().min(1),
  count: z.number().int().min(0),
});

export const actionDistributionSchema = z.object({
  action: z.string().min(1),
  count: z.number().int().min(0),
});

export const httpMethodCountSchema = z.object({
  method: z.string().min(1),
  count: z.number().int().min(0),
});

export const httpStatusCountSchema = z.object({
  status: z.number().int().min(100).max(599),
  count: z.number().int().min(0),
});

export const dashboardLogAttackMetricsSchema = z.object({
  kind: z.literal('log-attack'),
  summary: z.string().min(1),
  firewallEventCount: z.number().int().min(0),
  webEventCount: z.number().int().min(0),
  topAttackTypes: z.array(topAttackTypeSchema).default([]),
  topSourceIps: z.array(topSourceIpSchema).default([]),
  topTargetAssets: z.array(topTargetAssetSchema).default([]),
  actionDistribution: z.array(actionDistributionSchema).default([]),
  topUriPatterns: z.array(z.object({
    uriPattern: z.string().min(1),
    count: z.number().int().min(0),
  })).default([]),
  httpMethodCounts: z.array(httpMethodCountSchema).default([]),
  httpStatusCounts: z.array(httpStatusCountSchema).default([]),
  attackTrend: z.array(trendBucketSchema).default([]),
  /** True iff the last 15-minute window exceeded baseline×3 (PRD §11). */
  spikeAlert: z.boolean(),
});
export type DashboardLogAttackMetrics = z.infer<typeof dashboardLogAttackMetricsSchema>;

// ---------------------------------------------------------------------------
// Discriminated union envelope
// ---------------------------------------------------------------------------

export const dashboardCategorySchema = z.discriminatedUnion('kind', [
  dashboardTaskMetricsSchema,
  dashboardAssetMetricsSchema,
  dashboardVulnerabilityMetricsSchema,
  dashboardWeakPasswordMetricsSchema,
  dashboardMailMetricsSchema,
  dashboardYoloMetricsSchema,
  dashboardLogAttackMetricsSchema,
]);
export type DashboardCategory = z.infer<typeof dashboardCategorySchema>;

export const dashboardCategoryKinds = [
  'task',
  'asset',
  'vulnerability',
  'weak-password',
  'mail',
  'yolo',
  'log-attack',
] as const;
export type DashboardCategoryKind = (typeof dashboardCategoryKinds)[number];

export const dashboardSummarySchema = z.object({
  generatedAt: z.string().min(1),
  scope: dashboardScopeSchema,
  /** Resolved asset-group ids the summary covers (may differ from request when scope=owned). */
  assetGroupIds: z.array(z.string().min(1)),
  categories: z.array(dashboardCategorySchema),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

// ---------------------------------------------------------------------------
// URL query schema (used by MSW handler + URL-state parser)
// ---------------------------------------------------------------------------

export const dashboardSummaryQuerySchema = z.object({
  scope: dashboardScopeSchema.default('owned'),
  /** Comma-separated list of asset-group IDs; empty string means "all owned". */
  assetGroupIds: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    ),
});
export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;
