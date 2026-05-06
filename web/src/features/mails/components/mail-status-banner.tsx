import type {
  MailAnalysisMode,
  MailAnalysisStatus,
} from '@/shared/contracts/mail-analysis.contract';

import { formatBytes } from './format-helpers';

export interface MailStatusBannerProps {
  analysisStatus: MailAnalysisStatus;
  analysisMode: MailAnalysisMode;
  unavailableReason: string | null;
  messageSizeBytes: number;
}

/**
 * Detail-page top status banner. Per R3 the UNAVAILABLE / BODY_ONLY_SIZE_LIMIT
 * branches must be expressed loudly — never as a small icon — so that an
 * analyst cannot mistake a size-limited or fail-open mail for a clean one.
 */
export function MailStatusBanner({
  analysisStatus,
  analysisMode,
  unavailableReason,
  messageSizeBytes,
}: MailStatusBannerProps) {
  if (analysisStatus === 'UNAVAILABLE') {
    return (
      <div
        className="rounded border border-red-300 bg-red-50 p-4"
        role="alert"
        data-testid="mail-status-banner-unavailable"
      >
        <h2 className="text-base font-semibold text-red-800">分析不可用，邮件已 fail-open 转发</h2>
        <p className="mt-1 text-sm text-red-700">
          {unavailableReason ??
            '分析服务暂时不可达；邮件按 fail-open 策略已转发，请勿据此判断该邮件是否可信。'}
        </p>
      </div>
    );
  }

  if (analysisMode === 'BODY_ONLY_SIZE_LIMIT') {
    return (
      <div
        className="rounded border border-amber-300 bg-amber-50 p-4"
        role="alert"
        data-testid="mail-status-banner-body-only"
      >
        <h2 className="text-base font-semibold text-amber-800">邮件超 50MB 上限，附件未分析</h2>
        <p className="mt-1 text-sm text-amber-700">
          邮件大小 {formatBytes(messageSizeBytes)}，超过 50MB 上限，仅分析正文；附件信息只保留元数据，未进行静态分析。
        </p>
      </div>
    );
  }

  return null;
}
