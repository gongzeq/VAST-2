import type { ReactNode } from 'react';

import {
  type AssetDiscoveryState,
  type ExecutionIntensity,
  type TaskState,
} from '@/shared/contracts/foundation';
import type {
  TaskLifecycleStage,
  TaskStepExecutionStatus,
} from '@/shared/contracts/task-execution.contract';
import type {
  SeverityLevel,
  VulnerabilityStatus,
} from '@/shared/contracts/vulnerability.contract';
import type { AuditOutcome } from '@/shared/contracts/audit-log.contract';
import type {
  AdminEntityStatus,
  KillSwitchStatus,
  LogSourceHealth,
} from '@/shared/contracts/admin-config.contract';
import type {
  MailAnalysisMode,
  PhishingLabel,
} from '@/shared/contracts/mail-analysis.contract';
import {
  adminEntityStatusVocabulary,
  assetDiscoveryVocabulary,
  auditOutcomeVocabulary,
  intensityVocabulary,
  killSwitchStatusVocabulary,
  logSourceHealthVocabulary,
  mailAnalysisModeVocabulary,
  phishingLabelVocabulary,
  safeFallbackBadge,
  severityVocabulary,
  stepStatusVocabulary,
  taskLifecycleVocabulary,
  taskStateVocabulary,
  vulnerabilityScanStatusVocabulary,
  type VulnerabilityScanResultStatus,
  vulnerabilityStatusVocabulary,
  type Tone,
  type VocabularyEntry,
  yoloVocabulary,
} from '@/shared/formatting/state-vocabulary';

import { cn } from './class-names';

const TONE_CLASS: Record<Tone, string> = {
  destructive: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  caution: 'bg-orange-50 text-orange-700 border-orange-200',
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  muted: 'bg-gray-100 text-gray-700 border-gray-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};

export type StatusBadgeKind =
  | { kind: 'task-state'; value: TaskState }
  | { kind: 'task-lifecycle'; value: TaskLifecycleStage }
  | { kind: 'step-status'; value: TaskStepExecutionStatus }
  | { kind: 'asset-discovery'; value: AssetDiscoveryState }
  | { kind: 'intensity'; value: ExecutionIntensity }
  | { kind: 'severity'; value: SeverityLevel }
  | { kind: 'vulnerability-status'; value: VulnerabilityStatus }
  | { kind: 'vulnerability-scan-status'; value: VulnerabilityScanResultStatus }
  | { kind: 'audit-outcome'; value: AuditOutcome }
  | { kind: 'kill-switch'; value: KillSwitchStatus }
  | { kind: 'admin-status'; value: AdminEntityStatus }
  | { kind: 'log-source-health'; value: LogSourceHealth }
  | { kind: 'phishing-label'; value: PhishingLabel }
  | { kind: 'mail-analysis-mode'; value: MailAnalysisMode }
  | { kind: 'yolo' };

export interface StatusBadgeProps {
  /**
   * Discriminated kind drives the vocabulary lookup. Pass the exact backend
   * enum value; rendering tone + label come from `state-vocabulary.ts`.
   */
  status: StatusBadgeKind;
  /** Optional rendered children (suffix text). */
  children?: ReactNode;
  className?: string;
}

function entryFor(status: StatusBadgeKind): VocabularyEntry {
  switch (status.kind) {
    case 'task-state':
      return taskStateVocabulary[status.value] ?? safeFallbackBadge;
    case 'task-lifecycle':
      return taskLifecycleVocabulary[status.value] ?? safeFallbackBadge;
    case 'step-status':
      return stepStatusVocabulary[status.value] ?? safeFallbackBadge;
    case 'asset-discovery':
      return assetDiscoveryVocabulary[status.value] ?? safeFallbackBadge;
    case 'intensity':
      return intensityVocabulary[status.value] ?? safeFallbackBadge;
    case 'severity':
      return severityVocabulary[status.value] ?? safeFallbackBadge;
    case 'vulnerability-status':
      return vulnerabilityStatusVocabulary[status.value] ?? safeFallbackBadge;
    case 'vulnerability-scan-status':
      return vulnerabilityScanStatusVocabulary[status.value] ?? safeFallbackBadge;
    case 'audit-outcome':
      return auditOutcomeVocabulary[status.value] ?? safeFallbackBadge;
    case 'kill-switch':
      return killSwitchStatusVocabulary[status.value] ?? safeFallbackBadge;
    case 'admin-status':
      return adminEntityStatusVocabulary[status.value] ?? safeFallbackBadge;
    case 'log-source-health':
      return logSourceHealthVocabulary[status.value] ?? safeFallbackBadge;
    case 'phishing-label':
      return phishingLabelVocabulary[status.value] ?? safeFallbackBadge;
    case 'mail-analysis-mode':
      return mailAnalysisModeVocabulary[status.value] ?? safeFallbackBadge;
    case 'yolo':
      return yoloVocabulary;
  }
}

export function StatusBadge({ status, className, children }: StatusBadgeProps) {
  const entry = entryFor(status);
  return (
    <span
      data-tone={entry.tone}
      className={cn(
        'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium',
        TONE_CLASS[entry.tone],
        className,
      )}
      title={entry.description ?? entry.label}
    >
      <span aria-hidden="true">●</span>
      <span>{entry.label}</span>
      {children}
    </span>
  );
}
