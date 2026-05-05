/**
 * Frontend mirror of the audit-log contract.
 *
 * Backend has `src/modules/audit/persistence/in-memory-audit-log.ts` but no
 * `audit/contracts/`. This contract is frontend-first per task PRD decision
 * D1; reconciliation owned by 05-02-integration-and-quality-verification.
 *
 * Sensitive masking is enforced HERE at the schema layer (R-F):
 *   - cleartext passwords MUST surface as the literal '[redacted]'
 *   - raw log bodies MUST surface as the literal 'unavailable'
 * Any drift causes `parse()` to fail → page degrades to unknown state rather
 * than silently rendering cleartext.
 */
import { z } from 'zod';

import { safeDetailsSchema } from './foundation';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const auditActions = [
  'task.create',
  'task.execute',
  'task.cancel',
  'task.confirm',
  'asset.confirm',
  'asset.reject',
  'asset_scope.update',
  'config.update',
  'kill_switch.operate',
  'weak_password.view',
  'weak_password.export',
  'report.export',
  'audit_log.view',
  'log_source.update',
  'mail_source.update',
  'llm_provider.update',
  'tool_config.update',
] as const;
export const auditActionSchema = z.enum(auditActions);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const auditOutcomes = ['SUCCESS', 'FAILURE', 'BLOCKED'] as const;
export const auditOutcomeSchema = z.enum(auditOutcomes);
export type AuditOutcome = z.infer<typeof auditOutcomeSchema>;

export const auditTargetKinds = [
  'task',
  'asset',
  'asset_group',
  'discovered_asset',
  'llm_provider',
  'tool_config',
  'log_source',
  'mail_source',
  'kill_switch',
  'report',
  'audit',
] as const;
export const auditTargetKindSchema = z.enum(auditTargetKinds);
export type AuditTargetKind = z.infer<typeof auditTargetKindSchema>;

// ---------------------------------------------------------------------------
// Entry shape
// ---------------------------------------------------------------------------

export const auditAffectedResourceSchema = z.object({
  kind: auditTargetKindSchema,
  id: z.string().min(1),
});
export type AuditAffectedResource = z.infer<typeof auditAffectedResourceSchema>;

export const auditLogEntrySchema = z.object({
  auditLogEntryId: z.string().min(1),
  occurredAt: z.string().min(1),
  actorId: z.string().min(1),
  roleIds: z.array(z.string().min(1)).default([]),
  action: auditActionSchema,
  targetKind: auditTargetKindSchema,
  targetId: z.string().min(1),
  outcome: auditOutcomeSchema,
  /** Free-form structured request body; safeDetails restricts to JSON-safe primitives. */
  requestPayload: safeDetailsSchema.default({}),
  /** Structured validation result; null when no validation step ran. */
  validationResult: safeDetailsSchema.nullable().default(null),
  affectedResources: z.array(auditAffectedResourceSchema).default([]),
  /**
   * Cleartext password marker. NEVER carries a real password — backend strips
   * it in the audit pipeline. Using a literal makes accidental drift fail the
   * `parse()` call rather than silently rendering cleartext.
   */
  clearTextPassword: z.literal('[redacted]').nullable().default(null),
  /** Same idea for raw log bodies. */
  rawLogBody: z.literal('unavailable').nullable().default(null),
  /** Optional human-readable note. */
  note: z.string().nullable().default(null),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

// ---------------------------------------------------------------------------
// Filter + list response
// ---------------------------------------------------------------------------

export const auditLogQuerySchema = z.object({
  /** Comma-separated; expanded server-side. */
  actorIds: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '').split(',').map((p) => p.trim()).filter(Boolean),
    ),
  /** Comma-separated AuditAction values. */
  actions: z
    .string()
    .optional()
    .transform((value) => {
      const parts = (value ?? '').split(',').map((p) => p.trim()).filter(Boolean);
      return parts.filter((p): p is AuditAction => auditActions.includes(p as AuditAction));
    }),
  outcomes: z
    .string()
    .optional()
    .transform((value) => {
      const parts = (value ?? '').split(',').map((p) => p.trim()).filter(Boolean);
      return parts.filter((p): p is AuditOutcome => auditOutcomes.includes(p as AuditOutcome));
    }),
  targetKind: auditTargetKindSchema.optional(),
  targetIdQuery: z.string().trim().min(1).optional(),
  /** ISO datetime, inclusive lower bound. */
  since: z.string().datetime().optional(),
  /** ISO datetime, exclusive upper bound. */
  until: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const auditLogListResponseSchema = z.object({
  entries: z.array(auditLogEntrySchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});
export type AuditLogListResponse = z.infer<typeof auditLogListResponseSchema>;
