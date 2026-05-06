/**
 * Helper used by admin handlers to append an audit entry on each mutation.
 * Keeps the synthetic audit-trail behavior in one place (PR4 plan).
 */
import type {
  ActorContext,
  AuditAction,
  AuditLogEntry,
  AuditOutcome,
  AuditTargetKind,
  SafeDetails,
} from '@/shared/contracts';

import { db } from '../db';

let counter = 0;

export interface AppendAuditEntryArgs {
  actor: ActorContext;
  action: AuditAction;
  targetKind: AuditTargetKind;
  targetId: string;
  outcome?: AuditOutcome;
  requestPayload?: SafeDetails;
  validationResult?: SafeDetails | null;
  note?: string | null;
}

export function appendAuditEntry({
  actor,
  action,
  targetKind,
  targetId,
  outcome = 'SUCCESS',
  requestPayload = {},
  validationResult = null,
  note = null,
}: AppendAuditEntryArgs): AuditLogEntry {
  counter += 1;
  const id = `audit_synth_${Date.now()}_${counter}`;
  const entry: AuditLogEntry = {
    auditLogEntryId: id,
    occurredAt: new Date().toISOString(),
    actorId: actor.actorId,
    roleIds: actor.roleIds,
    action,
    targetKind,
    targetId,
    outcome,
    requestPayload,
    validationResult,
    affectedResources: [{ kind: targetKind, id: targetId }],
    clearTextPassword: null,
    rawLogBody: null,
    note,
  };
  db().auditLogEntries.set(id, entry);
  return entry;
}
