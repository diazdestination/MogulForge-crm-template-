/**
 * Verifies that viewers (read-only role) never see write/delete controls on
 * the contacts, leads (pipeline), tasks, and appointments screens, and that
 * privileged roles do.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Appointments from './appointments';
import Contacts from './contacts';
import Pipeline from './pipeline';
import Tasks from './tasks';
import { mockApi } from '@/test/mock-api';
import { renderWithQuery } from '@/test/render';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('viewer role sees no write/delete controls', () => {
  it('contacts: row renders but add/edit/delete are hidden', async () => {
    mockApi('viewer');
    renderWithQuery(<Contacts />);
    await screen.findAllByText(/Jane Homeowner/);
    expect(screen.queryAllByTestId('add-contact')).toHaveLength(0);
    expect(screen.queryAllByTestId('edit-contact')).toHaveLength(0);
    expect(screen.queryAllByTestId('delete-contact')).toHaveLength(0);
  });

  it('tasks: row renders but add/edit/delete are hidden and toggle disabled', async () => {
    mockApi('viewer');
    renderWithQuery(<Tasks />);
    await screen.findAllByText('Call the adjuster');
    expect(screen.queryAllByTestId('add-task')).toHaveLength(0);
    expect(screen.queryAllByTestId('edit-task')).toHaveLength(0);
    expect(screen.queryByTestId('delete-task')).toBeNull();
    const toggle = await screen.findByTestId('toggle-task-status');
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
  });

  it('appointments: card renders but schedule/edit/status controls are hidden', async () => {
    mockApi('viewer');
    renderWithQuery(<Appointments />);
    await screen.findByText('Roof inspection');
    expect(screen.queryByTestId('add-appointment')).toBeNull();
    expect(screen.queryByTestId('edit-appointment')).toBeNull();
    expect(screen.queryByTestId('appointment-status-select')).toBeNull();
  });

  it('pipeline (leads): card renders but stage selector and bulk checkboxes are hidden', async () => {
    mockApi('viewer');
    renderWithQuery(<Pipeline />);
    await screen.findByText('Hail damage roof');
    expect(screen.queryByTestId('lead-status-select')).toBeNull();
    expect(screen.queryByLabelText(/Select all leads/)).toBeNull();
  });

  // Saved filters are deliberately exempt from viewer gating: the API scopes
  // them to the requesting user's own id and guards them with crm.read (see
  // the api-server route-inventory contract), so even read-only teammates may
  // save and delete their personal filters.
  it('pipeline (leads): viewers can still manage their own saved filters', async () => {
    mockApi('viewer');
    renderWithQuery(<Pipeline />);
    await screen.findByText('Hail damage roof');
    expect(screen.queryByTestId('save-filter')).not.toBeNull();
    const trigger = screen.getByText('Saved');
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    await screen.findByText('Hot leads');
    expect(screen.queryByTestId('delete-saved-filter')).not.toBeNull();
  });
});

describe('privileged roles keep their controls', () => {
  it('sales_manager: contacts show add, edit and delete', async () => {
    mockApi('sales_manager');
    renderWithQuery(<Contacts />);
    await screen.findAllByText(/Jane Homeowner/);
    await waitFor(() => {
      expect(screen.queryAllByTestId('add-contact').length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByTestId('edit-contact').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('delete-contact').length).toBeGreaterThan(0);
  });

  it('sales_rep: tasks show add and edit but not delete', async () => {
    mockApi('sales_rep');
    renderWithQuery(<Tasks />);
    await screen.findAllByText('Call the adjuster');
    await waitFor(() => {
      expect(screen.queryAllByTestId('add-task').length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByTestId('edit-task').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('delete-task')).toHaveLength(0);
  });

  it('sales_rep: appointments show schedule/edit/status controls', async () => {
    mockApi('sales_rep');
    renderWithQuery(<Appointments />);
    await screen.findByText('Roof inspection');
    await waitFor(() => {
      expect(screen.queryByTestId('add-appointment')).not.toBeNull();
    });
    expect(screen.queryByTestId('edit-appointment')).not.toBeNull();
    expect(screen.queryByTestId('appointment-status-select')).not.toBeNull();
  });

  it('sales_rep: pipeline shows stage selector on lead cards', async () => {
    mockApi('sales_rep');
    renderWithQuery(<Pipeline />);
    await screen.findByText('Hail damage roof');
    await waitFor(() => {
      expect(screen.queryByTestId('lead-status-select')).not.toBeNull();
    });
  });

  it('sales_rep: pipeline shows saved-filter save and delete controls', async () => {
    mockApi('sales_rep');
    renderWithQuery(<Pipeline />);
    await screen.findByText('Hail damage roof');
    await waitFor(() => {
      expect(screen.queryByTestId('save-filter')).not.toBeNull();
    });
    const trigger = screen.getByText('Saved');
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    await screen.findByText('Hot leads');
    expect(screen.queryByTestId('delete-saved-filter')).not.toBeNull();
  });
});
