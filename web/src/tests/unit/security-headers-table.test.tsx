import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  SecurityHeadersTable,
  buildSecurityHeaderRows,
} from '@/features/mails/components/security-headers-table';

const PRIORITY = [
  'X-Security-Phishing',
  'X-Security-Risk-Score',
  'X-Security-Task-ID',
  'X-Security-Analysis',
];

describe('SecurityHeadersTable / buildSecurityHeaderRows', () => {
  it('R8: prioritises the four PRD-mandated headers in fixed order', () => {
    const rows = buildSecurityHeaderRows({
      'X-Spamcop-Score': '4',
      'X-Security-Analysis': 'ok',
      'X-Security-Phishing': 'clean',
      'X-Security-Task-ID': 'mail_x',
      'X-Other': 'foo',
      'X-Security-Risk-Score': '5',
    });
    const priorityKeys = rows.filter((row) => row.priority).map((row) => row.key);
    expect(priorityKeys).toEqual(PRIORITY);
  });

  it('R8: remaining headers are sorted alphabetically after the four priorities', () => {
    const rows = buildSecurityHeaderRows({
      'X-Z-Other': 'z',
      'X-Security-Analysis': 'ok',
      'X-A-Other': 'a',
      'X-Security-Phishing': 'clean',
      'X-Security-Risk-Score': '5',
      'X-Security-Task-ID': 'mail_x',
      'X-M-Other': 'm',
    });
    const nonPriorityKeys = rows.filter((row) => !row.priority).map((row) => row.key);
    expect(nonPriorityKeys).toEqual(['X-A-Other', 'X-M-Other', 'X-Z-Other']);
  });

  it('renders priority rows even when missing from the payload, with explicit "未应用"', () => {
    render(
      <SecurityHeadersTable
        headers={{ 'X-Security-Task-ID': 'mail_z' }}
      />,
    );
    expect(screen.getByTestId('mail-security-header-X-Security-Phishing')).toBeInTheDocument();
    // Phishing not provided → rendered with "未应用".
    const phishingRow = screen.getByTestId('mail-security-header-X-Security-Phishing');
    expect(phishingRow).toHaveTextContent('未应用');
    // Task ID is provided.
    expect(
      screen.getByTestId('mail-security-header-X-Security-Task-ID'),
    ).toHaveTextContent('mail_z');
  });
});
