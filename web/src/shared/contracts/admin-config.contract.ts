/**
 * Frontend mirror of admin configuration contracts.
 *
 * No backend module exists for any of these blocks today; frontend-first per
 * task PRD decision D1. Reconciliation owned by
 * 05-02-integration-and-quality-verification.
 */
import { z } from 'zod';

import { executionIntensitySchema } from './foundation';

// ===========================================================================
// 1. LLM Provider
// ===========================================================================

export const llmProviderTypes = [
  'local',
  'openai-compatible',
  'claude-compatible',
] as const;
export const llmProviderTypeSchema = z.enum(llmProviderTypes);
export type LlmProviderType = z.infer<typeof llmProviderTypeSchema>;

export const llmProviderPurposes = [
  'intent-recognition',
  'plan-generation',
  'explanation',
  'report-draft',
] as const;
export const llmProviderPurposeSchema = z.enum(llmProviderPurposes);
export type LlmProviderPurpose = z.infer<typeof llmProviderPurposeSchema>;

export const adminEntityStatuses = ['ENABLED', 'DISABLED'] as const;
export const adminEntityStatusSchema = z.enum(adminEntityStatuses);
export type AdminEntityStatus = z.infer<typeof adminEntityStatusSchema>;

export const llmProviderSchema = z.object({
  llmProviderId: z.string().min(1),
  name: z.string().min(1),
  type: llmProviderTypeSchema,
  status: adminEntityStatusSchema,
  baseUrl: z.string().min(1),
  purposes: z.array(llmProviderPurposeSchema).default([]),
  /** Always rendered as bullets — never the real key. Null = no key configured. */
  apiKeyMask: z.literal('••••').nullable(),
  lastModifiedBy: z.string().min(1),
  lastModifiedAt: z.string().min(1),
});
export type LlmProvider = z.infer<typeof llmProviderSchema>;

export const llmProviderListResponseSchema = z.object({
  providers: z.array(llmProviderSchema),
});
export type LlmProviderListResponse = z.infer<typeof llmProviderListResponseSchema>;

export const llmProviderUpsertRequestSchema = z.object({
  name: z.string().min(1),
  type: llmProviderTypeSchema,
  baseUrl: z.string().min(1),
  /** Optional: present iff user typed a new key. Empty string forbidden. */
  apiKey: z.string().min(1).optional(),
  purposes: z.array(llmProviderPurposeSchema).default([]),
  status: adminEntityStatusSchema.default('ENABLED'),
});
export type LlmProviderUpsertRequest = z.infer<typeof llmProviderUpsertRequestSchema>;

// ===========================================================================
// 2. Tool Configs
// ===========================================================================

export const toolNames = [
  'subfinder',
  'httpx',
  'nmap',
  'nuclei',
  'hydra',
  'emlAnalyzer',
  'magika',
] as const;
export const toolNameSchema = z.enum(toolNames);
export type ToolName = z.infer<typeof toolNameSchema>;

export const toolIntensityProfileSchema = z.object({
  concurrency: z.number().int().min(1),
  rateLimitPerSecond: z.number().min(0),
  timeoutSeconds: z.number().int().min(1),
  /** Free-form: nmap port range, hydra wordlist, nuclei template set, etc. */
  notes: z.string().default(''),
});
export type ToolIntensityProfile = z.infer<typeof toolIntensityProfileSchema>;

export const toolConfigSchema = z.object({
  tool: toolNameSchema,
  version: z.string().min(1),
  path: z.string().min(1),
  /** All three intensity profiles must be present. */
  intensities: z.object({
    LOW: toolIntensityProfileSchema,
    MEDIUM: toolIntensityProfileSchema,
    HIGH: toolIntensityProfileSchema,
  }),
  lastModifiedBy: z.string().min(1),
  lastModifiedAt: z.string().min(1),
});
export type ToolConfig = z.infer<typeof toolConfigSchema>;

export const toolConfigListResponseSchema = z.object({
  toolConfigs: z.array(toolConfigSchema),
});
export type ToolConfigListResponse = z.infer<typeof toolConfigListResponseSchema>;

export const toolConfigUpdateRequestSchema = z.object({
  version: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  intensities: z
    .object({
      LOW: toolIntensityProfileSchema.optional(),
      MEDIUM: toolIntensityProfileSchema.optional(),
      HIGH: toolIntensityProfileSchema.optional(),
    })
    .optional(),
});
export type ToolConfigUpdateRequest = z.infer<typeof toolConfigUpdateRequestSchema>;

// Re-export for caller convenience.
export { executionIntensitySchema };

// ===========================================================================
// 3. Log Sources
// ===========================================================================

export const logSourceKinds = ['firewall', 'web'] as const;
export const logSourceKindSchema = z.enum(logSourceKinds);
export type LogSourceKind = z.infer<typeof logSourceKindSchema>;

export const logSourceProtocols = [
  'tcp-syslog',
  'udp-syslog',
  'tls-syslog',
  'http-push',
] as const;
export const logSourceProtocolSchema = z.enum(logSourceProtocols);
export type LogSourceProtocol = z.infer<typeof logSourceProtocolSchema>;

export const logSourceParserFormats = [
  'syslog',
  'nginx-access',
  'nginx-error',
  'apache-access',
  'apache-error',
  'json',
] as const;
export const logSourceParserFormatSchema = z.enum(logSourceParserFormats);
export type LogSourceParserFormat = z.infer<typeof logSourceParserFormatSchema>;

export const logSourceHealths = ['HEALTHY', 'DEGRADED', 'UNKNOWN'] as const;
export const logSourceHealthSchema = z.enum(logSourceHealths);
export type LogSourceHealth = z.infer<typeof logSourceHealthSchema>;

export const logSourceSchema = z.object({
  logSourceId: z.string().min(1),
  name: z.string().min(1),
  logKind: logSourceKindSchema,
  productType: z.string().min(1),
  protocol: logSourceProtocolSchema,
  parserFormat: logSourceParserFormatSchema,
  assetGroupId: z.string().min(1),
  status: adminEntityStatusSchema,
  health: logSourceHealthSchema,
  listenAddress: z.string().min(1),
  listenPort: z.number().int().min(1).max(65535),
  /** Display-only marker (never the real cert / key). */
  tlsConfigPlaceholder: z.literal('configured').nullable(),
  allowedSourceIps: z.array(z.string()).default([]),
  eventRetentionDays: z.number().int().min(1),
  metricsRetentionDays: z.number().int().min(1),
  lastModifiedBy: z.string().min(1),
  lastModifiedAt: z.string().min(1),
});
export type LogSource = z.infer<typeof logSourceSchema>;

export const logSourceListResponseSchema = z.object({
  logSources: z.array(logSourceSchema),
});
export type LogSourceListResponse = z.infer<typeof logSourceListResponseSchema>;

export const logSourceUpsertRequestSchema = z.object({
  name: z.string().min(1),
  logKind: logSourceKindSchema,
  productType: z.string().min(1),
  protocol: logSourceProtocolSchema,
  parserFormat: logSourceParserFormatSchema,
  assetGroupId: z.string().min(1),
  listenAddress: z.string().min(1),
  listenPort: z.number().int().min(1).max(65535),
  allowedSourceIps: z.array(z.string()).default([]),
  eventRetentionDays: z.number().int().min(1).default(180),
  metricsRetentionDays: z.number().int().min(1).default(365),
  status: adminEntityStatusSchema.default('ENABLED'),
});
export type LogSourceUpsertRequest = z.infer<typeof logSourceUpsertRequestSchema>;

export const logSourceToggleRequestSchema = z.object({
  status: adminEntityStatusSchema,
});
export type LogSourceToggleRequest = z.infer<typeof logSourceToggleRequestSchema>;

// ===========================================================================
// 4. Mail Sources
// ===========================================================================

export const mailSourceFailOpenPolicies = [
  'forward-with-marker',
  'block',
] as const;
export const mailSourceFailOpenPolicySchema = z.enum(mailSourceFailOpenPolicies);
export type MailSourceFailOpenPolicy = z.infer<typeof mailSourceFailOpenPolicySchema>;

export const mailSourceSchema = z.object({
  mailSourceId: z.string().min(1),
  name: z.string().min(1),
  upstreamHost: z.string().min(1),
  upstreamPort: z.number().int().min(1).max(65535),
  downstreamHost: z.string().min(1),
  downstreamPort: z.number().int().min(1).max(65535),
  status: adminEntityStatusSchema,
  recentReceivedCount: z.number().int().min(0),
  tlsConfigPlaceholder: z.literal('configured').nullable(),
  /** PRD §7.1: 50MB default, but configurable. */
  maxMessageBytes: z.number().int().min(1),
  failOpenPolicy: mailSourceFailOpenPolicySchema,
  lastModifiedBy: z.string().min(1),
  lastModifiedAt: z.string().min(1),
});
export type MailSource = z.infer<typeof mailSourceSchema>;

export const mailSourceListResponseSchema = z.object({
  mailSources: z.array(mailSourceSchema),
});
export type MailSourceListResponse = z.infer<typeof mailSourceListResponseSchema>;

export const mailSourceUpsertRequestSchema = z.object({
  name: z.string().min(1),
  upstreamHost: z.string().min(1),
  upstreamPort: z.number().int().min(1).max(65535),
  downstreamHost: z.string().min(1),
  downstreamPort: z.number().int().min(1).max(65535),
  maxMessageBytes: z.number().int().min(1).default(50 * 1024 * 1024),
  failOpenPolicy: mailSourceFailOpenPolicySchema.default('forward-with-marker'),
  status: adminEntityStatusSchema.default('ENABLED'),
});
export type MailSourceUpsertRequest = z.infer<typeof mailSourceUpsertRequestSchema>;

// ===========================================================================
// 5. Kill Switch
// ===========================================================================

export const killSwitchStatuses = ['RUNNING', 'STOPPED'] as const;
export const killSwitchStatusSchema = z.enum(killSwitchStatuses);
export type KillSwitchStatus = z.infer<typeof killSwitchStatusSchema>;

export const killSwitchStateSchema = z.object({
  status: killSwitchStatusSchema,
  lastOperatorActorId: z.string().nullable(),
  lastOperatedAt: z.string().nullable(),
  /** Always-true reminder of scope: stops scan tools / aux commands; not mail/log ingest. */
  scopeNote: z.string().min(1),
});
export type KillSwitchState = z.infer<typeof killSwitchStateSchema>;

export const killSwitchToggleRequestSchema = z.object({
  /** Must be the literal 'CONFIRM' (case-sensitive). */
  confirm: z.literal('CONFIRM'),
  /** Target status the operator wants. */
  target: killSwitchStatusSchema,
});
export type KillSwitchToggleRequest = z.infer<typeof killSwitchToggleRequestSchema>;
