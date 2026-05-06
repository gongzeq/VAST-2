/**
 * Generic two-step confirmation dialog for admin mutations.
 *
 * Layout:
 *   1. Renders the diff entries (key, before, after) above an explicit
 *      Cancel / Confirm pair.
 *   2. Cancel / Esc must not invoke onConfirm — same contract as
 *      `<ConfirmationDialog>`.
 */
import { Button } from '@/shared/components/Button';
import { Dialog } from '@/shared/components/Dialog';

export interface DiffEntry {
  key: string;
  before: string;
  after: string;
  /** Mark a change as "added" (no before value) or "removed" (no after). */
  kind?: 'added' | 'changed' | 'removed';
}

export interface DiffSummaryDialogProps {
  open: boolean;
  title: string;
  description?: string;
  entries: DiffEntry[];
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function DiffSummaryDialog({
  open,
  title,
  description,
  entries,
  onConfirm,
  onCancel,
  confirmLabel = '保存修改',
  cancelLabel = '取消',
}: DiffSummaryDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} title={title} description={description}>
      <div data-testid="diff-summary-dialog" className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">没有修改任何字段。</p>
        ) : (
          <table className="w-full table-fixed text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1 text-left font-medium text-gray-600">字段</th>
                <th className="px-2 py-1 text-left font-medium text-gray-600">修改前</th>
                <th className="px-2 py-1 text-left font-medium text-gray-600">修改后</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.key} data-testid={`diff-entry-${entry.key}`}>
                  <td className="px-2 py-1 font-mono text-gray-700">{entry.key}</td>
                  <td className="px-2 py-1 font-mono text-gray-500">
                    {entry.kind === 'added' ? '（新增）' : entry.before}
                  </td>
                  <td className="px-2 py-1 font-mono text-gray-900">
                    {entry.kind === 'removed' ? '（移除）' : entry.after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onCancel} data-testid="diff-summary-cancel">
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={entries.length === 0}
            data-testid="diff-summary-confirm"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Compute diff entries for a flat object pair. Arrays are stringified. */
export function buildDiffEntries(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): DiffEntry[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: DiffEntry[] = [];
  for (const key of keys) {
    const beforeValue = before[key];
    const afterValue = after[key];
    const beforeStr = stringifyValue(beforeValue);
    const afterStr = stringifyValue(afterValue);
    if (beforeStr === afterStr) continue;
    if (beforeValue === undefined) {
      out.push({ key, before: '', after: afterStr, kind: 'added' });
    } else if (afterValue === undefined) {
      out.push({ key, before: beforeStr, after: '', kind: 'removed' });
    } else {
      out.push({ key, before: beforeStr, after: afterStr, kind: 'changed' });
    }
  }
  return out;
}

function stringifyValue(value: unknown): string {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
