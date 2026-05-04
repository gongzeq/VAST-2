import type { ReactNode } from 'react';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** When provided, the error code is rendered explicitly. */
  errorCode?: string;
  action?: ReactNode;
}

export function ErrorState({
  title = '发生错误',
  description,
  errorCode,
  action,
}: ErrorStateProps) {
  return (
    <div
      className="rounded border border-red-200 bg-red-50 p-6"
      data-testid="error-state"
      role="alert"
    >
      <h3 className="text-base font-semibold text-red-800">{title}</h3>
      {description !== undefined ? (
        <p className="mt-1 text-sm text-red-700">{description}</p>
      ) : null}
      {errorCode !== undefined ? (
        <p className="mt-2 text-xs font-mono text-red-600">错误码：{errorCode}</p>
      ) : null}
      {action !== undefined ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
