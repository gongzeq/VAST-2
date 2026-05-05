/**
 * Audit log table.
 *
 * Renders columns: time / actor / action / target / outcome / details button.
 * Sensitive masking is enforced at the contract layer (cleartextPassword and
 * rawLogBody), so this component never has to special-case those values.
 */
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import type { AuditLogEntry } from '@/shared/contracts/audit-log.contract';
import { formatDate } from '@/shared/formatting/format-date';

export interface AuditLogTableProps {
  entries: AuditLogEntry[];
  onSelect: (entryId: string) => void;
}

export function AuditLogTable({ entries, onSelect }: AuditLogTableProps) {
  return (
    <div className="overflow-x-auto" data-testid="audit-log-table">
      <table className="w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">时间</th>
            <th className="px-3 py-2 text-left">操作者</th>
            <th className="px-3 py-2 text-left">操作</th>
            <th className="px-3 py-2 text-left">目标</th>
            <th className="px-3 py-2 text-left">结果</th>
            <th className="px-3 py-2 text-left"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <tr key={entry.auditLogEntryId} data-testid={`audit-row-${entry.auditLogEntryId}`}>
              <td className="px-3 py-2 text-gray-700">{formatDate(entry.occurredAt)}</td>
              <td className="px-3 py-2 text-gray-700">
                {entry.actorId}
                <div className="text-xs text-gray-500">{entry.roleIds.join(', ')}</div>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{entry.action}</td>
              <td className="px-3 py-2 text-gray-700">
                <div className="font-mono text-xs">{entry.targetKind}</div>
                <div className="text-xs text-gray-500">{entry.targetId}</div>
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={{ kind: 'audit-outcome', value: entry.outcome }} />
              </td>
              <td className="px-3 py-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onSelect(entry.auditLogEntryId)}
                  data-testid={`audit-row-detail-${entry.auditLogEntryId}`}
                >
                  查看
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
