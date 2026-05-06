/**
 * LLM Provider admin page (PR4).
 *
 * Lists providers, supports create / edit (with diff confirmation) / toggle /
 * delete, all via MSW writes.
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
  llmProviderPurposes,
  llmProviderTypes,
  type LlmProvider,
  type LlmProviderUpsertRequest,
} from '@/shared/contracts';
import { useCanManageLlmProvider } from '@/shared/hooks/use-can';

import {
  AdminPageShell,
  DiffSummaryDialog,
  buildDiffEntries,
} from '../components/_shared';
import {
  useCreateLlmProvider,
  useDeleteLlmProvider,
  useLlmProviders,
  useToggleLlmProvider,
  useUpdateLlmProvider,
} from '../hooks';

interface FormState extends LlmProviderUpsertRequest {
  apiKey: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  type: 'openai-compatible',
  baseUrl: '',
  apiKey: '',
  purposes: ['intent-recognition'],
  status: 'ENABLED',
};

function providerToForm(provider: LlmProvider): FormState {
  return {
    name: provider.name,
    type: provider.type,
    baseUrl: provider.baseUrl,
    apiKey: '',
    purposes: provider.purposes,
    status: provider.status,
  };
}

function providerFormDiff(before: LlmProvider | null, form: FormState) {
  const beforeFields: Record<string, unknown> = before
    ? {
        name: before.name,
        type: before.type,
        baseUrl: before.baseUrl,
        purposes: before.purposes,
        status: before.status,
      }
    : {};
  const afterFields: Record<string, unknown> = {
    name: form.name,
    type: form.type,
    baseUrl: form.baseUrl,
    purposes: form.purposes,
    status: form.status,
  };
  const entries = buildDiffEntries(beforeFields, afterFields);
  if (form.apiKey) {
    entries.push({
      key: 'apiKey',
      before: before?.apiKeyMask === '••••' ? '••••' : '（未设置）',
      after: '（已更新）',
      kind: 'changed',
    });
  }
  return entries;
}

export function LlmProvidersPage() {
  const canManage = useCanManageLlmProvider();
  const query = useLlmProviders();
  const createMutation = useCreateLlmProvider();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingProvider, setDeletingProvider] = useState<LlmProvider | null>(null);

  const updateMutation = useUpdateLlmProvider(editingId ?? '');
  const deleteMutation = useDeleteLlmProvider(deletingProvider?.llmProviderId ?? '');

  const editingProvider =
    query.data?.providers.find((p) => p.llmProviderId === editingId) ?? null;

  const openEdit = (provider: LlmProvider) => {
    setEditingId(provider.llmProviderId);
    setForm(providerToForm(provider));
    setFormOpen(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(false);
    setConfirmOpen(false);
  };

  const handleSubmitForm = () => setConfirmOpen(true);

  const handleConfirm = async () => {
    const payload: LlmProviderUpsertRequest = {
      name: form.name,
      type: form.type,
      baseUrl: form.baseUrl,
      purposes: form.purposes,
      status: form.status,
      ...(form.apiKey ? { apiKey: form.apiKey } : {}),
    };
    if (editingId) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }
    closeForm();
  };

  return (
    <AdminPageShell
      title="LLM Provider"
      description="管理 LLM Provider 配置；启用 / 禁用、Provider 类型与 baseUrl 都需要二次确认。"
      permitted={canManage}
      missingPermission="llm_provider:manage"
      unauthorizedDescription="LLM Provider 管理仅对具备 llm_provider:manage 权限的角色开放。"
    >
      <Card>
        <CardHeader>
          <CardTitle>Provider 列表</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditingId(null);
              setForm({ ...EMPTY_FORM });
              setFormOpen(true);
            }}
            data-testid="llm-provider-new"
          >
            新建
          </Button>
        </CardHeader>
        <CardBody>
          {query.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : query.isError ? (
            <ErrorState description={query.error.message} />
          ) : query.data.providers.length === 0 ? (
            <p className="text-sm text-gray-500">暂无 Provider，可点击右上角“新建”。</p>
          ) : (
            <ul className="divide-y divide-gray-100" data-testid="llm-provider-list">
              {query.data.providers.map((provider) => (
                <ProviderRow
                  key={provider.llmProviderId}
                  provider={provider}
                  onEdit={() => openEdit(provider)}
                  onDelete={() => setDeletingProvider(provider)}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Dialog
        open={formOpen}
        onClose={closeForm}
        title={editingId ? '编辑 LLM Provider' : '新建 LLM Provider'}
      >
        <ProviderForm
          form={form}
          onChange={setForm}
          onSubmit={handleSubmitForm}
          submitLabel={editingId ? '检查改动' : '提交新建'}
        />
      </Dialog>

      <DiffSummaryDialog
        open={confirmOpen}
        title={editingId ? '确认修改 LLM Provider' : '确认新建 LLM Provider'}
        description={editingProvider ? `Provider ID：${editingProvider.llmProviderId}` : undefined}
        entries={providerFormDiff(editingProvider, form)}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />

      <ConfirmationDialog
        open={deletingProvider !== null}
        actionDescription="删除 LLM Provider"
        targetScope={deletingProvider?.name ?? ''}
        riskLevelText="删除后无法恢复"
        onCancel={() => setDeletingProvider(null)}
        onConfirm={async () => {
          if (deletingProvider) {
            await deleteMutation.mutateAsync();
          }
          setDeletingProvider(null);
        }}
        confirmLabel="确认删除"
      />
    </AdminPageShell>
  );
}

interface ProviderRowProps {
  provider: LlmProvider;
  onEdit: () => void;
  onDelete: () => void;
}

function ProviderRow({ provider, onEdit, onDelete }: ProviderRowProps) {
  const toggle = useToggleLlmProvider(provider.llmProviderId);
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-3 py-3"
      data-testid={`llm-provider-row-${provider.llmProviderId}`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          {provider.name}
          <StatusBadge status={{ kind: 'admin-status', value: provider.status }} />
        </div>
        <div className="text-xs text-gray-500">
          {provider.type} · {provider.baseUrl}
        </div>
        <div className="text-xs text-gray-500">
          用途：{provider.purposes.join(' / ') || '—'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => toggle.mutate()}>
          {provider.status === 'ENABLED' ? '禁用' : '启用'}
        </Button>
        <Button size="sm" variant="secondary" onClick={onEdit}>
          编辑
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          删除
        </Button>
      </div>
    </li>
  );
}

interface ProviderFormProps {
  form: FormState;
  onChange: (next: FormState) => void;
  onSubmit: () => void;
  submitLabel: string;
}

function ProviderForm({ form, onChange, onSubmit, submitLabel }: ProviderFormProps) {
  const update = (patch: Partial<FormState>) => onChange({ ...form, ...patch });
  return (
    <div className="space-y-3" data-testid="llm-provider-form">
      <label className="flex flex-col gap-1 text-sm">
        名称
        <Input
          data-testid="llm-provider-form-name"
          value={form.name}
          onChange={(event) => update({ name: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        类型
        <Select
          data-testid="llm-provider-form-type"
          value={form.type}
          onChange={(event) =>
            update({ type: event.target.value as FormState['type'] })
          }
        >
          {llmProviderTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Base URL
        <Input
          data-testid="llm-provider-form-baseurl"
          value={form.baseUrl}
          onChange={(event) => update({ baseUrl: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        API Key（留空表示不修改；现有值显示为 ••••）
        <Input
          data-testid="llm-provider-form-apikey"
          type="password"
          value={form.apiKey}
          onChange={(event) => update({ apiKey: event.target.value })}
          placeholder="••••"
        />
      </label>
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="font-medium">用途</legend>
        {llmProviderPurposes.map((purpose) => (
          <label key={purpose} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.purposes.includes(purpose)}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...form.purposes, purpose]
                  : form.purposes.filter((p) => p !== purpose);
                update({ purposes: next });
              }}
            />
            {purpose}
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.status === 'ENABLED'}
          onChange={(event) =>
            update({ status: event.target.checked ? 'ENABLED' : 'DISABLED' })
          }
        />
        启用
      </label>
      <div className="flex justify-end">
        <Button onClick={onSubmit} data-testid="llm-provider-form-submit">
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
