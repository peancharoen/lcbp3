// File: frontend/components/admin/ai/__tests__/prompt-type-dropdown.test.tsx
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PromptTypeDropdown from '../PromptTypeDropdown';

describe('PromptTypeDropdown', () => {
  it('ควร render dropdown สำหรับเลือกประเภทพรอมต์', () => {
    const handleChange = vi.fn();
    render(
      <PromptTypeDropdown
        value="ocr_extraction"
        onChange={handleChange}
      />
    );

    expect(screen.getByText('ประเภทของพรอมต์ (Prompt Type)')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('ควร disabled dropdown เมื่อ disabled=true', () => {
    const handleChange = vi.fn();
    render(
      <PromptTypeDropdown
        value="ocr_extraction"
        onChange={handleChange}
        disabled={true}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
  });
});
