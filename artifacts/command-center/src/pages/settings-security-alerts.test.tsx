/**
 * The API Keys settings tab must call out recent `api_key.brute_force_blocked`
 * audit events in a prominent banner (when it happened + the offending IP),
 * ignore stale events outside the alert window, and stay silent when there
 * are no such events.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import Settings from '@/pages/settings';
import { renderWithQuery } from '@/test/render';
import { mockApi } from '@/test/mock-api';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const recentAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const staleAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

const auditEvent = (id: string, createdAt: string, action = 'api_key.brute_force_blocked') => ({
  id,
  organizationId: 'o1',
  actorUserId: null,
  action,
  entityType: 'api_key',
  entityId: null,
  metadata: { ip: '203.0.113.9', maxFailures: 20, windowMs: 900000 },
  createdAt,
});

const auditRequests: string[] = [];

function renderApiKeysTab(
  auditEvents: unknown[],
  opts: { acknowledgedAt?: string | null } = {},
) {
  let acknowledgedAt = opts.acknowledgedAt ?? null;
  const fetchMock = mockApi('admin', {
    handler: (method, path, rawUrl) => {
      if (method === 'GET' && path.includes('/api/v1/audit-events')) {
        auditRequests.push(rawUrl ?? path);
        // Emulate the server-side action/since filters so the banner is
        // exercised against what the API would actually return.
        const url = new URL(rawUrl ?? path, 'http://test.local');
        const action = url.searchParams.get('action');
        const since = url.searchParams.get('since');
        const filtered = (auditEvents as { action?: string; createdAt?: string }[]).filter(
          (e) =>
            (!action || e.action === action) &&
            (!since || new Date(e.createdAt ?? 0).getTime() >= new Date(since).getTime()),
        );
        return json(filtered);
      }
      if (path.endsWith('/api/v1/settings')) {
        if (method === 'PUT') {
          // The real server stores the ack; mirror it so the refetch hides the banner.
          acknowledgedAt = new Date().toISOString();
        }
        return json({
          id: 's1',
          organizationId: 'o1',
          businessProfile: {},
          services: [],
          serviceAreas: [],
          securityAlertsAcknowledgedAt: acknowledgedAt,
        });
      }
      return undefined;
    },
  });
  renderWithQuery(<Settings />);
  return fetchMock;
}

async function openApiKeysTab() {
  const tab = await screen.findByRole('tab', { name: /api keys/i });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
}

describe('API keys security alert banner', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    auditRequests.length = 0;
  });

  it('shows a banner with time and offending IP for a recent brute-force block', async () => {
    renderApiKeysTab([auditEvent('e1', recentAt)]);
    await openApiKeysTab();

    const banner = await screen.findByTestId('alert-brute-force');
    expect(banner.textContent).toMatch(/api key guessing attempts blocked/i);
    expect(banner.textContent).toContain('203.0.113.9');
    expect(banner.textContent).toContain(new Date(recentAt).toLocaleString());

    // The banner must ask the server for just the security events, so a busy
    // audit log can't crowd the alert out of the newest-200 window.
    const req = auditRequests.find((p) => p.includes('action='));
    expect(req).toBeDefined();
    const url = new URL(req!, 'http://test.local');
    expect(url.searchParams.get('action')).toBe('api_key.brute_force_blocked');
    expect(url.searchParams.get('since')).toBeTruthy();
  });

  it('ignores stale and unrelated audit events', async () => {
    renderApiKeysTab([
      auditEvent('e-old', staleAt),
      auditEvent('e-other', recentAt, 'api_key.created'),
    ]);
    await openApiKeysTab();

    await screen.findByText(/new api key/i);
    await waitFor(() => {
      expect(screen.queryByTestId('alert-brute-force')).toBeNull();
    });
  });

  it('dismissing the banner acknowledges the newest alert and hides it', async () => {
    const fetchMock = renderApiKeysTab([auditEvent('e1', recentAt)]);
    await openApiKeysTab();

    const dismiss = await screen.findByTestId('button-dismiss-brute-force-alert');
    fireEvent.click(dismiss);

    await waitFor(() => {
      expect(screen.queryByTestId('alert-brute-force')).toBeNull();
    });
    const put = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method?.toUpperCase() === 'PUT',
    );
    expect(put).toBeTruthy();
    const body = JSON.parse((put![1] as RequestInit).body as string) as {
      securityAlertsAcknowledgedAt: string;
    };
    expect(new Date(body.securityAlertsAcknowledgedAt).getTime()).toBe(
      new Date(recentAt).getTime(),
    );
  });

  it('keeps the banner hidden for acknowledged alerts but shows newer ones', async () => {
    const ackAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const newerAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    renderApiKeysTab(
      [auditEvent('e-acked', recentAt), auditEvent('e-new', newerAt)],
      { acknowledgedAt: ackAt },
    );
    await openApiKeysTab();

    const banner = await screen.findByTestId('alert-brute-force');
    expect(screen.queryByTestId('alert-brute-force-e-new')).not.toBeNull();
    expect(screen.queryByTestId('alert-brute-force-e-acked')).toBeNull();
    expect(banner.textContent).not.toContain('(2 in the last 7 days)');
  });

  it('stays hidden when every alert is acknowledged', async () => {
    renderApiKeysTab([auditEvent('e1', recentAt)], {
      acknowledgedAt: new Date().toISOString(),
    });
    await openApiKeysTab();

    await screen.findByText(/new api key/i);
    expect(screen.queryByTestId('alert-brute-force')).toBeNull();
  });

  it('renders no banner when there are no audit events', async () => {
    renderApiKeysTab([]);
    await openApiKeysTab();

    await screen.findByText(/new api key/i);
    expect(screen.queryByTestId('alert-brute-force')).toBeNull();
  });
});
