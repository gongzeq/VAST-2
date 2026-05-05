/**
 * Audit log filter controls — every value is mirrored in the URL via
 * `useSearchParams`. Pagination resets to page=1 when any non-page filter
 * changes (PRD R3).
 */
import { Input, Select } from '@/shared/components';
import { Button } from '@/shared/components/Button';
import {
  auditActions,
  auditOutcomes,
  auditTargetKinds,
  type AuditAction,
  type AuditOutcome,
  type AuditTargetKind,
} from '@/shared/contracts/audit-log.contract';

import {
  resetAuditPagination,
  type AuditLogFilter,
} from '../state/audit-log-filter.contract';

export interface AuditLogFiltersProps {
  filter: AuditLogFilter;
  onChange: (next: AuditLogFilter) => void;
}

const ACTOR_OPTIONS = ['actor_alice', 'actor_root', 'actor_audit', 'actor_killswitch'];

export function AuditLogFilters({ filter, onChange }: AuditLogFiltersProps) {
  const update = (patch: Partial<AuditLogFilter>) => {
    onChange(resetAuditPagination({ ...filter, ...patch }));
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="audit-filters">
      <label className="flex flex-col gap-1 text-sm text-gray-700">
        操作者
        <Select
          data-testid="audit-filter-actor"
          value={filter.actorIds[0] ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            update({ actorIds: value ? [value] : [] });
          }}
        >
          <option value="">全部</option>
          {ACTOR_OPTIONS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-gray-700">
        操作类型
        <Select
          data-testid="audit-filter-action"
          value={filter.actions[0] ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            update({
              actions: value ? [value as AuditAction] : [],
            });
          }}
        >
          <option value="">全部</option>
          {auditActions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-gray-700">
        结果
        <Select
          data-testid="audit-filter-outcome"
          value={filter.outcomes[0] ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            update({
              outcomes: value ? [value as AuditOutcome] : [],
            });
          }}
        >
          <option value="">全部</option>
          {auditOutcomes.map((outcome) => (
            <option key={outcome} value={outcome}>
              {outcome}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-gray-700">
        目标类型
        <Select
          data-testid="audit-filter-target-kind"
          value={filter.targetKind ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            update({
              targetKind: value ? (value as AuditTargetKind) : undefined,
            });
          }}
        >
          <option value="">全部</option>
          {auditTargetKinds.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-gray-700">
        目标 ID 包含
        <Input
          data-testid="audit-filter-target-id"
          type="text"
          value={filter.targetIdQuery ?? ''}
          onChange={(event) => {
            const value = event.target.value.trim();
            update({ targetIdQuery: value ? value : undefined });
          }}
          placeholder="例如 task_running"
        />
      </label>

      <div className="flex items-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            onChange({
              actorIds: [],
              actions: [],
              outcomes: [],
              page: 1,
              pageSize: filter.pageSize,
            })
          }
          data-testid="audit-filter-clear"
        >
          清除筛选
        </Button>
      </div>
    </div>
  );
}
