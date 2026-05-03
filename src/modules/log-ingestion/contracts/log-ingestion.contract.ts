import { z } from 'zod';

export const logTypes = ['FIREWALL', 'WAF', 'WEB'] as const;
export const logTypeSchema = z.enum(logTypes);
export type LogType = z.infer<typeof logTypeSchema>;

export const ingestProtocols = ['SYSLOG_UDP', 'SYSLOG_TCP', 'SYSLOG_TLS', 'HTTP'] as const;
export const ingestProtocolSchema = z.enum(ingestProtocols);
export type IngestProtocol = z.infer<typeof ingestProtocolSchema>;

export const parserFormats = ['JSON', 'NGINX_ACCESS', 'APACHE_ACCESS'] as const;
export const parserFormatSchema = z.enum(parserFormats);
export type ParserFormat = z.infer<typeof parserFormatSchema>;

export const syslogTransports = ['UDP', 'TCP', 'TLS'] as const;
export const syslogTransportSchema = z.enum(syslogTransports);
export type SyslogTransport = z.infer<typeof syslogTransportSchema>;

export const parseStatuses = ['PARSED', 'FAILED'] as const;
export const parseStatusSchema = z.enum(parseStatuses);
export type ParseStatus = z.infer<typeof parseStatusSchema>;

export const redactionStatuses = ['NOT_REQUIRED', 'REDACTED', 'FAILED'] as const;
export const redactionStatusSchema = z.enum(redactionStatuses);
export type RedactionStatus = z.infer<typeof redactionStatusSchema>;

export const securityLogSeverityLevels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
export const securityLogSeveritySchema = z.enum(securityLogSeverityLevels);
export type SecurityLogSeverity = z.infer<typeof securityLogSeveritySchema>;

export const syslogReceiverConfigSchema = z.object({
  transport: syslogTransportSchema,
  listenHost: z.string().min(1),
  listenPort: z.number().int().min(1).max(65535),
  tlsCertRef: z.string().min(1).nullable(),
  allowedSourceIps: z.array(z.string().min(1)).default([]),
});

export type SyslogReceiverConfig = z.infer<typeof syslogReceiverConfigSchema>;

export const logSourceConfigSchema = z.object({
  sourceId: z.string().min(1),
  logType: logTypeSchema,
  productType: z.string().min(1),
  ingestProtocol: ingestProtocolSchema,
  parserFormat: parserFormatSchema,
  assetGroupId: z.string().min(1),
  enabled: z.boolean().default(true),
  retentionEventsDays: z.number().int().min(1).default(180),
  retentionAggregatesDays: z.number().int().min(1).default(365),
  receiver: syslogReceiverConfigSchema.nullable().default(null),
});

export type LogSourceConfig = z.infer<typeof logSourceConfigSchema>;

export const logIngestRequestSchema = z.object({
  sourceId: z.string().min(1),
  sourceIp: z.string().min(1),
  payload: z.string().min(1),
  receivedAt: z.string().min(1).optional(),
});

export type LogIngestRequest = z.infer<typeof logIngestRequestSchema>;

export const logIngestRecordSchema = z.object({
  ingestRef: z.string().min(1),
  sourceId: z.string().min(1),
  receivedAt: z.string().min(1),
  originalEventTime: z.string().nullable(),
  sizeBytes: z.number().int().min(0),
  checksum: z.string().min(1),
  truncated: z.boolean(),
  parseStatus: parseStatusSchema,
  redactionStatus: redactionStatusSchema,
  rawBodyDiscarded: z.boolean(),
});

export type LogIngestRecord = z.infer<typeof logIngestRecordSchema>;

export const normalizedWebLogFieldsSchema = z.object({
  httpMethod: z.string().nullable(),
  uriPath: z.string().nullable(),
  statusCode: z.number().int().min(100).max(599).nullable(),
  userAgentSummary: z.string().nullable(),
  requestSize: z.number().int().min(0).nullable(),
  responseSize: z.number().int().min(0).nullable(),
});

export type NormalizedWebLogFields = z.infer<typeof normalizedWebLogFieldsSchema>;

export const attackClassificationSchema = z.object({
  attackType: z.string().min(1),
  classificationRuleId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  explanation: z.string().min(1),
});

export type AttackClassification = z.infer<typeof attackClassificationSchema>;

export const normalizedSecurityLogEventSchema = z.object({
  eventId: z.string().min(1),
  ingestRef: z.string().min(1),
  sourceId: z.string().min(1),
  assetGroupId: z.string().min(1),
  logType: logTypeSchema,
  eventTime: z.string().min(1),
  receivedAt: z.string().min(1),
  srcIp: z.string().nullable(),
  srcPort: z.number().int().min(1).max(65535).nullable(),
  dstIp: z.string().nullable(),
  dstDomain: z.string().nullable(),
  dstPort: z.number().int().min(1).max(65535).nullable(),
  protocol: z.string().nullable(),
  action: z.string().nullable(),
  ruleId: z.string().nullable(),
  ruleName: z.string().nullable(),
  severity: securityLogSeveritySchema,
  targetAssetId: z.string().nullable(),
  targetAuthorized: z.boolean(),
  classification: attackClassificationSchema.nullable(),
  webFields: normalizedWebLogFieldsSchema.nullable(),
  redactedFields: z.array(z.string()).default([]),
});

export type NormalizedSecurityLogEvent = z.infer<typeof normalizedSecurityLogEventSchema>;

export const attackTrendBucketSchema = z.object({
  bucketId: z.string().min(1),
  assetGroupId: z.string().min(1),
  windowStart: z.string().min(1),
  windowEnd: z.string().min(1),
  logType: logTypeSchema,
  attackType: z.string().min(1),
  severity: securityLogSeveritySchema,
  srcIpOrCidr: z.string().nullable(),
  targetAssetId: z.string().nullable(),
  action: z.string().nullable(),
  eventCount: z.number().int().min(0),
});

export type AttackTrendBucket = z.infer<typeof attackTrendBucketSchema>;

export const logIngestResultSchema = z.object({
  ingestRecord: logIngestRecordSchema,
  events: z.array(normalizedSecurityLogEventSchema),
  aggregatedBuckets: z.array(attackTrendBucketSchema),
});

export type LogIngestResult = z.infer<typeof logIngestResultSchema>;
