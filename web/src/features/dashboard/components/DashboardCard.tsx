/**
 * Shared frame for every dashboard category card.
 *
 * Layout:
 *   ┌────────────────────────────────────────┐
 *   │ Title              [optional badge]    │
 *   │ Text summary (1–2 sentences)           │
 *   │ ┌────── children (metric body) ──────┐ │
 *   │ └─────────────────────────────────────┘ │
 *   │                          查看详情 →     │
 *   └────────────────────────────────────────┘
 *
 * The text summary is mandatory — the dashboard PRD R2 + component-guidelines
 * forbid chart-only signaling.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Card, CardBody, CardHeader, CardTitle } from '@/shared/components';

export interface DashboardCardProps {
  title: string;
  /** 1–2 sentence Chinese text summary. Required. */
  summary: string;
  /** Detail link target; rendered as "查看详情 →" at the bottom-right. */
  detailHref: string;
  /** Optional accessory shown on the right of the title (e.g. spike badge). */
  titleAccessory?: ReactNode;
  children?: ReactNode;
}

export function DashboardCard({
  title,
  summary,
  detailHref,
  titleAccessory,
  children,
}: DashboardCardProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {titleAccessory}
      </CardHeader>
      <CardBody className="flex-1 space-y-3">
        <p className="text-sm leading-relaxed text-gray-700" data-testid="dashboard-card-summary">
          {summary}
        </p>
        {children !== undefined ? (
          <div className="text-sm text-gray-700">{children}</div>
        ) : null}
      </CardBody>
      <div className="mt-3 text-right">
        <Link
          to={detailHref}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          查看详情 →
        </Link>
      </div>
    </Card>
  );
}
