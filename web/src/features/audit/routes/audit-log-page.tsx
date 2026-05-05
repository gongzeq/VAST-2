/**
 * Audit log page (PR3).
 *
 * Permission gating: page renders <UnauthorizedState/> rather than redirecting
 * (PRD R-C). Filter state lives in the URL only; pagination resets on any
 * non-page filter change. Detail dialog state stays component-local.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  ApiError,
  UnknownStateError,
} from '@/shared/api/fetch-json';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Skeleton,
  UnauthorizedState,
} from '@/shared/components';
import type { AuditLogEntry } from '@/shared/contracts/audit-log.contract';
import { useCanViewAuditLog } from '@/shared/hooks/use-can';

import {
  AuditLogDetailDialog,
  AuditLogFilters,
  AuditLogPagination,
  AuditLogTable,
} from '../components';
import { useAuditLog } from '../hooks/use-audit-log';
import {
  parseAuditLogFilter,
  serializeAuditLogFilter,
  type AuditLogFilter,
} from '../state/audit-log-filter.contract';

export function AuditLogPage() {
  const canViewAuditLog = useCanViewAuditLog();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseAuditLogFilter(searchParams);
  const query = useAuditLog(filter);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  if (!canViewAuditLog) {
    return (
      <UnauthorizedState
        missingPermission="audit_log:view"
        title="无 audit_log:view 权限"
        description="审计轨迹仅对具备 audit_log:view 权限的角色开放。"
      />
    );
  }

  const updateFilter = (next: AuditLogFilter) => {
    setSearchParams(serializeAuditLogFilter(next));
  };

  const setPage = (page: number) => updateFilter({ ...filter, page });
  const setPageSize = (pageSize: number) =>
    updateFilter({ ...filter, page: 1, pageSize });

  const selectedEntry: AuditLogEntry | null =
    selectedEntryId && query.data
      ? query.data.entries.find((entry) => entry.auditLogEntryId === selectedEntryId) ?? null
      : null;

  const renderContent = () => {
    if (query.isPending) {
      return (
        <Card>
          <CardBody className="space-y-3">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
          </CardBody>
        </Card>
      );
    }
    if (query.isError) {
      const err = query.error;
      if (err instanceof ApiError && err.errorCode === 'AUTHORIZATION_DENIED') {
        return (
          <UnauthorizedState
            missingPermission="audit_log:view"
            title="无 audit_log:view 权限"
            description={err.message}
          />
        );
      }
      if (err instanceof UnknownStateError) {
        return (
          <ErrorState
            title="未知数据状态"
            description="服务返回了与契约不匹配的字段，可能存在敏感字段未脱敏的情况，已阻断渲染。"
          />
        );
      }
      return <ErrorState description={err.message} />;
    }
    if (query.data.entries.length === 0) {
      return (
        <EmptyState
          title="没有匹配的审计记录"
          description="可以放宽过滤条件，或选择更长的时间窗口。"
        />
      );
    }
    return (
      <Card>
        <CardBody className="space-y-3 p-3">
          <AuditLogTable entries={query.data.entries} onSelect={setSelectedEntryId} />
          <AuditLogPagination
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardBody>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">审计轨迹</h1>
        <p className="text-sm text-gray-600">
          所有关键动作均被记录；明文密码与原始日志正文在契约层强制脱敏，前端不会渲染敏感原文。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
        </CardHeader>
        <CardBody>
          <AuditLogFilters filter={filter} onChange={updateFilter} />
        </CardBody>
      </Card>

      {renderContent()}

      <AuditLogDetailDialog
        entry={selectedEntry}
        onClose={() => setSelectedEntryId(null)}
      />
    </div>
  );
}
