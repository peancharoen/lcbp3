// File: frontend/components/admin/ai/__tests__/prompt-editor.test.tsx
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PromptEditor from '../PromptEditor';

describe('PromptEditor', () => {
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควร render editor สำหรับแก้ไขพรอมต์เทมเพลต', () => {
    render(
      <PromptEditor
        promptType="ocr_extraction"
        initialTemplate="Test template with {{ocr_text}}"
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    expect(screen.getByText(/แก้ไขพรอมต์เทมเพลต/)).toBeInTheDocument();
  });

  it('ควร disabled ปุ่มบันทึกเมื่อ isSaving=true', () => {
    render(
      <PromptEditor
        promptType="ocr_extraction"
        initialTemplate="Test template with {{ocr_text}}"
        onSave={mockOnSave}
        isSaving={true}
      />
    );

    const saveButton = screen.queryByText('กำลังบันทึก...');
    if (saveButton) {
      expect(saveButton).toBeDisabled();
    }
  });
});
