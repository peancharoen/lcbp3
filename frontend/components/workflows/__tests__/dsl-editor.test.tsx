// T054: Vitest test for DSLEditor — validates onValidationChange callback and Save button disable logic
// ตรวจสอบ: Validate กดแล้ว workflowApi.validateDSL ถูกเรียก; errors → onValidationChange(true); valid → onValidationChange(false)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DSLEditor } from '../dsl-editor';
import { workflowApi } from '@/lib/api/workflows';

// Mock Monaco editor — ไม่มี DOM environment สำหรับ Monaco
vi.mock('@monaco-editor/react', () => ({
  default: ({ onChange }: { onChange?: (v: string) => void }) => (
    <textarea
      data-testid="monaco-editor"
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
  // เพิ่ม loader mock เพื่อรองรับ loader.config() call ใน dsl-editor.tsx
  loader: {
    config: vi.fn(),
  },
}));

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

// Mock workflowApi.validateDSL
vi.mock('@/lib/api/workflows', () => ({
  workflowApi: {
    validateDSL: vi.fn(),
  },
}));

const mockValidateDSL = vi.mocked(workflowApi.validateDSL);

describe('DSLEditor (T054)', () => {
  const onValidationChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls workflowApi.validateDSL when Validate button is clicked', async () => {
    mockValidateDSL.mockResolvedValue({ valid: true });

    render(<DSLEditor initialValue="workflow: test" onValidationChange={onValidationChange} />);

    await userEvent.click(screen.getByRole('button', { name: /validate/i }));

    await waitFor(() => {
      expect(mockValidateDSL).toHaveBeenCalledWith('workflow: test');
    });
  });

  it('calls onValidationChange(true) when validation returns errors', async () => {
    mockValidateDSL.mockResolvedValue({
      valid: false,
      errors: ['DSL must have at least one state'],
    });

    render(<DSLEditor initialValue="bad: dsl" onValidationChange={onValidationChange} />);

    await userEvent.click(screen.getByRole('button', { name: /validate/i }));

    await waitFor(() => {
      expect(onValidationChange).toHaveBeenCalledWith(true);
    });

    // แสดง error message ใน UI
    expect(
      screen.getByText('DSL must have at least one state')
    ).toBeInTheDocument();
  });

  it('calls onValidationChange(false) when validation returns valid', async () => {
    mockValidateDSL.mockResolvedValue({ valid: true });

    render(<DSLEditor initialValue="workflow: rfa" onValidationChange={onValidationChange} />);

    await userEvent.click(screen.getByRole('button', { name: /validate/i }));

    await waitFor(() => {
      expect(onValidationChange).toHaveBeenCalledWith(false);
    });

    // แสดง success message
    expect(screen.getByText(/valid and ready/i)).toBeInTheDocument();
  });

  it('calls onValidationChange(true) on server error', async () => {
    mockValidateDSL.mockRejectedValue(new Error('Network error'));

    render(<DSLEditor initialValue="workflow: test" onValidationChange={onValidationChange} />);

    await userEvent.click(screen.getByRole('button', { name: /validate/i }));

    await waitFor(() => {
      expect(onValidationChange).toHaveBeenCalledWith(true);
    });
  });

  it('does not call onValidationChange when prop is not provided', async () => {
    mockValidateDSL.mockResolvedValue({ valid: true });

    // ไม่ส่ง onValidationChange — ต้องไม่ throw
    render(<DSLEditor initialValue="workflow: test" />);

    await userEvent.click(screen.getByRole('button', { name: /validate/i }));

    await waitFor(() => {
      expect(mockValidateDSL).toHaveBeenCalled();
    });
    // ไม่ throw error
  });
});
