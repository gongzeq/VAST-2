/**
 * Tool config admin page (PR4).
 *
 * 7 tools fixed; only edit per intensity profile. High-intensity edits show
 * a banner reminding YOLO can't skip them.
 */
import { useState } from 'react';

import { Button } from '@/shared/components/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/components/Card';
import { Dialog } from '@/shared/components/Dialog';
import { ErrorState, Skeleton } from '@/shared/components';
import { Input } from '@/shared/components/Input';
import {
  toolNames,
  type ExecutionIntensity,
  type ToolConfig,
  type ToolConfigUpdateRequest,
  type ToolIntensityProfile,
  type ToolName,
} from '@/shared/contracts';
import { useCanManageToolConfig } from '@/shared/hooks/use-can';

import {
  AdminPageShell,
  DiffSummaryDialog,
  buildDiffEntries,
} from '../components/_shared';
import { useToolConfigs, useUpdateToolConfig } from '../hooks';

const INTENSITIES: ExecutionIntensity[] = ['LOW', 'MEDIUM', 'HIGH'];

interface FormState {
  version: string;
  path: string;
  intensities: Record<ExecutionIntensity, ToolIntensityProfile>;
}

function toolToForm(tool: ToolConfig): FormState {
  return {
    version: tool.version,
    path: tool.path,
    intensities: { ...tool.intensities },
  };
}

function flatten(form: FormState): Record<string, unknown> {
  return {
    version: form.version,
    path: form.path,
    'LOW.concurrency': form.intensities.LOW.concurrency,
    'LOW.rateLimitPerSecond': form.intensities.LOW.rateLimitPerSecond,
    'LOW.timeoutSeconds': form.intensities.LOW.timeoutSeconds,
    'LOW.notes': form.intensities.LOW.notes,
    'MEDIUM.concurrency': form.intensities.MEDIUM.concurrency,
    'MEDIUM.rateLimitPerSecond': form.intensities.MEDIUM.rateLimitPerSecond,
    'MEDIUM.timeoutSeconds': form.intensities.MEDIUM.timeoutSeconds,
    'MEDIUM.notes': form.intensities.MEDIUM.notes,
    'HIGH.concurrency': form.intensities.HIGH.concurrency,
    'HIGH.rateLimitPerSecond': form.intensities.HIGH.rateLimitPerSecond,
    'HIGH.timeoutSeconds': form.intensities.HIGH.timeoutSeconds,
    'HIGH.notes': form.intensities.HIGH.notes,
  };
}

export function ToolConfigsPage() {
  const canManage = useCanManageToolConfig();
  const query = useToolConfigs();
  const [editing, setEditing] = useState<ToolConfig | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const updateMutation = useUpdateToolConfig((editing?.tool ?? toolNames[0]) as ToolName);

  const openEdit = (tool: ToolConfig) => {
    setEditing(tool);
    setForm(toolToForm(tool));
  };

  const closeForm = () => {
    setEditing(null);
    setForm(null);
    setConfirmOpen(false);
  };

  const handleConfirm = async () => {
    if (!editing || !form) return;
    const payload: ToolConfigUpdateRequest = {
      version: form.version,
      path: form.path,
      intensities: form.intensities,
    };
    await updateMutation.mutateAsync(payload);
    closeForm();
  };

  return (
    <AdminPageShell
      title="工具配置"
      description="7 个内置工具的版本、路径、低/中/高档位参数；高强度档位修改不可被 YOLO 跳过。"
      permitted={canManage}
      missingPermission="tool_config:manage"
    >
      <Card>
        <CardHeader>
          <CardTitle>工具列表</CardTitle>
        </CardHeader>
        <CardBody>
          {query.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : query.isError ? (
            <ErrorState description={query.error.message} />
          ) : (
            <ul className="divide-y divide-gray-100" data-testid="tool-config-list">
              {query.data.toolConfigs.map((tool) => (
                <li
                  key={tool.tool}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                  data-testid={`tool-config-row-${tool.tool}`}
                >
                  <div className="space-y-1">
                    <div className="font-medium text-gray-900">{tool.tool}</div>
                    <div className="text-xs text-gray-500">
                      version {tool.version} · path {tool.path}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(tool)}>
                    编辑
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Dialog
        open={editing !== null && form !== null}
        onClose={closeForm}
        title={editing ? `编辑工具 · ${editing.tool}` : ''}
        description="高强度档位修改后仍受 YOLO 强制确认约束，YOLO 不可跳过。"
      >
        {form ? (
          <div className="space-y-4 text-sm" data-testid="tool-config-form">
            <label className="flex flex-col gap-1">
              version
              <Input
                value={form.version}
                onChange={(event) => setForm({ ...form, version: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              path
              <Input
                value={form.path}
                onChange={(event) => setForm({ ...form, path: event.target.value })}
              />
            </label>
            {INTENSITIES.map((intensity) => (
              <fieldset
                key={intensity}
                className="rounded border border-gray-200 p-2"
                data-testid={`tool-config-intensity-${intensity}`}
              >
                <legend className="text-xs font-semibold text-gray-700">{intensity}</legend>
                {intensity === 'HIGH' ? (
                  <p
                    className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700"
                    data-testid="tool-config-high-warning"
                  >
                    高强度档位不可被 YOLO 跳过；修改后仍需用户二次确认。
                  </p>
                ) : null}
                <IntensityInputs
                  profile={form.intensities[intensity]}
                  onChange={(next) =>
                    setForm({
                      ...form,
                      intensities: { ...form.intensities, [intensity]: next },
                    })
                  }
                />
              </fieldset>
            ))}
            <div className="flex justify-end">
              <Button onClick={() => setConfirmOpen(true)} data-testid="tool-config-form-submit">
                检查改动
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <DiffSummaryDialog
        open={confirmOpen && form !== null && editing !== null}
        title={editing ? `确认更新工具 · ${editing.tool}` : ''}
        entries={
          editing && form
            ? buildDiffEntries(flatten(toolToForm(editing)), flatten(form))
            : []
        }
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </AdminPageShell>
  );
}

interface IntensityInputsProps {
  profile: ToolIntensityProfile;
  onChange: (next: ToolIntensityProfile) => void;
}

function IntensityInputs({ profile, onChange }: IntensityInputsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <label className="flex flex-col gap-1">
        concurrency
        <Input
          type="number"
          min={1}
          value={profile.concurrency}
          onChange={(event) =>
            onChange({ ...profile, concurrency: Number(event.target.value) || 1 })
          }
        />
      </label>
      <label className="flex flex-col gap-1">
        rate (req/s)
        <Input
          type="number"
          min={0}
          step={0.1}
          value={profile.rateLimitPerSecond}
          onChange={(event) =>
            onChange({ ...profile, rateLimitPerSecond: Number(event.target.value) || 0 })
          }
        />
      </label>
      <label className="flex flex-col gap-1">
        timeout (s)
        <Input
          type="number"
          min={1}
          value={profile.timeoutSeconds}
          onChange={(event) =>
            onChange({ ...profile, timeoutSeconds: Number(event.target.value) || 1 })
          }
        />
      </label>
      <label className="flex flex-col gap-1">
        notes
        <Input
          value={profile.notes}
          onChange={(event) => onChange({ ...profile, notes: event.target.value })}
        />
      </label>
    </div>
  );
}
