// File: frontend/components/numbering/__tests__/manual-override-form.test.tsx
// Change Log:
// - 2026-06-13: Refactor to use static imports instead of require, fixing ESM module resolution errors
// - 2026-06-13: Correct field labels and trigger project validation correctly

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManualOverrideForm } from '../manual-override-form';
import { documentNumberingService } from '@/lib/services/document-numbering.service';
import { toast } from 'sonner';

// Mock documentNumberingService
vi.mock('@/lib/services/document-numbering.service', () => ({
  documentNumberingService: {
    manualOverride: vi.fn(),
  },
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ManualOverrideForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form with all required fields', () => {
    render(<ManualOverrideForm />);
    expect(screen.getByText('Manual Override Sequence')).toBeInTheDocument();
    expect(screen.getByText('Project ID')).toBeInTheDocument();
    expect(screen.getByText('Type ID')).toBeInTheDocument();
    expect(screen.getByText('Originator Org ID')).toBeInTheDocument();
    expect(screen.getByText('Recipient Org ID')).toBeInTheDocument();
    expect(screen.getByText('Set Last Number To')).toBeInTheDocument();
    expect(screen.getByText('Reason')).toBeInTheDocument();
  });

  it('should render with default projectId from props', () => {
    render(<ManualOverrideForm projectId={123} />);
    const projectIdInput = screen.getByLabelText('Project ID');
    expect(projectIdInput).toHaveValue(123);
  });

  it('should show validation error for empty project', async () => {
    render(<ManualOverrideForm />);
    const projectIdInput = screen.getByLabelText('Project ID');
    fireEvent.change(projectIdInput, { target: { value: '0' } });
    const submitButton = screen.getByText('Apply Override');
    const form = submitButton.closest('form');
    if (form) {
      fireEvent.submit(form);
    }
    await waitFor(() => {
      expect(screen.getByText(/Project is required/)).toBeInTheDocument();
    });
  });

  it('should show validation error for empty originator', async () => {
    render(<ManualOverrideForm />);
    const submitButton = screen.getByText('Apply Override');
    const form = submitButton.closest('form');
    if (form) {
      fireEvent.submit(form);
    }
    await waitFor(() => {
      expect(screen.getByText(/Originator is required/)).toBeInTheDocument();
    });
  });

  it('should show validation error for empty recipient', async () => {
    render(<ManualOverrideForm />);
    const submitButton = screen.getByText('Apply Override');
    const form = submitButton.closest('form');
    if (form) {
      fireEvent.submit(form);
    }
    await waitFor(() => {
      expect(screen.getByText(/Recipient is required/)).toBeInTheDocument();
    });
  });

  it('should show validation error for empty type', async () => {
    render(<ManualOverrideForm />);
    const submitButton = screen.getByText('Apply Override');
    const form = submitButton.closest('form');
    if (form) {
      fireEvent.submit(form);
    }
    await waitFor(() => {
      expect(screen.getByText(/Type is required/)).toBeInTheDocument();
    });
  });

  it('should show validation error for empty new number', async () => {
    render(<ManualOverrideForm />);
    const submitButton = screen.getByText('Apply Override');
    const form = submitButton.closest('form');
    if (form) {
      fireEvent.submit(form);
    }
    await waitFor(() => {
      expect(screen.getByText(/New number is required/)).toBeInTheDocument();
    });
  });

  it('should show validation error for short reason', async () => {
    render(<ManualOverrideForm />);
    const reasonInput = screen.getByLabelText('Reason');
    fireEvent.change(reasonInput, { target: { value: 'abc' } });
    const submitButton = screen.getByText('Apply Override');
    const form = submitButton.closest('form');
    if (form) {
      fireEvent.submit(form);
    }
    await waitFor(() => {
      expect(screen.getByText(/Reason must be at least 5 characters/)).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    (documentNumberingService.manualOverride as any).mockResolvedValue({ success: true });
    render(<ManualOverrideForm />);
    const projectIdInput = screen.getByLabelText('Project ID');
    fireEvent.change(projectIdInput, { target: { value: '1' } });
    const originatorInput = screen.getByLabelText('Originator Org ID');
    fireEvent.change(originatorInput, { target: { value: '1' } });
    const recipientInput = screen.getByLabelText('Recipient Org ID');
    fireEvent.change(recipientInput, { target: { value: '1' } });
    const typeInput = screen.getByLabelText('Type ID');
    fireEvent.change(typeInput, { target: { value: '1' } });
    const newNumberInput = screen.getByLabelText('Set Last Number To');
    fireEvent.change(newNumberInput, { target: { value: '100' } });
    const reasonInput = screen.getByLabelText('Reason');
    fireEvent.change(reasonInput, { target: { value: 'Test reason for override' } });
    const submitButton = screen.getByText('Apply Override');
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(documentNumberingService.manualOverride).toHaveBeenCalledWith({
        projectId: 1,
        originatorOrganizationId: 1,
        recipientOrganizationId: 1,
        correspondenceTypeId: 1,
        newLastNumber: 100,
        reason: 'Test reason for override',
        resetScope: 'YEAR_2025',
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Manual override applied successfully.');
  });

  it('should show error toast on submission failure', async () => {
    (documentNumberingService.manualOverride as any).mockRejectedValue(new Error('API Error'));
    render(<ManualOverrideForm />);
    const projectIdInput = screen.getByLabelText('Project ID');
    fireEvent.change(projectIdInput, { target: { value: '1' } });
    const originatorInput = screen.getByLabelText('Originator Org ID');
    fireEvent.change(originatorInput, { target: { value: '1' } });
    const recipientInput = screen.getByLabelText('Recipient Org ID');
    fireEvent.change(recipientInput, { target: { value: '1' } });
    const typeInput = screen.getByLabelText('Type ID');
    fireEvent.change(typeInput, { target: { value: '1' } });
    const newNumberInput = screen.getByLabelText('Set Last Number To');
    fireEvent.change(newNumberInput, { target: { value: '100' } });
    const reasonInput = screen.getByLabelText('Reason');
    fireEvent.change(reasonInput, { target: { value: 'Test reason for override' } });
    const submitButton = screen.getByText('Apply Override');
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to apply override.');
    });
  });

  it('should disable submit button while loading', async () => {
    (documentNumberingService.manualOverride as any).mockImplementation(() => new Promise(() => {}));
    render(<ManualOverrideForm />);
    const projectIdInput = screen.getByLabelText('Project ID');
    fireEvent.change(projectIdInput, { target: { value: '1' } });
    const originatorInput = screen.getByLabelText('Originator Org ID');
    fireEvent.change(originatorInput, { target: { value: '1' } });
    const recipientInput = screen.getByLabelText('Recipient Org ID');
    fireEvent.change(recipientInput, { target: { value: '1' } });
    const typeInput = screen.getByLabelText('Type ID');
    fireEvent.change(typeInput, { target: { value: '1' } });
    const newNumberInput = screen.getByLabelText('Set Last Number To');
    fireEvent.change(newNumberInput, { target: { value: '100' } });
    const reasonInput = screen.getByLabelText('Reason');
    fireEvent.change(reasonInput, { target: { value: 'Test reason for override' } });
    const submitButton = screen.getByText('Apply Override');
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('should reset form after successful submission', async () => {
    (documentNumberingService.manualOverride as any).mockResolvedValue({ success: true });
    render(<ManualOverrideForm />);
    const projectIdInput = screen.getByLabelText('Project ID');
    fireEvent.change(projectIdInput, { target: { value: '1' } });
    const originatorInput = screen.getByLabelText('Originator Org ID');
    fireEvent.change(originatorInput, { target: { value: '1' } });
    const recipientInput = screen.getByLabelText('Recipient Org ID');
    fireEvent.change(recipientInput, { target: { value: '1' } });
    const typeInput = screen.getByLabelText('Type ID');
    fireEvent.change(typeInput, { target: { value: '1' } });
    const newNumberInput = screen.getByLabelText('Set Last Number To');
    fireEvent.change(newNumberInput, { target: { value: '100' } });
    const reasonInput = screen.getByLabelText('Reason');
    fireEvent.change(reasonInput, { target: { value: 'Test reason for override' } });
    const submitButton = screen.getByText('Apply Override');
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(projectIdInput).toHaveValue(1);
      expect(reasonInput).toHaveValue('');
    });
  });
});
