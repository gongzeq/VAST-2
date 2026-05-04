import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ConfirmationDialog } from '@/shared/components/ConfirmationDialog';

describe('<ConfirmationDialog>', () => {
  it('does NOT trigger onConfirm when the cancel button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmationDialog
        open
        actionDescription="执行高强度扫描"
        targetScope="ag_corp_internal · 1 个 CIDR"
        riskLevelText="HIGH"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId('confirmation-cancel'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('triggers onConfirm only when explicit Confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmationDialog
        open
        actionDescription="执行高强度扫描"
        targetScope="ag_corp_internal · 1 个 CIDR"
        riskLevelText="HIGH"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId('confirmation-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('renders risk level as text rather than icon-only', () => {
    render(
      <ConfirmationDialog
        open
        actionDescription="action"
        targetScope="scope"
        riskLevelText="HIGH"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    const { container } = render(
      <ConfirmationDialog
        open={false}
        actionDescription="x"
        targetScope="x"
        riskLevelText="HIGH"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
