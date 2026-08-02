/**
 * The dashboard must surface the automation-email failure banner for admins
 * (streak > 0 from GET /v1/settings/email-provider), stay silent when sends
 * are healthy, and never call the admin-only endpoint for non-admin roles.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import Dashboard from '@/pages/dashboard';
import { renderWithQuery } from '@/test/render';
import { mockApi } from '@/test/mock-api';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const emptySummary = {
  totalLeads: 0,
  openTasks: 0,
  upcomingAppointments: 0,
  unansweredPortalMessages: 0,
  leadsByStatus: [],
  recentActivity: [],
};

function renderDashboard(
  role: string,
  emailProvider: Record<string, unknown> | null,
  requests: string[],
) {
  mockApi(role, {
    handler: (method, path) => {
      if (method !== 'GET') return undefined;
      if (path.includes('/api/v1/settings/email-provider')) {
        requests.push(path);
        return json(emailProvider ?? {});
      }
      if (path.includes('/api/v1/dashboard/marketing')) {
        return json({
          totalPageViews: 0,
          uniqueVisitors: 0,
          aiReferralViews: 0,
          landingPages: [],
          referrers: [],
        });
      }
      if (path.includes('/api/v1/dashboard')) return json(emptySummary);
      return undefined;
    },
  });
  renderWithQuery(<Dashboard />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('dashboard email failure banner', () => {
  it('shows the banner to admins when recent sends are failing', async () => {
    const requests: string[] = [];
    renderDashboard('admin', {
      provider: 'gmail',
      senderEmail: 'ops@painless.example',
      recentSendFailures: 3,
      lastSendFailureAt: new Date().toISOString(),
      lastSendFailureDetail: 'invalid_grant',
    }, requests);

    const banner = await screen.findByTestId('banner-dashboard-email-send-failures');
    expect(banner.textContent).toContain('Automation emails are failing to send');
    expect(banner.textContent).toContain('3 email send attempts');
    expect(banner.textContent).toContain('invalid_grant');
    expect(requests.length).toBeGreaterThan(0);
  });

  it('stays hidden for admins when there is no failure streak', async () => {
    const requests: string[] = [];
    renderDashboard('admin', {
      provider: 'gmail',
      senderEmail: 'ops@painless.example',
      recentSendFailures: 0,
    }, requests);

    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(screen.queryByTestId('banner-dashboard-email-send-failures')).toBeNull();
  });

  it('does not call the admin-only endpoint for non-admin roles', async () => {
    const requests: string[] = [];
    renderDashboard('sales_rep', null, requests);

    await screen.findByText(/welcome back/i);
    // Give any stray query a tick to fire before asserting silence.
    await new Promise((r) => setTimeout(r, 50));
    expect(requests).toHaveLength(0);
  });
});
