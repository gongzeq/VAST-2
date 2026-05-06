/**
 * PR5 nav permission-awareness test.
 *
 * Verifies the AuthenticatedLayout renders disabled <span aria-disabled> for
 * nav items where the actor lacks the required permission, and an enabled
 * <NavLink> otherwise.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { AuthenticatedLayout } from '@/app/layouts/authenticated-layout';
import { db, resetDb } from '@/app/msw/db';
import { fixtureActor, renderWithProviders } from '@/tests/test-utils';

describe('authenticated nav permission awareness', () => {
  it('admin sees admin nav entries enabled', () => {
    resetDb();
    db().actor = fixtureActor.admin();
    renderWithProviders(<AuthenticatedLayout>占位</AuthenticatedLayout>, {
      initialActor: fixtureActor.admin(),
    });
    const llmNav = screen.getByTestId('nav-/admin/llm-providers');
    expect(llmNav.tagName.toLowerCase()).toBe('a');
    expect(llmNav.getAttribute('aria-disabled')).toBeNull();
  });

  it('viewer sees admin nav entries disabled with title hint', () => {
    resetDb();
    db().actor = fixtureActor.viewer();
    renderWithProviders(<AuthenticatedLayout>占位</AuthenticatedLayout>, {
      initialActor: fixtureActor.viewer(),
    });
    const llmNav = screen.getByTestId('nav-/admin/llm-providers');
    expect(llmNav.tagName.toLowerCase()).toBe('span');
    expect(llmNav.getAttribute('aria-disabled')).toBe('true');
    expect(llmNav.getAttribute('title')).toContain('llm_provider:manage');
  });

  it('auditor sees the audit nav enabled', () => {
    resetDb();
    db().actor = fixtureActor.auditor();
    renderWithProviders(<AuthenticatedLayout>占位</AuthenticatedLayout>, {
      initialActor: fixtureActor.auditor(),
    });
    const auditNav = screen.getByTestId('nav-/audit');
    expect(auditNav.tagName.toLowerCase()).toBe('a');
  });

  it('security engineer sees audit disabled', () => {
    resetDb();
    db().actor = fixtureActor.securityEngineer();
    renderWithProviders(<AuthenticatedLayout>占位</AuthenticatedLayout>, {
      initialActor: fixtureActor.securityEngineer(),
    });
    const auditNav = screen.getByTestId('nav-/audit');
    expect(auditNav.tagName.toLowerCase()).toBe('span');
    expect(auditNav.getAttribute('aria-disabled')).toBe('true');
  });
});
