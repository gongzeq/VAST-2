/**
 * PR4 admin LLM Provider integration test.
 *
 * Verifies the create → toggle → delete loop round-trips through the MSW
 * handler at the UI layer (form submit → diff dialog → list refresh) and that
 * admin mutations append synthetic audit log entries on each step.
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LlmProvidersPage } from '@/features/admin-settings';
import { db, resetDb } from '@/app/msw/db';
import { fixtureActor, renderWithProviders } from '@/tests/test-utils';

describe('admin / LLM Provider CRUD', () => {
  it('admin can create, toggle, and delete an LLM Provider via MSW', async () => {
    resetDb();
    db().actor = fixtureActor.admin();
    const initialAuditCount = db().auditLogEntries.size;

    const user = userEvent.setup();
    renderWithProviders(<LlmProvidersPage />, {
      initialActor: fixtureActor.admin(),
      initialEntries: ['/admin/llm-providers'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('llm-provider-list')).toBeInTheDocument();
    });
    const initialRows = within(screen.getByTestId('llm-provider-list')).getAllByRole('listitem');
    const initialCount = initialRows.length;

    // 1. Create.
    await user.click(screen.getByTestId('llm-provider-new'));
    const nameInput = await screen.findByTestId('llm-provider-form-name');
    await user.clear(nameInput);
    await user.type(nameInput, '集成测试 Provider');
    const baseUrlInput = screen.getByTestId('llm-provider-form-baseurl');
    await user.clear(baseUrlInput);
    await user.type(baseUrlInput, 'https://test.example/v1');
    await user.click(screen.getByTestId('llm-provider-form-submit'));

    const confirmBtn = await screen.findByTestId('diff-summary-confirm');
    await user.click(confirmBtn);

    await waitFor(() => {
      const rows = within(screen.getByTestId('llm-provider-list')).getAllByRole('listitem');
      expect(rows.length).toBe(initialCount + 1);
    });
    expect(db().auditLogEntries.size).toBe(initialAuditCount + 1);

    // Identify the new provider row from the db so we can drive toggle + delete.
    const created = Array.from(db().llmProviders.values()).find(
      (p) => p.name === '集成测试 Provider',
    );
    expect(created).toBeDefined();
    const createdId = created!.llmProviderId;
    const initialStatus = created!.status;
    const row = within(screen.getByTestId('llm-provider-list')).getByTestId(
      `llm-provider-row-${createdId}`,
    );

    // 2. Toggle (启用 ↔ 禁用).
    const toggleButton = within(row).getByRole('button', {
      name: initialStatus === 'ENABLED' ? '禁用' : '启用',
    });
    await user.click(toggleButton);
    await waitFor(() => {
      expect(db().llmProviders.get(createdId)!.status).not.toBe(initialStatus);
    });
    expect(db().auditLogEntries.size).toBe(initialAuditCount + 2);

    // 3. Delete via the row's destructive button + ConfirmationDialog.
    const refreshedRow = within(screen.getByTestId('llm-provider-list')).getByTestId(
      `llm-provider-row-${createdId}`,
    );
    await user.click(within(refreshedRow).getByRole('button', { name: '删除' }));
    await user.click(await screen.findByTestId('confirmation-confirm'));

    await waitFor(() => {
      expect(db().llmProviders.has(createdId)).toBe(false);
    });
    await waitFor(() => {
      const rows = within(screen.getByTestId('llm-provider-list')).getAllByRole('listitem');
      expect(rows.length).toBe(initialCount);
    });
    expect(db().auditLogEntries.size).toBe(initialAuditCount + 3);
  });

  it('non-admin actor sees UnauthorizedState (no redirect)', () => {
    resetDb();
    db().actor = fixtureActor.auditor();
    renderWithProviders(<LlmProvidersPage />, {
      initialActor: fixtureActor.auditor(),
      initialEntries: ['/admin/llm-providers'],
    });
    const unauthorized = screen.getByTestId('unauthorized-state');
    expect(unauthorized).toBeInTheDocument();
    expect(unauthorized.textContent).toContain('llm_provider:manage');
  });
});
