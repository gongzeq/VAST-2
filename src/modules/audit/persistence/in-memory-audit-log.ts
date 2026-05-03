import { createId, type SafeDetails } from '../../../shared/contracts/foundation.js';

export type AuditAction =
  | 'TASK_CREATED'
  | 'TASK_CLARIFICATION_REQUESTED'
  | 'TASK_CLARIFICATION_SUBMITTED'
  | 'TASK_CONFIRMATION_REQUESTED'
  | 'TASK_CONFIRMED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_CANCELLED'
  | 'TASK_BLOCKED'
  | 'TASK_STATE_CHANGED'
  | 'TOOL_EXECUTION_STARTED'
  | 'TOOL_EXECUTION_COMPLETED'
  | 'TOOL_EXECUTION_FAILED'
  | 'TOOL_EXECUTION_CANCELLED'
  | 'ASSET_DISCOVERY_STARTED'
  | 'ASSET_DISCOVERY_TARGET_SCANNED'
  | 'ASSET_DISCOVERY_TARGET_FAILED'
  | 'ASSET_DISCOVERY_COMPLETED'
  | 'ASSET_DISCOVERY_CANCELLED'
  | 'ASSET_DISCOVERY_FAILED'
  | 'SERVICE_DISCOVERY_STARTED'
  | 'SERVICE_DISCOVERY_TARGET_SCANNED'
  | 'SERVICE_DISCOVERY_TARGET_FAILED'
  | 'SERVICE_DISCOVERY_COMPLETED'
  | 'SERVICE_DISCOVERY_CANCELLED'
  | 'SERVICE_DISCOVERY_FAILED'
  | 'VULNERABILITY_SCAN_STARTED'
  | 'VULNERABILITY_TARGET_SCANNED'
  | 'VULNERABILITY_TARGET_FAILED'
  | 'VULNERABILITY_SCAN_COMPLETED'
  | 'VULNERABILITY_SCAN_CANCELLED'
  | 'VULNERABILITY_SCAN_FAILED';

export type AuditRecord = {
  auditId: string;
  actorId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
  details: SafeDetails;
};

export type NewAuditRecord = Omit<AuditRecord, 'auditId' | 'occurredAt'>;

export class InMemoryAuditLog {
  readonly #records: AuditRecord[] = [];

  append(record: NewAuditRecord): AuditRecord {
    const persisted: AuditRecord = {
      auditId: createId('audit'),
      occurredAt: new Date().toISOString(),
      ...record,
    };

    this.#records.push(persisted);
    return persisted;
  }

  listByResource(resourceId: string): AuditRecord[] {
    return this.#records.filter((record) => record.resourceId === resourceId).map((record) => ({ ...record }));
  }

  listAll(): AuditRecord[] {
    return this.#records.map((record) => ({ ...record }));
  }
}
