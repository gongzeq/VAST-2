import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { DashboardCategoryDispatcher } from '@/features/dashboard/components/categories/DashboardCategoryDispatcher';
import type { DashboardCategory } from '@/shared/contracts/dashboard-summary.contract';

function renderCategory(category: DashboardCategory) {
  return render(
    <MemoryRouter>
      <DashboardCategoryDispatcher category={category} />
    </MemoryRouter>,
  );
}

const SUMMARY = '【summary】';

describe('Dashboard category cards', () => {
  it('renders the task card with summary + 7-day sparkline aria-label', () => {
    renderCategory({
      kind: 'task',
      summary: SUMMARY,
      todayTaskCount: 12,
      runningTaskCount: 2,
      byState: [
        { state: 'SUCCESS', count: 9 },
        { state: 'FAILED', count: 1 },
      ],
      averageDurationSeconds: 184,
      trend7Days: [
        { bucketAt: '2025-05-01T00:00:00Z', value: 3 },
        { bucketAt: '2025-05-02T00:00:00Z', value: 5 },
      ],
    });
    expect(screen.getByTestId('dashboard-card-summary').textContent).toBe(SUMMARY);
    expect(screen.getByRole('img', { name: /近 7 日任务数趋势/ })).toBeInTheDocument();
  });

  it('renders the asset card with summary and detail link', () => {
    renderCategory({
      kind: 'asset',
      summary: SUMMARY,
      authorizedAssetGroupCount: 2,
      discoveredAssetCount: 18,
      liveAssetCount: 14,
      newlyDiscoveredAssetCount: 3,
      exposedPortCount: 27,
      topServices: [{ service: 'http', count: 9 }],
    });
    expect(screen.getByTestId('dashboard-card-summary').textContent).toBe(SUMMARY);
    expect(screen.getByRole('link', { name: /查看详情/ })).toHaveAttribute('href', '/asset-scope');
  });

  it('renders the vulnerability card with severity badges and template-hit sparkline', () => {
    renderCategory({
      kind: 'vulnerability',
      summary: SUMMARY,
      severityCounts: [
        { severity: 'CRITICAL', count: 2 },
        { severity: 'HIGH', count: 3 },
      ],
      topTypes: [{ vulnerabilityType: 'Path Traversal', count: 5 }],
      topRiskAssets: [
        { asset: '10.0.0.42', severity: 'CRITICAL', findingCount: 5 },
      ],
      templateHitTrend: [
        { bucketAt: '2025-05-01T00:00:00Z', value: 2 },
        { bucketAt: '2025-05-02T00:00:00Z', value: 5 },
      ],
    });
    expect(screen.getByTestId('dashboard-card-summary').textContent).toBe(SUMMARY);
    expect(screen.getByRole('img', { name: /近 7 日模板命中数/ })).toBeInTheDocument();
  });

  it('renders the weak-password card with the 30-day trend AND the cleartext footnote', () => {
    renderCategory({
      kind: 'weak-password',
      summary: SUMMARY,
      weakPasswordAssetCount: 2,
      byServiceType: [{ serviceType: 'ssh', count: 1 }],
      trend30Days: [
        { bucketAt: '2025-04-01T00:00:00Z', value: 0 },
        { bucketAt: '2025-04-02T00:00:00Z', value: 1 },
      ],
    });
    expect(screen.getByTestId('dashboard-card-summary').textContent).toBe(SUMMARY);
    expect(screen.getByRole('img', { name: /30 日弱口令资产趋势/ })).toBeInTheDocument();
    expect(screen.getByText(/明文密码不在大屏展示/)).toBeInTheDocument();
  });

  it('renders the mail card with risk-bucket and induce-type lists', () => {
    renderCategory({
      kind: 'mail',
      summary: SUMMARY,
      todayMailCount: 1820,
      suspectedMailCount: 24,
      riskBucketCounts: [
        { bucket: 'suspected', count: 24 },
        { bucket: 'clean', count: 1740 },
      ],
      topInduceTypes: [{ induceType: '发票催收', count: 8 }],
      topUrlDomains: [{ domain: 'fake-invoice.example', count: 7 }],
      topAttachmentTypes: [{ attachmentType: 'pdf', count: 12 }],
    });
    expect(screen.getByTestId('dashboard-card-summary').textContent).toBe(SUMMARY);
    // induce-type is unique to the body; the dt label and risk-bucket label
    // both render "疑似钓鱼" (intentional — once as a stat tile, once as a
    // risk-bucket entry).
    expect(screen.getByText('发票催收')).toBeInTheDocument();
    expect(screen.getAllByText('疑似钓鱼')).toHaveLength(2);
  });

  it('renders the YOLO card with the 4 counters', () => {
    renderCategory({
      kind: 'yolo',
      summary: SUMMARY,
      naturalLanguageTaskCount: 30,
      yoloDirectExecutionCount: 10,
      clarificationCount: 12,
      whitelistBlockedCount: 1,
    });
    expect(screen.getByTestId('dashboard-card-summary').textContent).toBe(SUMMARY);
    expect(screen.getByText('自然语言任务')).toBeInTheDocument();
    expect(screen.getByText('白名单阻断')).toBeInTheDocument();
  });

  it('renders the log-attack card with spike alert when spikeAlert=true', () => {
    renderCategory({
      kind: 'log-attack',
      summary: SUMMARY,
      firewallEventCount: 100,
      webEventCount: 200,
      topAttackTypes: [{ attackType: 'SQLi', count: 5 }],
      topSourceIps: [{ sourceIp: '1.2.3.4', count: 7 }],
      topTargetAssets: [{ asset: 'api.example.com', count: 3 }],
      actionDistribution: [{ action: 'BLOCK', count: 90 }],
      topUriPatterns: [{ uriPattern: '/login', count: 20 }],
      httpMethodCounts: [{ method: 'POST', count: 50 }],
      httpStatusCounts: [{ status: 200, count: 150 }],
      attackTrend: [
        { bucketAt: '2025-05-01T00:00:00Z', value: 1 },
        { bucketAt: '2025-05-02T00:00:00Z', value: 2 },
      ],
      spikeAlert: true,
    });
    expect(screen.getByTestId('dashboard-card-summary').textContent).toBe(SUMMARY);
    expect(screen.getByTestId('dashboard-log-attack-spike')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /攻击趋势/ })).toBeInTheDocument();
  });

  it('omits the spike alert when spikeAlert=false', () => {
    renderCategory({
      kind: 'log-attack',
      summary: SUMMARY,
      firewallEventCount: 0,
      webEventCount: 0,
      topAttackTypes: [],
      topSourceIps: [],
      topTargetAssets: [],
      actionDistribution: [],
      topUriPatterns: [],
      httpMethodCounts: [],
      httpStatusCounts: [],
      attackTrend: [],
      spikeAlert: false,
    });
    expect(screen.queryByTestId('dashboard-log-attack-spike')).toBeNull();
  });
});
