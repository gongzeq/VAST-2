import { z } from 'zod';

export const reportTypes = [
  'TASK',
  'ASSET_RISK',
  'PHISHING_MAIL',
  'VULNERABILITY_SCAN',
  'WEAK_PASSWORD',
  'LOG_ATTACK_POSTURE',
] as const;
export const reportTypeSchema = z.enum(reportTypes);
export type ReportType = z.infer<typeof reportTypeSchema>;

export const reportExportFormats = ['HTML', 'PDF', 'JSON', 'XLSX_ENCRYPTED'] as const;
export const reportExportFormatSchema = z.enum(reportExportFormats);
export type ReportExportFormat = z.infer<typeof reportExportFormatSchema>;

export const reportExportKinds = ['REPORT', 'WEAK_PASSWORD_CLEARTEXT'] as const;
export const reportExportKindSchema = z.enum(reportExportKinds);
export type ReportExportKind = z.infer<typeof reportExportKindSchema>;

export const weakPasswordMaskedFindingSchema = z.object({
  targetRef: z.string().min(1),
  service: z.string().min(1),
  account: z.string().min(1),
  passwordMasked: z.string().min(1),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
});

export type WeakPasswordMaskedFinding = z.infer<typeof weakPasswordMaskedFindingSchema>;

export const weakPasswordCleartextFindingSchema = z.object({
  targetRef: z.string().min(1),
  service: z.string().min(1),
  account: z.string().min(1),
  passwordPlaintext: z.string().min(1),
  discoveredAt: z.string().min(1),
});

export type WeakPasswordCleartextFinding = z.infer<typeof weakPasswordCleartextFindingSchema>;

export const reportSectionSchema = z.object({
  title: z.string().min(1),
  lines: z.array(z.string()).default([]),
});

export type ReportSection = z.infer<typeof reportSectionSchema>;

export const createReportCommandSchema = z.object({
  reportType: reportTypeSchema,
  assetGroupId: z.string().min(1),
  taskId: z.string().min(1).nullable().default(null),
  title: z.string().min(1),
  summaryLines: z.array(z.string()).default([]),
  sections: z.array(reportSectionSchema).default([]),
  weakPasswordFindings: z.array(weakPasswordMaskedFindingSchema).default([]),
  mailTaskIds: z.array(z.string().min(1)).default([]),
});

export type CreateReportCommand = z.infer<typeof createReportCommandSchema>;

export const reportRecordSchema = z.object({
  reportId: z.string().min(1),
  reportType: reportTypeSchema,
  assetGroupId: z.string().min(1),
  taskId: z.string().nullable(),
  title: z.string().min(1),
  createdAt: z.string().min(1),
  sections: z.array(reportSectionSchema).default([]),
  weakPasswordFindings: z.array(weakPasswordMaskedFindingSchema).default([]),
  mailTaskIds: z.array(z.string()).default([]),
  containsSensitiveCleartext: z.literal(false),
});

export type ReportRecord = z.infer<typeof reportRecordSchema>;

export const exportReportCommandSchema = z.object({
  reportId: z.string().min(1),
  format: reportExportFormatSchema.default('JSON'),
  requestedAt: z.string().min(1).optional(),
});

export type ExportReportCommand = z.infer<typeof exportReportCommandSchema>;

export const exportWeakPasswordCleartextCommandSchema = z.object({
  assetGroupId: z.string().min(1),
  taskId: z.string().min(1),
  taskCompletedAt: z.string().min(1),
  requestedAt: z.string().min(1).optional(),
  findings: z.array(weakPasswordCleartextFindingSchema).default([]),
});

export type ExportWeakPasswordCleartextCommand = z.infer<typeof exportWeakPasswordCleartextCommandSchema>;

export const reportExportRecordSchema = z.object({
  exportId: z.string().min(1),
  reportId: z.string().nullable(),
  assetGroupId: z.string().min(1),
  taskId: z.string().nullable(),
  exportKind: reportExportKindSchema,
  format: reportExportFormatSchema,
  requestedBy: z.string().min(1),
  requestedAt: z.string().min(1),
  artifactRef: z.string().min(1),
  artifactSha256: z.string().min(1),
  expiresAt: z.string().nullable(),
  cleartextIncluded: z.boolean(),
  passwordStored: z.literal(false),
});

export type ReportExportRecord = z.infer<typeof reportExportRecordSchema>;

export const reportExportResultSchema = z.object({
  exportRecord: reportExportRecordSchema,
  oneTimePassword: z.string().nullable(),
  contentPreview: z.string().min(1).nullable(),
});

export type ReportExportResult = z.infer<typeof reportExportResultSchema>;
