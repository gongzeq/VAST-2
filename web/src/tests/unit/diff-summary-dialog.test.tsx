/**
 * PR4 unit tests: diff-summary-dialog buildDiffEntries.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  DiffSummaryDialog,
  buildDiffEntries,
} from '@/features/admin-settings/components/_shared';

describe('buildDiffEntries', () => {
  it('returns empty array when before/after are equal', () => {
    expect(buildDiffEntries({ name: 'x', port: 80 }, { name: 'x', port: 80 })).toEqual([]);
  });

  it('marks added keys as kind=added', () => {
    const entries = buildDiffEntries({}, { name: 'new' });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ key: 'name', after: 'new', kind: 'added' });
  });

  it('marks removed keys as kind=removed', () => {
    const entries = buildDiffEntries({ name: 'old' }, {});
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ key: 'name', before: 'old', kind: 'removed' });
  });

  it('marks changed keys as kind=changed', () => {
    const entries = buildDiffEntries({ port: 80 }, { port: 8080 });
    expect(entries).toEqual([
      { key: 'port', before: '80', after: '8080', kind: 'changed' },
    ]);
  });

  it('handles arrays via comma join', () => {
    const entries = buildDiffEntries({ purposes: ['a'] }, { purposes: ['a', 'b'] });
    expect(entries).toEqual([
      { key: 'purposes', before: 'a', after: 'a, b', kind: 'changed' },
    ]);
  });
});

describe('DiffSummaryDialog', () => {
  it('disables the confirm button when there are no changes', () => {
    render(
      <DiffSummaryDialog
        open
        title="保存"
        entries={[]}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    const confirm = screen.getByTestId('diff-summary-confirm');
    expect(confirm).toBeDisabled();
    expect(screen.getByText('没有修改任何字段。')).toBeInTheDocument();
  });

  it('renders entries and calls onConfirm only when clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DiffSummaryDialog
        open
        title="保存"
        entries={[{ key: 'name', before: 'a', after: 'b', kind: 'changed' }]}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByTestId('diff-entry-name')).toBeInTheDocument();
    await user.click(screen.getByTestId('diff-summary-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('diff-summary-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
