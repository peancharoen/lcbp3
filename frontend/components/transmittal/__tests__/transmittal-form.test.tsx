// File: frontend/components/transmittal/__tests__/transmittal-form.test.tsx
// Change Log
// - 2026-06-13: Add coverage for transmittal form render, cancel, validation, and submit flows.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { createTestQueryClient } from '@/lib/test-utils';
import { TransmittalForm } from '../transmittal-form';
import { transmittalService } from '@/lib/services/transmittal.service';
import { correspondenceService } from '@/lib/services/correspondence.service';
import { projectService } from '@/lib/services/project.service';
import { organizationService } from '@/lib/services/organization.service';

const push = vi.fn();
const back = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back }),
}));

vi.mock('@/lib/services/transmittal.service', () => ({
  transmittalService: {
    create: vi.fn(),
  },
}));

vi.mock('@/lib/services/correspondence.service', () => ({
  correspondenceService: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/lib/services/project.service', () => ({
  projectService: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/lib/services/organization.service', () => ({
  organizationService: {
    getAll: vi.fn(),
  },
}));

function renderForm() {
  const { wrapper } = createTestQueryClient();
  return render(<TransmittalForm />, { wrapper });
}

async function chooseCombobox(label: string | RegExp, option: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: label }));
  const matches = await screen.findAllByText(option);
  await user.click(matches[matches.length - 1]);
}

describe('TransmittalForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(projectService.getAll).mockResolvedValue({
      data: [{ publicId: '019505a1-7c3e-7000-8000-abc123defc01', projectName: 'LCBP3' }],
    });
    vi.mocked(organizationService.getAll).mockResolvedValue({
      data: [{ uuid: '019505a1-7c3e-7000-8000-abc123defc02', organizationName: 'TEAM Consulting' }],
    });
    vi.mocked(correspondenceService.getAll).mockResolvedValue({
      data: [{ uuid: '019505a1-7c3e-7000-8000-abc123defc03', correspondenceNumber: 'COR-001' }],
    });
    vi.mocked(transmittalService.create).mockResolvedValue({
      uuid: '019505a1-7c3e-7000-8000-abc123defc04',
      correspondence: { uuid: '019505a1-7c3e-7000-8000-abc123defc05' },
    });
  });

  it('renders main sections and supports cancel navigation', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(await screen.findByText('Transmittal Details')).toBeInTheDocument();
    expect(screen.getByText('Transmittal Items')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(back).toHaveBeenCalled();
  });

  it('shows validation errors when required fields are missing', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(await screen.findByRole('button', { name: 'Create Transmittal' }));
    expect(await screen.findByText('Project is required')).toBeInTheDocument();
    expect(screen.getByText('Recipient is required')).toBeInTheDocument();
    expect(screen.getByText('Correspondence is required')).toBeInTheDocument();
    expect(screen.getByText('Subject is required')).toBeInTheDocument();
  });

  it('submits cleaned transmittal payload and navigates to created record', async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText('Transmittal Details');
    await chooseCombobox(/project/i, 'LCBP3');
    await chooseCombobox(/recipient organization/i, 'TEAM Consulting');
    await user.click(screen.getByRole('combobox', { name: /reference document/i }));
    await user.click(await screen.findByText('COR-001'));
    await user.type(screen.getByPlaceholderText('Enter transmittal subject'), 'Weekly package');
    await user.clear(screen.getByPlaceholderText('ID'));
    await user.type(screen.getByPlaceholderText('ID'), '12');
    await user.type(screen.getByPlaceholderText('Copies/Notes'), 'For record');
    await user.type(screen.getByPlaceholderText('Additional notes...'), 'Submitted by test');
    await user.click(screen.getByRole('button', { name: 'Create Transmittal' }));
    await waitFor(() => {
      expect(transmittalService.create).toHaveBeenCalledWith({
        projectId: '019505a1-7c3e-7000-8000-abc123defc01',
        recipientOrganizationId: '019505a1-7c3e-7000-8000-abc123defc02',
        correspondenceId: '019505a1-7c3e-7000-8000-abc123defc03',
        subject: 'Weekly package',
        purpose: 'FOR_APPROVAL',
        remarks: 'Submitted by test',
        items: [{ itemType: 'DRAWING', itemId: 12, description: 'For record' }],
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Transmittal created successfully');
    expect(push).toHaveBeenCalledWith('/transmittals/019505a1-7c3e-7000-8000-abc123defc05');
  });
});
