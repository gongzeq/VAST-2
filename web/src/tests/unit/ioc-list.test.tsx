import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { groupIocs, IocList } from '@/features/mails/components/ioc-list';

describe('IocList / groupIocs', () => {
  it('renders explicit empty state when iocs are empty', () => {
    render(<IocList iocs={[]} />);
    expect(screen.getByTestId('mail-ioc-empty')).toBeInTheDocument();
    expect(screen.getByText('未提取到 IOC。')).toBeInTheDocument();
  });

  it('groups iocs by kind, preserving insertion order within each section', () => {
    const grouped = groupIocs([
      { kind: 'URL', value: 'https://a.example.com/1' },
      { kind: 'DOMAIN', value: 'a.example.com' },
      { kind: 'URL', value: 'https://a.example.com/2' },
      { kind: 'IP', value: '203.0.113.1' },
      { kind: 'EMAIL', value: 'phish@example.com' },
    ]);
    expect(grouped.URL).toEqual([
      'https://a.example.com/1',
      'https://a.example.com/2',
    ]);
    expect(grouped.DOMAIN).toEqual(['a.example.com']);
    expect(grouped.IP).toEqual(['203.0.113.1']);
    expect(grouped.EMAIL).toEqual(['phish@example.com']);
  });

  it('renders sections only for non-empty kinds', () => {
    render(
      <IocList
        iocs={[
          { kind: 'DOMAIN', value: 'a.example.com' },
          { kind: 'IP', value: '203.0.113.1' },
        ]}
      />,
    );
    expect(screen.getByTestId('mail-ioc-section-DOMAIN')).toBeInTheDocument();
    expect(screen.getByTestId('mail-ioc-section-IP')).toBeInTheDocument();
    expect(screen.queryByTestId('mail-ioc-section-URL')).toBeNull();
    expect(screen.queryByTestId('mail-ioc-section-EMAIL')).toBeNull();
  });
});
