import type {
  MailAnalysisMode,
  MailAttachmentAnalysis,
} from '@/shared/contracts/mail-analysis.contract';

import { formatBytes } from './format-helpers';

export interface AttachmentAnalysisTableProps {
  attachments: MailAttachmentAnalysis[];
  /** When provided, lets the table render the per-mode "全部跳过" reason. */
  analysisMode: MailAnalysisMode;
}

/**
 * Renders attachment analysis results.
 *
 * R7: rows where `analyzed === false` MUST display the `skippedReason` text
 * (or a deterministic fallback) — never represent a skipped attachment with
 * only an icon, otherwise an analyst could miss the "未分析" branch.
 */
export function AttachmentAnalysisTable({
  attachments,
  analysisMode,
}: AttachmentAnalysisTableProps) {
  if (analysisMode === 'UNAVAILABLE') {
    return (
      <p
        className="rounded border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600"
        data-testid="mail-attachment-analysis-unavailable"
      >
        分析不可用，附件信息仅元数据，请通过下游邮箱原始邮件查看。
      </p>
    );
  }

  if (attachments.length === 0) {
    return (
      <p
        className="rounded border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500"
        data-testid="mail-attachment-analysis-empty"
      >
        本邮件无附件。
      </p>
    );
  }

  return (
    <table className="w-full divide-y divide-gray-200 text-sm" data-testid="mail-attachment-analysis-table">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-3 py-2 text-left">文件名</th>
          <th className="px-3 py-2 text-left">大小</th>
          <th className="px-3 py-2 text-left">Content-Type</th>
          <th className="px-3 py-2 text-left">识别类型</th>
          <th className="px-3 py-2 text-left">是否分析</th>
          <th className="px-3 py-2 text-left">跳过原因 / 风险信号</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {attachments.map((attachment) => (
          <tr
            key={attachment.filename + attachment.sha256}
            data-testid={`mail-attachment-row-${attachment.filename}`}
            data-analyzed={attachment.analyzed ? 'true' : 'false'}
          >
            <td className="px-3 py-2 font-medium text-gray-900">{attachment.filename}</td>
            <td className="px-3 py-2 text-gray-700">{formatBytes(attachment.sizeBytes)}</td>
            <td className="px-3 py-2 font-mono text-xs text-gray-700">
              {attachment.contentType ?? '未知'}
            </td>
            <td className="px-3 py-2 text-gray-700">{attachment.fileType ?? '未识别'}</td>
            <td className="px-3 py-2 text-gray-700">
              {attachment.analyzed ? (
                <span data-testid="attachment-analyzed-true" className="text-emerald-700">
                  已分析
                </span>
              ) : (
                <span data-testid="attachment-analyzed-false" className="text-amber-700">
                  未分析
                </span>
              )}
            </td>
            <td className="space-y-1 px-3 py-2 text-xs text-gray-700">
              {!attachment.analyzed ? (
                <p data-testid="attachment-skipped-reason" className="text-amber-800">
                  {attachment.skippedReason ?? '未分析（未提供原因）'}
                </p>
              ) : null}
              {attachment.riskSignals.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-4">
                  {attachment.riskSignals.map((signal) => (
                    <li key={signal} className="font-mono">
                      {signal}
                    </li>
                  ))}
                </ul>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
