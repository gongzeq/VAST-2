import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AttachmentAnalysisTable } from '@/features/mails/components/attachment-analysis-table';
import type { MailAttachmentAnalysis } from '@/shared/contracts/mail-analysis.contract';

const baseAttachment: MailAttachmentAnalysis = {
  filename: 'invoice.xlsx',
  sizeBytes: 4096,
  contentType: 'application/vnd.ms-excel',
  sha256: 'abc',
  analyzed: true,
  skippedReason: null,
  fileType: 'OOXML',
  riskSignals: [],
};

describe('AttachmentAnalysisTable', () => {
  it('renders empty placeholder when no attachments', () => {
    render(<AttachmentAnalysisTable attachments={[]} analysisMode="FULL" />);
    expect(screen.getByTestId('mail-attachment-analysis-empty')).toBeInTheDocument();
  });

  it('renders an UNAVAILABLE notice when analysisMode=UNAVAILABLE regardless of attachments', () => {
    render(
      <AttachmentAnalysisTable
        attachments={[baseAttachment]}
        analysisMode="UNAVAILABLE"
      />,
    );
    expect(screen.getByTestId('mail-attachment-analysis-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('mail-attachment-analysis-table')).toBeNull();
  });

  it('R7: rows where analyzed=false MUST display the skippedReason text', () => {
    const skipped: MailAttachmentAnalysis = {
      ...baseAttachment,
      filename: 'big-bundle.zip',
      analyzed: false,
      skippedReason: '邮件超 50MB 上限，附件未分析',
      fileType: null,
    };
    render(
      <AttachmentAnalysisTable
        attachments={[skipped]}
        analysisMode="BODY_ONLY_SIZE_LIMIT"
      />,
    );
    expect(screen.getByTestId('attachment-skipped-reason')).toHaveTextContent(
      '邮件超 50MB 上限，附件未分析',
    );
    expect(screen.getByTestId('attachment-analyzed-false')).toBeInTheDocument();
  });

  it('falls back to "(未提供原因)" copy when skippedReason is null but analyzed=false', () => {
    const skipped: MailAttachmentAnalysis = {
      ...baseAttachment,
      analyzed: false,
      skippedReason: null,
    };
    render(
      <AttachmentAnalysisTable attachments={[skipped]} analysisMode="FULL" />,
    );
    expect(screen.getByTestId('attachment-skipped-reason')).toHaveTextContent(
      '未分析（未提供原因）',
    );
  });

  it('renders an analysed attachment with risk signals', () => {
    const attachment: MailAttachmentAnalysis = {
      ...baseAttachment,
      filename: 'macro.docm',
      analyzed: true,
      riskSignals: ['macro-present'],
    };
    render(
      <AttachmentAnalysisTable attachments={[attachment]} analysisMode="FULL" />,
    );
    expect(screen.getByTestId('attachment-analyzed-true')).toBeInTheDocument();
    expect(screen.getByText('macro-present')).toBeInTheDocument();
  });
});
