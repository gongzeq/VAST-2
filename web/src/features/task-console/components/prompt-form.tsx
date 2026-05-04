import { useState, type FormEvent } from 'react';

import { Button, Textarea } from '@/shared/components';

export interface PromptFormProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  /** When `disabled` and this is set, the disabled reason is rendered. */
  disabledReason?: string;
  pending?: boolean;
  initialPrompt?: string;
}

export function PromptForm({
  onSubmit,
  disabled,
  disabledReason,
  pending,
  initialPrompt = '',
}: PromptFormProps) {
  const [prompt, setPrompt] = useState(initialPrompt);

  const handle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <form onSubmit={handle} className="flex flex-col gap-3" data-testid="prompt-form">
      <Textarea
        rows={3}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="例如：扫描资产组 ag_corp_public 的子域并做存活探测"
        disabled={disabled || pending}
        data-testid="prompt-input"
      />
      <div className="flex items-center justify-between gap-3">
        {disabled && disabledReason ? (
          <p className="text-sm text-amber-700" data-testid="prompt-disabled-reason">
            {disabledReason}
          </p>
        ) : (
          <span aria-hidden="true" />
        )}
        <Button
          type="submit"
          disabled={disabled || pending || !prompt.trim()}
          data-testid="prompt-submit"
        >
          {pending ? '解析中…' : '提交意图'}
        </Button>
      </div>
    </form>
  );
}
