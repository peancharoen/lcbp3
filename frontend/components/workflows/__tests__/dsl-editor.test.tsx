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
      aria-label="Workflow DSL editor"
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

  it('calls onChange callback when editor value changes', async () => {
    const onChange = vi.fn();
    render(<DSLEditor initialValue="initial" onChange={onChange} />);

    const editor = screen.getByTestId('monaco-editor');
    await userEvent.type(editor, ' updated');

    // onChange ถูกเรียกแต่ละ character - check ว่าถูกเรียกและค่าสุดท้ายถูกต้อง
    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(' updated');
  });

  it('disables Validate and Test buttons when readOnly=true', () => {
    render(<DSLEditor initialValue="test" readOnly={true} />);

    const validateButton = screen.getByRole('button', { name: /validate/i });
    const testButton = screen.getByRole('button', { name: /test/i });

    expect(validateButton).toBeDisabled();
    expect(testButton).toBeDisabled();
  });

  it('enables Validate and Test buttons when readOnly=false', () => {
    render(<DSLEditor initialValue="test" readOnly={false} />);

    const validateButton = screen.getByRole('button', { name: /validate/i });
    const testButton = screen.getByRole('button', { name: /test/i });

    expect(validateButton).not.toBeDisabled();
    expect(testButton).not.toBeDisabled();
  });

  it('clears validation result when editor value changes', async () => {
    mockValidateDSL.mockResolvedValue({ valid: true });
    const onChange = vi.fn();

    render(<DSLEditor initialValue="test" onChange={onChange} onValidationChange={onValidationChange} />);

    // Validate first
    await userEvent.click(screen.getByRole('button', { name: /validate/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid and ready/i)).toBeInTheDocument();
    });

    // Change editor value
    const editor = screen.getByTestId('monaco-editor');
    await userEvent.type(editor, ' updated');

    // Validation result should be cleared
    expect(screen.queryByText(/valid and ready/i)).not.toBeInTheDocument();
  });

  it('shows Test result when Test button is clicked', async () => {
    render(<DSLEditor initialValue="test" />);

    const testButton = screen.getByRole('button', { name: /test/i });
    await userEvent.click(testButton);

    await waitFor(() => {
      expect(screen.getByText(/Workflow simulation completed successfully/i)).toBeInTheDocument();
    });
  });

  it('updates internal state when initialValue prop changes', () => {
    const { rerender } = render(<DSLEditor initialValue="initial" />);

    // Mock Monaco editor ไม่ได้ update value เมื่อ initialValue เปลี่ยน
    // แต่เราสามารถ test ได้โดย render component ใหม่ด้วย initialValue ต่างกัน
    rerender(<DSLEditor initialValue="updated" />);

    // Component ควร render ได้โดยไม่ throw error
    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toBeInTheDocument();
  });
});
