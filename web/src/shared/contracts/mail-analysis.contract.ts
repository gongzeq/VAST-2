/**
 * Frontend mirror of `src/modules/phishing-mail/contracts/mail-analysis.contract.ts`.
 *
 * Field names and enum values must match the backend exactly. The
 * `rawBodyStored: z.literal(false)` constraint is intentionally preserved so
 * the type system itself prevents UI code from rendering a "raw body" field
 * (R6).
 */
import { z } from 'zod';

export const phishingLabels = ['suspected', 'suspicious', 'clean'] as const;
export const phishingLabelSchema = z.enum(phishingLabels);
export type PhishingLabel = z.infer<typeof phishingLabelSchema>;

export const mailAnalysisModes = ['FULL', 'BODY_ONLY_SIZE_LIMIT', 'UNAVAILABLE'] as const;
export const mailAnalysisModeSchema = z.enum(mailAnalysisModes);
export type MailAnalysisMode = z.infer<typeof mailAnalysisModeSchema>;

export const mailAnalysisStatuses = ['ANALYZED', 'UNAVAILABLE'] as const;
export const mailAnalysisStatusSchema = z.enum(mailAnalysisStatuses);
export type MailAnalysisStatus = z.infer<typeof mailAnalysisStatusSchema>;

/** Single-state forwarding result (fail-open design). */
export const mailForwardingStatuses = ['FORWARDED'] as const;
export const mailForwardingStatusSchema = z.enum(mailForwardingStatuses);
export type MailForwardingStatus = z.infer<typeof mailForwardingStatusSchema>;

export const mailIocKinds = ['URL', 'DOMAIN', 'IP', 'EMAIL'] as const;
export const mailIocKindSchema = z.enum(mailIocKinds);
export type MailIocKind = z.infer<typeof mailIocKindSchema>;

export const mailGatewayConfigSchema = z.object({
  gatewayId: z.string().min(1),
  assetGroupId: z.string().min(1),
  inboundSourceRefs: z.array(z.string().min(1)).default([]),
  downstreamHost: z.string().min(1),
  downstreamPort: z.number().int().min(1).max(65535).default(25),
  enabled: z.boolean().default(true),
});

export type MailGatewayConfig = z.infer<typeof mailGatewayConfigSchema>;

export const mailIocSchema = z.object({
  kind: mailIocKindSchema,
  value: z.string().min(1),
});

export type MailIoc = z.infer<typeof mailIocSchema>;

export const mailAttachmentAnalysisSchema = z.object({
  filename: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  contentType: z.string().nullable(),
  sha256: z.string().nullable(),
  analyzed: z.boolean(),
  skippedReason: z.string().nullable(),
  fileType: z.string().nullable(),
  riskSignals: z.array(z.string()).default([]),
});

export type MailAttachmentAnalysis = z.infer<typeof mailAttachmentAnalysisSchema>;

export const mailForwardingResultSchema = z.object({
  status: mailForwardingStatusSchema,
  downstreamHost: z.string().min(1),
  downstreamPort: z.number().int().min(1).max(65535),
  forwardedAt: z.string().min(1),
  appliedHeaders: z.record(z.string()),
});

export type MailForwardingResult = z.infer<typeof mailForwardingResultSchema>;

export const mailAnalysisRecordSchema = z.object({
  mailTaskId: z.string().min(1),
  gatewayId: z.string().min(1),
  assetGroupId: z.string().min(1),
  sourceRef: z.string().min(1),
  receivedAt: z.string().min(1),
  subject: z.string().nullable(),
  from: z.string().nullable(),
  recipients: z.array(z.string()).default([]),
  messageSizeBytes: z.number().int().min(0),
  bodySha256: z.string().min(1),
  /**
   * Compile-time guarantee: raw mail body is never persisted on the backend
   * and therefore never sent to the client. Any code that attempts to render
   * a raw body would have to introduce another schema; this literal makes
   * such drift visible (R6).
   */
  rawBodyStored: z.literal(false),
  analysisMode: mailAnalysisModeSchema,
  analysisStatus: mailAnalysisStatusSchema,
  phishingLabel: phishingLabelSchema.nullable(),
  riskScore: z.number().int().min(0).max(100).nullable(),
  securityHeaders: z.record(z.string()),
  attachmentAnalyses: z.array(mailAttachmentAnalysisSchema).default([]),
  iocs: z.array(mailIocSchema).default([]),
  forwardingResult: mailForwardingResultSchema,
  riskSignals: z.array(z.string()).default([]),
  unavailableReason: z.string().nullable(),
});

export type MailAnalysisRecord = z.infer<typeof mailAnalysisRecordSchema>;

// ---- UI-only response shapes (no backend counterpart) -----------------

export const mailAnalysisListResponseSchema = z.object({
  records: z.array(mailAnalysisRecordSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});

export type MailAnalysisListResponse = z.infer<typeof mailAnalysisListResponseSchema>;

export const mailAnalysisDetailResponseSchema = mailAnalysisRecordSchema;
export type MailAnalysisDetailResponse = MailAnalysisRecord;
