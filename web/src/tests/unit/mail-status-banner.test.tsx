import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MailStatusBanner } from '@/features/mails/components/mail-status-banner';

describe('MailStatusBanner', () => {
  it('returns null when analysis succeeded with FULL mode', () => {
    const { container } = render(
      <MailStatusBanner
        analysisStatus="ANALYZED"
        analysisMode="FULL"
        unavailableReason={null}
        messageSizeBytes={1024}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the destructive banner for UNAVAILABLE with the unavailableReason', () => {
    render(
      <MailStatusBanner
        analysisStatus="UNAVAILABLE"
        analysisMode="UNAVAILABLE"
        unavailableReason="分析服务暂时不可达"
        messageSizeBytes={1024}
      />,
    );
    expect(screen.getByTestId('mail-status-banner-unavailable')).toBeInTheDocument();
    expect(screen.getByText('分析服务暂时不可达')).toBeInTheDocument();
  });

  it('renders the warning banner for BODY_ONLY_SIZE_LIMIT showing message size', () => {
    render(
      <MailStatusBanner
        analysisStatus="ANALYZED"
        analysisMode="BODY_ONLY_SIZE_LIMIT"
        unavailableReason={null}
        messageSizeBytes={60 * 1024 * 1024}
      />,
    );
    expect(screen.getByTestId('mail-status-banner-body-only')).toBeInTheDocument();
    expect(screen.getByText(/60.0 MB/)).toBeInTheDocument();
  });

  it('UNAVAILABLE takes precedence over BODY_ONLY_SIZE_LIMIT', () => {
    // Defensive: even if backend ever combined the two, the analyst should see UNAVAILABLE first.
    render(
      <MailStatusBanner
        analysisStatus="UNAVAILABLE"
        analysisMode="BODY_ONLY_SIZE_LIMIT"
        unavailableReason={null}
        messageSizeBytes={60 * 1024 * 1024}
      />,
    );
    expect(screen.getByTestId('mail-status-banner-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('mail-status-banner-body-only')).toBeNull();
  });
});
