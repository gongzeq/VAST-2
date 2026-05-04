import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { StatusBadge } from '@/shared/components/StatusBadge';

describe('<StatusBadge>', () => {
  it('renders task-state vocabulary label', () => {
    const { getByText } = render(<StatusBadge status={{ kind: 'task-state', value: 'BLOCKED' }} />);
    expect(getByText('阻断')).toBeInTheDocument();
  });

  it('renders YOLO label', () => {
    const { getByText } = render(<StatusBadge status={{ kind: 'yolo' }} />);
    expect(getByText('YOLO')).toBeInTheDocument();
  });

  it('uses destructive tone for BLOCKED', () => {
    const { container } = render(
      <StatusBadge status={{ kind: 'task-state', value: 'BLOCKED' }} />,
    );
    const span = container.querySelector('[data-tone="destructive"]');
    expect(span).not.toBeNull();
  });

  it('uses positive tone for SUCCESS', () => {
    const { container } = render(
      <StatusBadge status={{ kind: 'task-state', value: 'SUCCESS' }} />,
    );
    const span = container.querySelector('[data-tone="positive"]');
    expect(span).not.toBeNull();
  });

  it('renders out-of-scope description as title attribute', () => {
    const { container } = render(
      <StatusBadge status={{ kind: 'asset-discovery', value: 'OUT_OF_SCOPE_DISCOVERED' }} />,
    );
    const span = container.querySelector('[title]');
    expect(span?.getAttribute('title')).toMatch(/超出授权根域/);
  });
});
