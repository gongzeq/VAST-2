import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      className="rounded border border-dashed border-gray-300 bg-white p-8 text-center"
      data-testid="empty-state"
      role="status"
    >
      <h3 className="text-base font-medium text-gray-700">{title}</h3>
      {description !== undefined ? (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      ) : null}
      {action !== undefined ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
