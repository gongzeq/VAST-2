import { Button } from '@/shared/components';

export interface YoloToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  /** Disabled when the actor lacks task:yolo_execute. */
  disabled?: boolean;
  /** Reason rendered below when disabled. */
  disabledReason?: string;
}

export function YoloToggle({ value, onChange, disabled, disabledReason }: YoloToggleProps) {
  return (
    <div className="flex flex-col gap-1" data-testid="yolo-toggle">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={value ? 'destructive' : 'secondary'}
          size="sm"
          onClick={() => onChange(!value)}
          disabled={disabled}
          aria-pressed={value}
          data-testid="yolo-toggle-button"
        >
          YOLO {value ? '已开启' : '关闭'}
        </Button>
        <span className="text-xs text-gray-500">
          授权范围内可跳过二次确认；高强度任务仍强制确认
        </span>
      </div>
      {disabled && disabledReason ? (
        <p className="text-xs text-amber-700">{disabledReason}</p>
      ) : null}
    </div>
  );
}
