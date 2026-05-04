import type { TaskClarification } from '@/shared/contracts';
import { Button, Input } from '@/shared/components';
import { useState } from 'react';

export interface ClarificationListProps {
  questions: TaskClarification[];
  /**
   * Called when the user submits an answer for a single question.
   * Component does not manage server state itself.
   */
  onAnswer: (clarificationId: string, answer: string) => void;
  /** Disable inputs while the network request is in flight. */
  pending?: boolean;
}

export function ClarificationList({
  questions,
  onAnswer,
  pending,
}: ClarificationListProps) {
  if (questions.length === 0) {
    return (
      <p className="text-sm text-gray-500" data-testid="clarification-empty">
        没有等待回答的澄清问题。
      </p>
    );
  }

  return (
    <ul className="space-y-3" data-testid="clarification-list">
      {questions.map((q) => (
        <ClarificationRow
          key={q.clarificationId}
          question={q}
          onAnswer={onAnswer}
          pending={pending}
        />
      ))}
    </ul>
  );
}

interface RowProps {
  question: TaskClarification;
  onAnswer: (clarificationId: string, answer: string) => void;
  pending?: boolean;
}

function ClarificationRow({ question, onAnswer, pending }: RowProps) {
  const [text, setText] = useState(question.answer ?? '');
  const answered = question.answeredAt !== null;
  return (
    <li
      className="rounded border border-gray-200 bg-white p-3"
      data-testid={`clarification-${question.clarificationId}`}
      data-answered={answered ? 'true' : 'false'}
    >
      <p className="text-sm font-medium text-gray-900">{question.question}</p>
      {answered ? (
        <p
          className="mt-2 rounded bg-emerald-50 p-2 text-sm text-emerald-800"
          data-testid={`clarification-answer-${question.clarificationId}`}
        >
          已回答：{question.answer}
        </p>
      ) : (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!text.trim()) return;
            onAnswer(question.clarificationId, text.trim());
          }}
        >
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="请输入澄清答案"
            disabled={pending}
            data-testid={`clarification-input-${question.clarificationId}`}
          />
          <Button
            type="submit"
            disabled={pending || !text.trim()}
            data-testid={`clarification-submit-${question.clarificationId}`}
          >
            提交
          </Button>
        </form>
      )}
    </li>
  );
}
