/**
 * Verifies the Audit Log page itself blocks direct URL visits by
 * non-admins: viewer and sales_rep are redirected back to the dashboard,
 * while admin/owner see the audit trail.
 */
import { cleanup, screen, waitFor } from '@testing-library/react';
import { memoryLocation } from 'wouter/memory-location';
import { Router } from 'wouter';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AuditLog from '@/pages/audit';
import { mockApi } from '@/test/mock-api';
import { renderWithQuery } from '@/test/render';

vi.mock('@workspace/replit-auth-web', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderAudit() {
  const { hook, history } = memoryLocation({ path: '/audit', record: true });
  renderWithQuery(
    <Router hook={hook}>
      <AuditLog />
    </Router>,
  );
  return { history };
}

describe('direct navigation to /audit', () => {
  it.each(['viewer', 'sales_rep'] as const)(
    'redirects a %s back to the dashboard',
    async (role) => {
      mockApi(role);
      const { history } = renderAudit();
      await waitFor(() => {
        expect(history[history.length - 1]).toBe('/');
      });
      expect(screen.queryByText('Audit Log')).toBeNull();
    },
  );

  it.each(['admin', 'owner'] as const)('lets an %s see the audit log', async (role) => {
    mockApi(role);
    const { history } = renderAudit();
    await screen.findByText('Audit Log');
    expect(screen.getByText('Immutable record of system changes.')).toBeTruthy();
    expect(history[history.length - 1]).toBe('/audit');
  });
});
