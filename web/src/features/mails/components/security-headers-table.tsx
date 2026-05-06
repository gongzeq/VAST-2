/**
 * Renders mail security headers as a key/value table.
 *
 * Per R8 the four PRD-mandated security headers are pinned to the top in a
 * fixed order; the remaining headers are sorted alphabetically. The component
 * is a pure presenter — no fetching, no actor lookups.
 */

const PRIORITY_HEADERS = [
  'X-Security-Phishing',
  'X-Security-Risk-Score',
  'X-Security-Task-ID',
  'X-Security-Analysis',
] as const;

export interface SecurityHeadersTableProps {
  headers: Record<string, string>;
}

interface HeaderRow {
  key: string;
  value: string | null;
  priority: boolean;
}

export function buildSecurityHeaderRows(headers: Record<string, string>): HeaderRow[] {
  const rows: HeaderRow[] = [];
  for (const key of PRIORITY_HEADERS) {
    rows.push({ key, value: headers[key] ?? null, priority: true });
  }
  const remaining = Object.keys(headers)
    .filter((key) => !PRIORITY_HEADERS.includes(key as (typeof PRIORITY_HEADERS)[number]))
    .sort((a, b) => a.localeCompare(b));
  for (const key of remaining) {
    rows.push({ key, value: headers[key] ?? null, priority: false });
  }
  return rows;
}

export function SecurityHeadersTable({ headers }: SecurityHeadersTableProps) {
  const rows = buildSecurityHeaderRows(headers);

  return (
    <table className="w-full divide-y divide-gray-200 text-sm" data-testid="mail-security-headers-table">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-3 py-2 text-left">Header</th>
          <th className="px-3 py-2 text-left">值</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((row) => (
          <tr
            key={row.key}
            data-testid={`mail-security-header-${row.key}`}
            data-priority={row.priority ? 'true' : 'false'}
            className={row.priority ? 'bg-blue-50/40' : undefined}
          >
            <th scope="row" className="px-3 py-2 text-left font-mono text-xs text-gray-700">
              {row.key}
            </th>
            <td className="px-3 py-2 font-mono text-xs text-gray-900">
              {row.value === null ? <span className="text-gray-400">未应用</span> : row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
