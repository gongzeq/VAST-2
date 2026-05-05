import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DashboardPage } from '@/features/dashboard/routes/dashboard-page';
import { db } from '@/app/msw/db';

import { renderWithProviders, fixtureActor } from '../test-utils';

describe('integration: dashboard page', () => {
  it('renders the 7 metric cards once the summary loads', async () => {
    db().actor = fixtureActor.admin();
    renderWithProviders(<DashboardPage />, {
      initialActor: fixtureActor.admin(),
      initialEntries: ['/dashboard'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();
    });

    const titles = [
      '任务态势',
      '资产态势',
      '漏洞态势',
      '弱口令态势',
      '钓鱼邮件态势',
      'YOLO·智能体态势',
      '日志攻击态势',
    ];
    titles.forEach((title) => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });

  it('shows UnauthorizedState when scope=global and the actor lacks asset_scope:manage', async () => {
    db().actor = fixtureActor.securityEngineer();
    renderWithProviders(<DashboardPage />, {
      initialActor: fixtureActor.securityEngineer(),
      initialEntries: ['/dashboard?scope=global'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('unauthorized-state')).toBeInTheDocument();
    });
    expect(
      screen.getByText('无权查看全局视图', { selector: 'h3' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-grid')).toBeNull();
  });

  it('changing scope to "全局视图" updates the URL (admin actor)', async () => {
    db().actor = fixtureActor.admin();
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />, {
      initialActor: fixtureActor.admin(),
      initialEntries: ['/dashboard'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();
    });

    const scopeSelect = screen.getByLabelText('仪表盘范围') as HTMLSelectElement;
    await user.selectOptions(scopeSelect, 'global');

    await waitFor(() => {
      expect(scopeSelect.value).toBe('global');
    });
  });

  it('hides the global scope option for actors without asset_scope:manage', () => {
    db().actor = fixtureActor.securityEngineer();
    renderWithProviders(<DashboardPage />, {
      initialActor: fixtureActor.securityEngineer(),
      initialEntries: ['/dashboard'],
    });

    const scopeSelect = screen.getByLabelText('仪表盘范围') as HTMLSelectElement;
    const globalOption = Array.from(scopeSelect.options).find((o) => o.value === 'global');
    expect(globalOption?.disabled).toBe(true);
    expect(globalOption?.textContent).toContain('asset_scope:manage');
  });
});
