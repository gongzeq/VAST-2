import type { AssetWhitelistEntry } from '@/shared/contracts';

export interface WhitelistEntryListProps {
  entries: AssetWhitelistEntry[];
}

export function WhitelistEntryList({ entries }: WhitelistEntryListProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500" data-testid="whitelist-empty">
        无白名单条目
      </p>
    );
  }
  return (
    <ul className="space-y-1" data-testid="whitelist-entry-list">
      {entries.map((entry, idx) => (
        <li
          key={`${entry.kind}_${idx}`}
          className="flex items-center justify-between rounded border border-gray-200 bg-white px-2 py-1 text-sm"
          data-testid={`whitelist-entry-${idx}`}
        >
          <span className="font-mono text-xs text-gray-500">{entry.kind}</span>
          {entry.kind === 'root_domain' ? (
            <span>
              {entry.rootDomain}
              {entry.allowSubdomains ? '（含子域）' : ''}
            </span>
          ) : null}
          {entry.kind === 'cidr' ? <span>{entry.cidr}</span> : null}
          {entry.kind === 'ip' ? <span>{entry.ip}</span> : null}
        </li>
      ))}
    </ul>
  );
}
