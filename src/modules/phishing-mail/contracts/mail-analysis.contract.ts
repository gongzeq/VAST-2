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

export const mailAttachmentMetadataSchema = z.object({
  filename: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  contentType: z.string().min(1).nullable().default(null),
  sha256: z.string().min(1).nullable().default(null),
});

export type MailAttachmentMetadata = z.infer<typeof mailAttachmentMetadataSchema>;

export const inboundMailRequestSchema = z.object({
  gatewayId: z.string().min(1),
  sourceRef: z.string().min(1),
  rawMessage: z.string().min(1),
  sizeBytes: z.number().int().min(0).optional(),
  attachments: z.array(mailAttachmentMetadataSchema).default([]),
  analysisAvailable: z.boolean().default(true),
  receivedAt: z.string().min(1).optional(),
});

export type InboundMailRequest = z.infer<typeof inboundMailRequestSchema>;

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
