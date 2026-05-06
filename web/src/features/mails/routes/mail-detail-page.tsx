import { Link, Navigate, useParams } from 'react-router-dom';

import { ApiError, UnknownStateError } from '@/shared/api/fetch-json';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ErrorState,
  Skeleton,
  StatusBadge,
  UnauthorizedState,
} from '@/shared/components';
import { formatDate } from '@/shared/formatting/format-date';

import { AttachmentAnalysisTable } from '../components/attachment-analysis-table';
import {
  formatBytes,
  formatRiskScore,
  formatSender,
  formatSubject,
} from '../components/format-helpers';
import { IocList } from '../components/ioc-list';
import { MailStatusBanner } from '../components/mail-status-banner';
import { RecipientList } from '../components/recipient-list';
import { SecurityHeadersTable } from '../components/security-headers-table';
import { useMailAnalysis } from '../hooks/use-mail-analysis';

export function MailDetailPage() {
  const params = useParams<{ mailTaskId: string }>();
  const mailTaskId = params.mailTaskId ?? '';
  const query = useMailAnalysis(mailTaskId, { enabled: mailTaskId.length > 0 });

  if (!params.mailTaskId) {
    return <Navigate to="/mails" replace />;
  }

  if (query.isPending) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </CardBody>
      </Card>
    );
  }

  if (query.isError) {
    const err = query.error;
    if (err instanceof ApiError && err.errorCode === 'AUTHORIZATION_DENIED') {
      return (
        <UnauthorizedState
          missingPermission="raw_evidence:view"
          title="无权查看该邮件分析"
          description={err.message}
        />
      );
    }
    if (err instanceof UnknownStateError) {
      return <ErrorState title="未知邮件分析详情状态" description={err.message} />;
    }
    return (
      <ErrorState
        description={err.message}
        errorCode={err instanceof ApiError ? err.errorCode : undefined}
      />
    );
  }

  const record = query.data;
  const isAnalyzed = record.analysisStatus === 'ANALYZED';

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <Link to="/mails" className="text-sm text-blue-700 hover:underline">
          返回邮件列表
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">{formatSubject(record.subject)}</h1>
        <p className="text-sm text-gray-600">
          mailTaskId：<span className="font-mono">{record.mailTaskId}</span>
        </p>
      </header>

      <MailStatusBanner
        analysisStatus={record.analysisStatus}
        analysisMode={record.analysisMode}
        unavailableReason={record.unavailableReason}
        messageSizeBytes={record.messageSizeBytes}
      />

      <Card>
        <CardHeader>
          <CardTitle>邮件摘要</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">主题</p>
              <p className="text-sm text-gray-900">{formatSubject(record.subject)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">发件人</p>
              <p className="font-mono text-sm text-gray-900">{formatSender(record.from)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">收件人</p>
              <RecipientList recipients={record.recipients} />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">接收时间</p>
              <p className="text-sm text-gray-900">{formatDate(record.receivedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">邮件大小</p>
              <p className="text-sm text-gray-900">{formatBytes(record.messageSizeBytes)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">正文 SHA-256</p>
              <p
                className="break-all font-mono text-xs text-gray-700"
                data-testid="mail-body-sha256"
              >
                {record.bodySha256}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">所属网关 / 资产组</p>
              <p className="text-sm text-gray-900">
                <Link
                  to={`/admin/mail-gateways/${encodeURIComponent(record.gatewayId)}`}
                  className="font-mono text-blue-700 hover:underline"
                >
                  {record.gatewayId}
                </Link>
                {' · '}
                <Link
                  to="/asset-scope"
                  className="text-blue-700 hover:underline"
                  data-testid="mail-asset-group-link"
                >
                  {record.assetGroupId}
                </Link>
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {isAnalyzed ? (
        <Card data-testid="mail-risk-score-card">
          <CardHeader>
            <CardTitle>风险评分</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {record.phishingLabel !== null ? (
              <div className="flex items-center gap-3">
                <StatusBadge status={{ kind: 'phishing-label', value: record.phishingLabel }} />
                <span className="text-2xl font-semibold text-gray-900">
                  {formatRiskScore(record.riskScore)}
                </span>
                <span className="text-xs text-gray-500">/ 100</span>
              </div>
            ) : (
              <p className="text-sm text-gray-600">无评分</p>
            )}
            {record.riskScore !== null ? (
              <div
                className="h-2 w-full overflow-hidden rounded bg-gray-100"
                aria-label="风险分进度条"
              >
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, record.riskScore))}%` }}
                />
              </div>
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">风险信号</p>
              {record.riskSignals.length === 0 ? (
                <p className="mt-1 text-sm text-gray-500">未识别到风险信号。</p>
              ) : (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm font-mono text-gray-800">
                  {record.riskSignals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>安全 Header</CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <SecurityHeadersTable headers={record.securityHeaders} />
        </CardBody>
      </Card>

      {isAnalyzed ? (
        <Card data-testid="mail-ioc-card">
          <CardHeader>
            <CardTitle>IOC</CardTitle>
          </CardHeader>
          <CardBody>
            <IocList iocs={record.iocs} />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>附件分析</CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <AttachmentAnalysisTable
            attachments={record.attachmentAnalyses}
            analysisMode={record.analysisMode}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>转发结果</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs text-gray-500">下游主机</p>
            <p className="font-mono text-sm text-gray-900">
              {record.forwardingResult.downstreamHost}:{record.forwardingResult.downstreamPort}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">转发时间</p>
            <p className="text-sm text-gray-900">
              {formatDate(record.forwardingResult.forwardedAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">转发状态</p>
            <p className="text-sm text-gray-900">{record.forwardingResult.status}</p>
          </div>
          <div className="md:col-span-3">
            <p className="text-xs text-gray-500">已应用 Header</p>
            {Object.keys(record.forwardingResult.appliedHeaders).length === 0 ? (
              <p className="text-sm text-gray-500">未应用任何 Header。</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-xs font-mono text-gray-700">
                {Object.entries(record.forwardingResult.appliedHeaders).map(([key, value]) => (
                  <li key={key}>
                    <span className="font-semibold">{key}:</span> {value}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
