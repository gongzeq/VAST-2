import { useState } from 'react';

const DEFAULT_VISIBLE = 5;

export interface RecipientListProps {
  recipients: string[];
  /** Initial visible threshold; recipients beyond this collapse behind a button. */
  visible?: number;
}

/**
 * Detail-page recipient list. List page uses a separate inline preview helper
 * (formatRecipientsPreview) to avoid stateful expansion in table rows.
 */
export function RecipientList({ recipients, visible = DEFAULT_VISIBLE }: RecipientListProps) {
  const [expanded, setExpanded] = useState(false);
  if (recipients.length === 0) {
    return <span className="text-gray-500">(无收件人)</span>;
  }
  const showAll = expanded || recipients.length <= visible;
  const shownItems = showAll ? recipients : recipients.slice(0, visible);
  return (
    <div className="space-y-1" data-testid="mail-recipient-list">
      <ul className="font-mono text-sm text-gray-800">
        {shownItems.map((recipient) => (
          <li key={recipient}>{recipient}</li>
        ))}
      </ul>
      {recipients.length > visible ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs text-blue-700 hover:underline"
          data-testid="mail-recipient-toggle"
        >
          {expanded
            ? `收起（共 ${recipients.length} 人）`
            : `展开剩余 ${recipients.length - visible} 人`}
        </button>
      ) : null}
    </div>
  );
}
