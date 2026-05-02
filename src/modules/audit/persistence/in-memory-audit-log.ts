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
  | 'TASK_STATE_CHANGED';

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
