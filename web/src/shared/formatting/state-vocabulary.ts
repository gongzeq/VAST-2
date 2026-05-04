/**
 * Single source of truth mapping every backend enum value to its UI label and
 * tone. Components must import labels here rather than hardcode strings.
 */
import type {
  AssetDiscoveryState,
  ExecutionIntensity,
  TaskState,
} from '@/shared/contracts/foundation';
import type {
  TaskLifecycleStage,
  TaskStepExecutionStatus,
} from '@/shared/contracts/task-execution.contract';

export type Tone =
  | 'destructive'
  | 'warning'
  | 'caution'
  | 'positive'
  | 'muted'
  | 'info';

export interface VocabularyEntry {
  label: string;
  tone: Tone;
  description?: string;
}

export const taskStateVocabulary: Record<TaskState, VocabularyEntry> = {
  SUCCESS: { label: '成功', tone: 'positive' },
  PARTIAL_SUCCESS: { label: '部分成功', tone: 'caution' },
  FAILED: { label: '失败', tone: 'destructive' },
  NEEDS_CLARIFICATION: { label: '需要澄清', tone: 'warning' },
  BLOCKED: { label: '阻断', tone: 'destructive' },
  CANCELLED: { label: '已取消', tone: 'muted' },
};

export const taskLifecycleVocabulary: Record<TaskLifecycleStage, VocabularyEntry> = {
  CREATED: { label: '已创建', tone: 'muted' },
  AWAITING_CLARIFICATION: { label: '等待澄清', tone: 'warning' },
  AWAITING_CONFIRMATION: { label: '等待确认', tone: 'warning' },
  READY: { label: '就绪', tone: 'info' },
  RUNNING: { label: '执行中', tone: 'info' },
  FINISHED: { label: '已结束', tone: 'muted' },
};

export const stepStatusVocabulary: Record<TaskStepExecutionStatus, VocabularyEntry> = {
  PENDING: { label: '待执行', tone: 'muted' },
  SUCCESS: { label: '成功', tone: 'positive' },
  FAILED: { label: '失败', tone: 'destructive' },
  SKIPPED: { label: '已跳过', tone: 'muted' },
  CANCELLED: { label: '已取消', tone: 'muted' },
};

export const assetDiscoveryVocabulary: Record<AssetDiscoveryState, VocabularyEntry> = {
  DISCOVERED_PENDING_CONFIRMATION: { label: '待确认', tone: 'warning' },
  CONFIRMED: { label: '已确认', tone: 'positive' },
  REJECTED: { label: '已拒绝', tone: 'muted' },
  OUT_OF_SCOPE_DISCOVERED: {
    label: '超出授权范围',
    tone: 'destructive',
    description: '超出授权根域，不可纳入扫描范围',
  },
};

export const intensityVocabulary: Record<ExecutionIntensity, VocabularyEntry> = {
  LOW: { label: '低', tone: 'muted' },
  MEDIUM: { label: '中', tone: 'info' },
  HIGH: { label: '高', tone: 'destructive' },
};

export const yoloVocabulary: VocabularyEntry = {
  label: 'YOLO',
  tone: 'caution',
  description: '已开启 YOLO，授权范围内可跳过二次确认',
};

export const safeFallbackBadge: VocabularyEntry = {
  label: '未知状态',
  tone: 'muted',
  description: '后端返回未识别的枚举值',
};
