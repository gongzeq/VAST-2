/**
 * Discriminated dispatcher for the 7 dashboard categories.
 *
 * Centralises the `kind` switch so the page composition stays a flat
 * `categories.map(...)`. New categories are additive: TS exhaustiveness in
 * the switch points at every consumer if the union grows.
 */
import type { DashboardCategory } from '@/shared/contracts/dashboard-summary.contract';

import { AssetMetricsCard } from './AssetMetricsCard';
import { LogAttackMetricsCard } from './LogAttackMetricsCard';
import { MailMetricsCard } from './MailMetricsCard';
import { TaskMetricsCard } from './TaskMetricsCard';
import { VulnerabilityMetricsCard } from './VulnerabilityMetricsCard';
import { WeakPasswordMetricsCard } from './WeakPasswordMetricsCard';
import { YoloMetricsCard } from './YoloMetricsCard';

export interface DashboardCategoryDispatcherProps {
  category: DashboardCategory;
}

export function DashboardCategoryDispatcher({ category }: DashboardCategoryDispatcherProps) {
  switch (category.kind) {
    case 'task':
      return <TaskMetricsCard metrics={category} />;
    case 'asset':
      return <AssetMetricsCard metrics={category} />;
    case 'vulnerability':
      return <VulnerabilityMetricsCard metrics={category} />;
    case 'weak-password':
      return <WeakPasswordMetricsCard metrics={category} />;
    case 'mail':
      return <MailMetricsCard metrics={category} />;
    case 'yolo':
      return <YoloMetricsCard metrics={category} />;
    case 'log-attack':
      return <LogAttackMetricsCard metrics={category} />;
  }
}
