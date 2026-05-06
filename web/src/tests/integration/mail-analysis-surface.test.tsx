import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import { db } from '@/app/msw/db';
import { MailListPage } from '@/features/mails/routes/mail-list-page';
import { MailDetailPage } from '@/features/mails/routes/mail-detail-page';

import { fixtureActor, renderWithProviders } from '../test-utils';

function renderMailRoutes(initialEntries: string[]) {
  return renderWithProviders(
    <Routes>
      <Route path="/mails" element={<MailListPage />} />
      <Route path="/mails/:mailTaskId" element={<MailDetailPage />} />
    </Routes>,
    {
      initialActor: fixtureActor.securityEngineer(),
      initialEntries,
    },
  );
}

describe('integration: mail-analysis surface', () => {
  it('list renders the seeded mail records for a security-engineer', async () => {
    db().actor = fixtureActor.securityEngineer();
    renderMailRoutes(['/mails']);

    await waitFor(() => {
      expect(screen.getByTestId('mail-table-body')).toBeInTheDocument();
    });
    expect(screen.getByTestId('mail-row-mail_suspected_demo')).toBeInTheDocument();
    expect(screen.getByTestId('mail-row-mail_clean_demo')).toBeInTheDocument();
    expect(screen.getByTestId('mail-row-mail_unavailable_demo')).toBeInTheDocument();
  });

  it('UNAVAILABLE row shows "—" + analysis-mode badge instead of a "clean" badge', async () => {
    db().actor = fixtureActor.securityEngineer();
    renderMailRoutes(['/mails']);

    await waitFor(() => {
      expect(screen.getByTestId('mail-row-mail_unavailable_demo')).toBeInTheDocument();
    });
    const row = screen.getByTestId('mail-row-mail_unavailable_demo');
    expect(within(row).getByTestId('mail-phishing-cell-null')).toBeInTheDocument();
    // No "clean" / "suspected" / "suspicious" label on this row.
    expect(within(row).queryByText(/疑似钓鱼/)).toBeNull();
    expect(within(row).queryByText(/^清洁$/)).toBeNull();
  });

  it('null subject and null sender render explicit Chinese fallbacks (R4)', async () => {
    db().actor = fixtureActor.securityEngineer();
    renderMailRoutes(['/mails']);

    await waitFor(() => {
      expect(screen.getByTestId('mail-row-mail_unavailable_demo')).toBeInTheDocument();
    });
    const row = screen.getByTestId('mail-row-mail_unavailable_demo');
    expect(within(row).getByText('(无主题)')).toBeInTheDocument();
    expect(within(row).getByText('(发件人未识别)')).toBeInTheDocument();
  });

  it('filtering by phishingLabel=suspected updates the URL and result set', async () => {
    db().actor = fixtureActor.securityEngineer();
    const user = userEvent.setup();
    renderMailRoutes(['/mails']);

    await waitFor(() => {
      expect(screen.getByTestId('mail-table-body')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByTestId('mail-filter-phishing-label'), 'suspected');

    await waitFor(() => {
      expect(screen.getByTestId('mail-row-mail_suspected_demo')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('mail-row-mail_clean_demo')).toBeNull();
  });

  it('filter persists across remount via URL params', async () => {
    db().actor = fixtureActor.securityEngineer();
    renderMailRoutes(['/mails?phishingLabel=suspected']);

    await waitFor(() => {
      expect(screen.getByTestId('mail-row-mail_suspected_demo')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('mail-row-mail_clean_demo')).toBeNull();
  });

  it('long recipient lists collapse to "+N more" in the list cell', async () => {
    db().actor = fixtureActor.securityEngineer();
    renderMailRoutes(['/mails']);

    await waitFor(() => {
      expect(screen.getByTestId('mail-row-mail_suspected_demo')).toBeInTheDocument();
    });
    const row = screen.getByTestId('mail-row-mail_suspected_demo');
    // Suspected demo has 4 recipients; preview shows 3 + "+1 more".
    expect(within(row).getByTestId('mail-recipients-more')).toHaveTextContent('+1 more');
  });

  it('detail page renders the UNAVAILABLE banner without IOC card or risk-score card', async () => {
    db().actor = fixtureActor.securityEngineer();
    renderMailRoutes(['/mails/mail_unavailable_demo']);

    await waitFor(() => {
      expect(screen.getByTestId('mail-status-banner-unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('mail-risk-score-card')).toBeNull();
    expect(screen.queryByTestId('mail-ioc-card')).toBeNull();
    // Attachment table renders as the "unavailable" notice.
    expect(screen.getByTestId('mail-attachment-analysis-unavailable')).toBeInTheDocument();
  });

  it('detail page renders the BODY_ONLY_SIZE_LIMIT banner with skipped attachment row', async () => {
    db().actor = fixtureActor.securityEngineer();
    renderMailRoutes(['/mails/mail_oversize_demo']);

    await waitFor(() => {
      expect(screen.getByTestId('mail-status-banner-body-only')).toBeInTheDocument();
    });
    expect(screen.getByTestId('attachment-analyzed-false')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-skipped-reason')).toHaveTextContent(
      '邮件超 50MB 上限',
    );
  });

  it('detail page renders all blocks for an ANALYZED + FULL mail', async () => {
    db().actor = fixtureActor.securityEngineer();
    renderMailRoutes(['/mails/mail_suspected_demo']);

    await waitFor(() => {
      expect(screen.getByTestId('mail-risk-score-card')).toBeInTheDocument();
    });
    expect(screen.getByTestId('mail-ioc-card')).toBeInTheDocument();
    expect(screen.getByTestId('mail-attachment-analysis-table')).toBeInTheDocument();
    expect(screen.getByTestId('mail-security-headers-table')).toBeInTheDocument();
    expect(screen.getByTestId('mail-body-sha256')).toHaveTextContent(/[0-9a-f]+/);
  });

  it('returns to list with filter preserved after detail navigation', async () => {
    db().actor = fixtureActor.securityEngineer();
    const user = userEvent.setup();
    // Step 1: render list with filter applied via URL.
    const { unmount } = renderMailRoutes(['/mails?phishingLabel=suspected']);

    await waitFor(() => {
      expect(screen.getByTestId('mail-row-mail_suspected_demo')).toBeInTheDocument();
    });

    // Step 2: click into detail.
    await user.click(
      within(screen.getByTestId('mail-row-mail_suspected_demo')).getByRole('link'),
    );
    await waitFor(() => {
      expect(screen.getByTestId('mail-risk-score-card')).toBeInTheDocument();
    });

    unmount();

    // Step 3: re-mount as if the user pressed Back into the same filtered URL.
    // This proves URL state alone (no in-memory leftovers) is sufficient to
    // restore the filtered list — i.e. the filter is shareable and survives
    // navigation history.
    renderMailRoutes(['/mails?phishingLabel=suspected']);

    await waitFor(() => {
      expect(screen.getByTestId('mail-row-mail_suspected_demo')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('mail-row-mail_clean_demo')).toBeNull();
  });
});
