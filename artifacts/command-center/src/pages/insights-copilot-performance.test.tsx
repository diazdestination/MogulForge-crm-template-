/**
 * The Conversion Insights page must surface the copilot performance section
 * (acceptance per action type + acted-on vs dismissed won-rate comparison)
 * when feedback exists — even without playbook touches — and hide it when
 * there's no feedback at all.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import Insights from '@/pages/insights';
import { renderWithQuery } from '@/test/render';
import { mockApi } from '@/test/mock-api';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const emptyPlaybookInsights = {
  funnel: [],
  decisions: [],
  baselineReplyRate: 0,
  engineReplyRate: 0,
  liftPercent: null,
  totalTouches: 0,
};

function renderInsights(copilot: Record<string, unknown>) {
  mockApi('admin', {
    handler: (method, path) => {
      if (method !== 'GET') return undefined;
      if (path.includes('/api/v1/copilot-performance')) return json(copilot);
      if (path.includes('/api/v1/playbook-insights')) return json(emptyPlaybookInsights);
      return undefined;
    },
  });
  renderWithQuery(<Insights />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('insights copilot performance section', () => {
  it('shows acceptance per action type and the conversion comparison', async () => {
    renderInsights({
      byActionType: [
        {
          actionType: 'call_now',
          sent: 6,
          edited: 2,
          snoozed: 1,
          dismissed: 1,
          total: 10,
          acceptanceRate: 0.8,
        },
        {
          actionType: 'send_message',
          sent: 0,
          edited: 0,
          snoozed: 0,
          dismissed: 4,
          total: 4,
          acceptanceRate: 0,
        },
      ],
      conversion: { actedLeads: 5, actedWon: 3, dismissedLeads: 4, dismissedWon: 1 },
      totalFeedback: 14,
    });

    const section = await screen.findByTestId('copilot-performance');
    expect(section.textContent).toContain('Copilot performance');
    expect(section.textContent).toContain('Call now');
    expect(section.textContent).toContain('Send a check-in');
    // call_now acceptance: (6+2)/10 = 80%
    expect(section.textContent).toContain('80%');
    const acted = screen.getByTestId('acted-won-rate');
    expect(acted.textContent).toContain('60%');
    expect(acted.textContent).toContain('3 of 5 leads');
    const dismissed = screen.getByTestId('dismissed-won-rate');
    expect(dismissed.textContent).toContain('25%');
    expect(dismissed.textContent).toContain('1 of 4 leads');
  });

  it('stays hidden and shows the empty state when there is no feedback', async () => {
    renderInsights({
      byActionType: [],
      conversion: { actedLeads: 0, actedWon: 0, dismissedLeads: 0, dismissedWon: 0 },
      totalFeedback: 0,
    });

    await screen.findByText(/no outreach data yet/i);
    expect(screen.queryByTestId('copilot-performance')).toBeNull();
  });
});
