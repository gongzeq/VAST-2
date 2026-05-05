/**
 * Audit log detail dialog.
 *
 * Renders the full entry payload. Cleartext password and raw log body fields
 * are stored as zod literals (`'[redacted]'` / `'unavailable'`); we surface
 * them with explicit Chinese labels so reviewers see the masking is real.
 */
import { Dialog } from '@/shared/components/Dialog';
import { StatusBadge } from '@/shared/components/StatusBadge';
import type { AuditLogEntry } from '@/shared/contracts/audit-log.contract';
import { formatDate } from '@/shared/formatting/format-date';

export interface AuditLogDetailDialogProps {
  entry: AuditLogEntry | null;
  onClose: () => void;
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs">{children}</div>
    </section>
  );
}

function renderSafeDetails(record: Record<string, unknown>): React.ReactNode {
  const entries = Object.entries(record);
  if (entries.length === 0) return <span className="text-gray-500">（空）</span>;
  return (
    <dl className="grid grid-cols-[max-content,1fr] gap-x-3 gap-y-1">
      {entries.map(([key, value]) => (
        <>
          <dt key={`${key}-k`} className="font-mono text-gray-500">
            {key}
          </dt>
          <dd key={`${key}-v`} className="font-mono text-gray-800">
            {Array.isArray(value)
              ? value.map(String).join(', ')
              : value === null
              ? 'null'
              : String(value)}
          </dd>
        </>
      ))}
    </dl>
  );
}

export function AuditLogDetailDialog({ entry, onClose }: AuditLogDetailDialogProps) {
  return (
    <Dialog
      open={entry !== null}
      onClose={onClose}
      title={entry ? `审计详情 · ${entry.action}` : '审计详情'}
      description={entry ? `条目 ID：${entry.auditLogEntryId}` : undefined}
    >
      {entry ? (
        <div className="text-xs text-gray-700" data-testid="audit-detail-content">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-gray-500">时间</div>
              <div className="text-gray-800">{formatDate(entry.occurredAt)}</div>
            </div>
            <div>
              <div className="text-gray-500">操作者</div>
              <div className="text-gray-800">
                {entry.actorId}
                <div className="text-[11px] text-gray-500">
                  {entry.roleIds.join(', ')}
                </div>
              </div>
            </div>
            <div>
              <div className="text-gray-500">目标</div>
              <div className="font-mono text-gray-800">
                {entry.targetKind}
                <span className="text-gray-500"> · </span>
                {entry.targetId}
              </div>
            </div>
            <div>
              <div className="text-gray-500">结果</div>
              <div>
                <StatusBadge status={{ kind: 'audit-outcome', value: entry.outcome }} />
              </div>
            </div>
          </div>

          <DetailSection title="请求载荷 / Request Payload">
            {renderSafeDetails(entry.requestPayload as Record<string, unknown>)}
          </DetailSection>

          <DetailSection title="校验结果 / Validation Result">
            {entry.validationResult
              ? renderSafeDetails(entry.validationResult as Record<string, unknown>)
              : <span className="text-gray-500">（无）</span>}
          </DetailSection>

          <DetailSection title="影响资源 / Affected Resources">
            {entry.affectedResources.length === 0 ? (
              <span className="text-gray-500">（无）</span>
            ) : (
              <ul className="list-disc pl-4">
                {entry.affectedResources.map((res) => (
                  <li key={`${res.kind}-${res.id}`} className="font-mono">
                    {res.kind} · {res.id}
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection title="敏感字段">
            <dl className="grid grid-cols-[max-content,1fr] gap-x-3 gap-y-1">
              <dt className="font-mono text-gray-500">明文密码</dt>
              <dd
                className="text-gray-800"
                data-testid="audit-detail-cleartext-password"
              >
                {entry.clearTextPassword === '[redacted]'
                  ? '[已脱敏]'
                  : entry.clearTextPassword === null
                  ? '（不涉及）'
                  : '（异常：未脱敏）'}
              </dd>
              <dt className="font-mono text-gray-500">原始日志正文</dt>
              <dd
                className="text-gray-800"
                data-testid="audit-detail-raw-log-body"
              >
                {entry.rawLogBody === 'unavailable'
                  ? '[原文不可用]'
                  : entry.rawLogBody === null
                  ? '（不涉及）'
                  : '（异常：未脱敏）'}
              </dd>
            </dl>
          </DetailSection>

          {entry.note ? (
            <DetailSection title="备注">
              <p className="text-gray-700">{entry.note}</p>
            </DetailSection>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}
