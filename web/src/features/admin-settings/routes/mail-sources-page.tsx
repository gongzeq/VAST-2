/**
 * Mail source admin page (PR4).
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
  mailSourceFailOpenPolicies,
  type MailSource,
  type MailSourceUpsertRequest,
} from '@/shared/contracts';
import { useCanManageMailSource } from '@/shared/hooks/use-can';

import {
  AdminPageShell,
  DiffSummaryDialog,
  buildDiffEntries,
} from '../components/_shared';
import {
  useCreateMailSource,
  useDeleteMailSource,
  useMailSources,
  useUpdateMailSource,
} from '../hooks';

const EMPTY_FORM: MailSourceUpsertRequest = {
  name: '新邮件源',
  upstreamHost: 'mx.upstream.example',
  upstreamPort: 25,
  downstreamHost: 'corp-mail.internal',
  downstreamPort: 25,
  maxMessageBytes: 50 * 1024 * 1024,
  failOpenPolicy: 'forward-with-marker',
  status: 'ENABLED',
};

function mailSourceToForm(source: MailSource): MailSourceUpsertRequest {
  return {
    name: source.name,
    upstreamHost: source.upstreamHost,
    upstreamPort: source.upstreamPort,
    downstreamHost: source.downstreamHost,
    downstreamPort: source.downstreamPort,
    maxMessageBytes: source.maxMessageBytes,
    failOpenPolicy: source.failOpenPolicy,
    status: source.status,
  };
}

export function MailSourcesPage() {
  const canManage = useCanManageMailSource();
  const query = useMailSources();
  const createMutation = useCreateMailSource();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MailSourceUpsertRequest | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState<MailSource | null>(null);

  const updateMutation = useUpdateMailSource(editingId ?? '');
  const deleteMutation = useDeleteMailSource(deleting?.mailSourceId ?? '');

  const editingSource = query.data?.mailSources.find((s) => s.mailSourceId === editingId) ?? null;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };
  const openEdit = (source: MailSource) => {
    setEditingId(source.mailSourceId);
    setForm(mailSourceToForm(source));
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
      title="邮件源"
      description="管理串联标记型邮件网关的上下游配置；fail-open 策略由此处指定。"
      permitted={canManage}
      missingPermission="asset_scope:manage"
      unauthorizedDescription="邮件源管理仅对管理员角色开放。"
    >
      <Card>
        <CardHeader>
          <CardTitle>邮件源列表</CardTitle>
          <Button size="sm" onClick={openCreate} data-testid="mail-source-new">
            新建
          </Button>
        </CardHeader>
        <CardBody>
          {query.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : query.isError ? (
            <ErrorState description={query.error.message} />
          ) : query.data.mailSources.length === 0 ? (
            <p className="text-sm text-gray-500">暂无邮件源。</p>
          ) : (
            <ul className="divide-y divide-gray-100" data-testid="mail-source-list">
              {query.data.mailSources.map((source) => (
                <li
                  key={source.mailSourceId}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                  data-testid={`mail-source-row-${source.mailSourceId}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      {source.name}
                      <StatusBadge status={{ kind: 'admin-status', value: source.status }} />
                    </div>
                    <div className="text-xs text-gray-500">
                      上游 {source.upstreamHost}:{source.upstreamPort} → 下游{' '}
                      {source.downstreamHost}:{source.downstreamPort}
                    </div>
                    <div className="text-xs text-gray-500">
                      最近接收 {source.recentReceivedCount} 封 · 大小上限{' '}
                      {Math.round(source.maxMessageBytes / 1024 / 1024)} MB · fail-open{' '}
                      {source.failOpenPolicy}
                    </div>
                  </div>
                  <div className="flex gap-2">
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
        title={editingId ? '编辑邮件源' : '新建邮件源'}
      >
        {form ? (
          <div className="space-y-3 text-sm" data-testid="mail-source-form">
            <label className="flex flex-col gap-1">
              名称
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                上游 host
                <Input
                  value={form.upstreamHost}
                  onChange={(e) => setForm({ ...form, upstreamHost: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                上游端口
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={form.upstreamPort}
                  onChange={(e) =>
                    setForm({ ...form, upstreamPort: Number(e.target.value) || 25 })
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                下游 host
                <Input
                  value={form.downstreamHost}
                  onChange={(e) => setForm({ ...form, downstreamHost: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                下游端口
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={form.downstreamPort}
                  onChange={(e) =>
                    setForm({ ...form, downstreamPort: Number(e.target.value) || 25 })
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                邮件大小上限 (字节)
                <Input
                  type="number"
                  min={1}
                  value={form.maxMessageBytes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxMessageBytes: Number(e.target.value) || 50 * 1024 * 1024,
                    })
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                fail-open 策略
                <Select
                  value={form.failOpenPolicy}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      failOpenPolicy: e.target.value as typeof form.failOpenPolicy,
                    })
                  }
                >
                  {mailSourceFailOpenPolicies.map((policy) => (
                    <option key={policy} value={policy}>
                      {policy}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.status === 'ENABLED'}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.checked ? 'ENABLED' : 'DISABLED' })
                }
              />
              启用
            </label>
            <div className="flex justify-end">
              <Button onClick={() => setConfirmOpen(true)} data-testid="mail-source-form-submit">
                {editingId ? '检查改动' : '提交新建'}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <DiffSummaryDialog
        open={confirmOpen && form !== null}
        title={editingId ? '确认更新邮件源' : '确认新建邮件源'}
        entries={
          form && editingSource
            ? buildDiffEntries(
                mailSourceToForm(editingSource) as unknown as Record<string, unknown>,
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
        open={deleting !== null}
        actionDescription="删除邮件源"
        targetScope={deleting?.name ?? ''}
        riskLevelText="删除后无法恢复，并会停止邮件转发"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteMutation.mutateAsync();
          setDeleting(null);
        }}
        confirmLabel="确认删除"
      />
    </AdminPageShell>
  );
}
