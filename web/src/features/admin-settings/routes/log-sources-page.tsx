/**
 * Log source admin page (PR4).
 *
 * - Lists / creates / updates / toggles / deletes log sources.
 * - Disabling triggers an explicit confirmation that warns ingestion stops.
 */
import { useState } from 'react';

import { Button } from '@/shared/components/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/components/Card';
import { ConfirmationDialog } from '@/shared/components/ConfirmationDialog';
import { Dialog } from '@/shared/components/Dialog';
import { ErrorState, Skeleton } from '@/shared/components';
import { Input } from '@/shared/components/Input';
import { Select } from '@/shared/components/Select';
import { StatusBadge } from '@/shared/components/StatusBadge';
import {
  logSourceKinds,
  logSourceParserFormats,
  logSourceProtocols,
  type LogSource,
  type LogSourceUpsertRequest,
} from '@/shared/contracts';
import { useCanManageLogSource } from '@/shared/hooks/use-can';

import {
  AdminPageShell,
  DiffSummaryDialog,
  buildDiffEntries,
} from '../components/_shared';
import {
  useCreateLogSource,
  useDeleteLogSource,
  useLogSources,
  useToggleLogSource,
  useUpdateLogSource,
} from '../hooks';

const EMPTY_FORM: LogSourceUpsertRequest = {
  name: '新日志源',
  logKind: 'firewall',
  productType: 'generic-firewall',
  protocol: 'tls-syslog',
  parserFormat: 'syslog',
  assetGroupId: 'ag_corp_public',
  listenAddress: '0.0.0.0',
  listenPort: 6514,
  allowedSourceIps: [],
  eventRetentionDays: 180,
  metricsRetentionDays: 365,
  status: 'ENABLED',
};

function logSourceToForm(source: LogSource): LogSourceUpsertRequest {
  return {
    name: source.name,
    logKind: source.logKind,
    productType: source.productType,
    protocol: source.protocol,
    parserFormat: source.parserFormat,
    assetGroupId: source.assetGroupId,
    listenAddress: source.listenAddress,
    listenPort: source.listenPort,
    allowedSourceIps: source.allowedSourceIps,
    eventRetentionDays: source.eventRetentionDays,
    metricsRetentionDays: source.metricsRetentionDays,
    status: source.status,
  };
}

export function LogSourcesPage() {
  const canManage = useCanManageLogSource();
  const query = useLogSources();
  const createMutation = useCreateLogSource();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LogSourceUpsertRequest | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState<LogSource | null>(null);
  const [toggleTarget, setToggleTarget] = useState<LogSource | null>(null);

  const updateMutation = useUpdateLogSource(editingId ?? '');
  const toggleMutation = useToggleLogSource(toggleTarget?.logSourceId ?? '');
  const deleteMutation = useDeleteLogSource(deleting?.logSourceId ?? '');

  const editingSource = query.data?.logSources.find((s) => s.logSourceId === editingId) ?? null;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (source: LogSource) => {
    setEditingId(source.logSourceId);
    setForm(logSourceToForm(source));
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(null);
    setConfirmOpen(false);
  };

  const handleConfirm = async () => {
    if (!form) return;
    if (editingId) {
      await updateMutation.mutateAsync(form);
    } else {
      await createMutation.mutateAsync(form);
    }
    closeForm();
  };

  return (
    <AdminPageShell
      title="日志源"
      description="管理防火墙日志源与 Web 日志源；停用会终止日志接收，需二次确认。"
      permitted={canManage}
      missingPermission="log_source:manage"
    >
      <Card>
        <CardHeader>
          <CardTitle>日志源列表</CardTitle>
          <Button size="sm" onClick={openCreate} data-testid="log-source-new">
            新建
          </Button>
        </CardHeader>
        <CardBody>
          {query.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : query.isError ? (
            <ErrorState description={query.error.message} />
          ) : query.data.logSources.length === 0 ? (
            <p className="text-sm text-gray-500">暂无日志源。</p>
          ) : (
            <ul className="divide-y divide-gray-100" data-testid="log-source-list">
              {query.data.logSources.map((source) => (
                <li
                  key={source.logSourceId}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                  data-testid={`log-source-row-${source.logSourceId}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      {source.name}
                      <StatusBadge status={{ kind: 'admin-status', value: source.status }} />
                      <StatusBadge
                        status={{ kind: 'log-source-health', value: source.health }}
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      {source.logKind} · {source.protocol} · {source.parserFormat} ·{' '}
                      {source.listenAddress}:{source.listenPort}
                    </div>
                    <div className="text-xs text-gray-500">
                      资产组：{source.assetGroupId} · 事件保留 {source.eventRetentionDays} 天 ·
                      指标保留 {source.metricsRetentionDays} 天
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setToggleTarget(source)}
                      data-testid={`log-source-toggle-${source.logSourceId}`}
                    >
                      {source.status === 'ENABLED' ? '停用' : '启用'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(source)}>
                      编辑
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleting(source)}>
                      删除
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Dialog
        open={form !== null}
        onClose={closeForm}
        title={editingId ? '编辑日志源' : '新建日志源'}
      >
        {form ? (
          <LogSourceForm
            form={form}
            onChange={setForm}
            onSubmit={() => setConfirmOpen(true)}
            submitLabel={editingId ? '检查改动' : '提交新建'}
          />
        ) : null}
      </Dialog>

      <DiffSummaryDialog
        open={confirmOpen && form !== null}
        title={editingId ? '确认更新日志源' : '确认新建日志源'}
        entries={
          form && editingSource
            ? buildDiffEntries(
                logSourceToForm(editingSource) as unknown as Record<string, unknown>,
                form as unknown as Record<string, unknown>,
              )
            : form
            ? buildDiffEntries({}, form as unknown as Record<string, unknown>)
            : []
        }
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />

      <ConfirmationDialog
        open={toggleTarget !== null}
        actionDescription={
          toggleTarget?.status === 'ENABLED' ? '停用日志源' : '启用日志源'
        }
        targetScope={toggleTarget?.name ?? ''}
        riskLevelText={
          toggleTarget?.status === 'ENABLED'
            ? '停用会终止日志接收链路'
            : '启用会立即开始接收日志'
        }
        onCancel={() => setToggleTarget(null)}
        onConfirm={async () => {
          if (toggleTarget) {
            await toggleMutation.mutateAsync({
              status: toggleTarget.status === 'ENABLED' ? 'DISABLED' : 'ENABLED',
            });
          }
          setToggleTarget(null);
        }}
        confirmLabel="确认切换"
      />

      <ConfirmationDialog
        open={deleting !== null}
        actionDescription="删除日志源"
        targetScope={deleting?.name ?? ''}
        riskLevelText="删除后该日志源不可恢复"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) {
            await deleteMutation.mutateAsync();
          }
          setDeleting(null);
        }}
        confirmLabel="确认删除"
      />
    </AdminPageShell>
  );
}

interface LogSourceFormProps {
  form: LogSourceUpsertRequest;
  onChange: (next: LogSourceUpsertRequest) => void;
  onSubmit: () => void;
  submitLabel: string;
}

function LogSourceForm({ form, onChange, onSubmit, submitLabel }: LogSourceFormProps) {
  const update = (patch: Partial<LogSourceUpsertRequest>) => onChange({ ...form, ...patch });
  return (
    <div className="space-y-3 text-sm" data-testid="log-source-form">
      <label className="flex flex-col gap-1">
        名称
        <Input value={form.name} onChange={(e) => update({ name: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          类型
          <Select
            value={form.logKind}
            onChange={(e) => update({ logKind: e.target.value as typeof form.logKind })}
          >
            {logSourceKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          产品类型
          <Input
            value={form.productType}
            onChange={(e) => update({ productType: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          协议
          <Select
            value={form.protocol}
            onChange={(e) => update({ protocol: e.target.value as typeof form.protocol })}
          >
            {logSourceProtocols.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          解析格式
          <Select
            value={form.parserFormat}
            onChange={(e) =>
              update({ parserFormat: e.target.value as typeof form.parserFormat })
            }
          >
            {logSourceParserFormats.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          所属资产组
          <Input
            value={form.assetGroupId}
            onChange={(e) => update({ assetGroupId: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          监听地址
          <Input
            value={form.listenAddress}
            onChange={(e) => update({ listenAddress: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          端口
          <Input
            type="number"
            min={1}
            max={65535}
            value={form.listenPort}
            onChange={(e) => update({ listenPort: Number(e.target.value) || 1 })}
          />
        </label>
        <label className="flex flex-col gap-1">
          事件保留 (天)
          <Input
            type="number"
            min={1}
            value={form.eventRetentionDays}
            onChange={(e) =>
              update({ eventRetentionDays: Number(e.target.value) || 1 })
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          指标保留 (天)
          <Input
            type="number"
            min={1}
            value={form.metricsRetentionDays}
            onChange={(e) =>
              update({ metricsRetentionDays: Number(e.target.value) || 1 })
            }
          />
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.status === 'ENABLED'}
          onChange={(e) =>
            update({ status: e.target.checked ? 'ENABLED' : 'DISABLED' })
          }
        />
        启用
      </label>
      <div className="flex justify-end">
        <Button onClick={onSubmit} data-testid="log-source-form-submit">
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
