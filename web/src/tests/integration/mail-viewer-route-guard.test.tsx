import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { db } from '@/app/msw/db';
import { MailListPage } from '@/features/mails/routes/mail-list-page';
import { MailDetailPage } from '@/features/mails/routes/mail-detail-page';
import { useCanViewRawEvidence } from '@/shared/hooks/use-can';

import { fixtureActor, renderWithProviders } from '../test-utils';

function RequireRawEvidence() {
  const canViewRawEvidence = useCanViewRawEvidence();
  if (!canViewRawEvidence) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

function MailRoutesWithGuard() {
  return (
    <Routes>
      <Route path="/" element={<div data-testid="home-marker">主页</div>} />
      <Route element={<RequireRawEvidence />}>
        <Route path="/mails" element={<MailListPage />} />
        <Route path="/mails/:mailTaskId" element={<MailDetailPage />} />
      </Route>
    </Routes>
  );
}

describe('integration: mail viewer route-level guard (R5)', () => {
  it('viewer requesting /mails is redirected to /', async () => {
    db().actor = fixtureActor.viewer();
    renderWithProviders(<MailRoutesWithGuard />, {
      initialActor: fixtureActor.viewer(),
      initialEntries: ['/mails'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('home-marker')).toBeInTheDocument();
    });
    // Mail list never renders.
    expect(screen.queryByTestId('mail-table-body')).toBeNull();
  });

  it('viewer requesting /mails/:mailTaskId is redirected to /', async () => {
    db().actor = fixtureActor.viewer();
    renderWithProviders(<MailRoutesWithGuard />, {
      initialActor: fixtureActor.viewer(),
      initialEntries: ['/mails/mail_suspected_demo'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('home-marker')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('mail-status-banner-unavailable')).toBeNull();
    expect(screen.queryByTestId('mail-risk-score-card')).toBeNull();
  });

  it('auditor (with raw_evidence:view) reaches the list', async () => {
    db().actor = fixtureActor.auditor();
    renderWithProviders(<MailRoutesWithGuard />, {
      initialActor: fixtureActor.auditor(),
      initialEntries: ['/mails'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('mail-table-body')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('home-marker')).toBeNull();
  });
});
