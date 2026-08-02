/**
 * Verifies that web task cards show the server-resolved linked-lead label
 * (leadLabel from GET /v1/tasks) linking to /leads/:id, and that tasks
 * without a leadId show no label. Labels come from the API — the page no
 * longer downloads the capped lead list to label tasks.
 */
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Tasks from './tasks';
import { mockApi, sampleTask } from '@/test/mock-api';
import { renderWithQuery } from '@/test/render';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const namedLead = { id: 'lead-named-000' };
const unnamedLead = { id: 'lead-unnamed-00' };

const tasks = [
  { ...sampleTask, id: 'task-named', title: 'Call the adjuster', leadId: namedLead.id, leadLabel: 'Jane Homeowner' },
  { ...sampleTask, id: 'task-fallback', title: 'Order materials', leadId: unnamedLead.id, leadLabel: null },
  { ...sampleTask, id: 'task-nolead', title: 'File paperwork', leadId: null, leadLabel: null },
];

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function mockTasksApi() {
  mockApi('sales_rep', {
    handler: (method, path) => {
      if (method !== 'GET') return undefined;
      if (path.endsWith('/api/v1/tasks')) return json(tasks);
      return undefined;
    },
  });
}

describe('task cards show the linked-lead label', () => {
  it('labels the task with the lead contact name and links to the lead page', async () => {
    mockTasksApi();
    renderWithQuery(<Tasks />);
    const link = await screen.findByTestId('task-lead-link-task-named');
    expect(link.textContent).toContain('Jane Homeowner');
    expect(link.getAttribute('href')).toBe(`/leads/${namedLead.id}`);
  });

  it('falls back to a generic link when the server has no label for the lead', async () => {
    mockTasksApi();
    renderWithQuery(<Tasks />);
    const link = await screen.findByTestId('task-lead-link-task-fallback');
    expect(link.textContent).toContain('View lead');
    expect(link.textContent).not.toContain('Jane Homeowner');
    expect(link.getAttribute('href')).toBe(`/leads/${unnamedLead.id}`);
  });

  it('shows no lead label for tasks without a leadId', async () => {
    mockTasksApi();
    renderWithQuery(<Tasks />);
    // Title renders twice (mobile + desktop layouts), so match all.
    await screen.findAllByText('File paperwork');
    expect(screen.queryByTestId('task-lead-link-task-nolead')).toBeNull();
    // Only the two lead-linked tasks render a label.
    expect(screen.getAllByTestId(/^task-lead-link-/)).toHaveLength(2);
  });
});
