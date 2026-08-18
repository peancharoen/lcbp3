// File: frontend/components/admin/reference/__tests__/color-picker-field.test.tsx
// Change Log:
// - 2026-08-18: Initial creation — T017 ColorPickerField test (ADR-046)

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ColorPickerField } from '../color-picker-field';
import { TAG_PALETTE } from '@/lib/constants/tag-colors';

// Mock i18n hook — คืน key เป็น label เพื่อให้ assert ง่าย
vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    if (params) {
      return key.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(params[k] ?? ''));
    }
    return key;
  },
}));

describe('ColorPickerField', () => {
  it('render swatch ครบ 14 ตัว', () => {
    render(<ColorPickerField value="red" onChange={vi.fn()} />);
    // แต่ละ swatch เป็น button ที่มี aria-label = i18n key
    const swatches = screen.getAllByRole('radio');
    expect(swatches).toHaveLength(14);
  });

  it('ไฮไลต์ swatch ที่เลือก (aria-checked=true)', () => {
    render(<ColorPickerField value="blue" onChange={vi.fn()} />);
    const blueSwatch = screen.getByRole('radio', { name: 'tag.color.blue' });
    expect(blueSwatch).toHaveAttribute('aria-checked', 'true');
    // ตรวจอีก swatch ว่าไม่ได้เลือก
    const redSwatch = screen.getByRole('radio', { name: 'tag.color.red' });
    expect(redSwatch).toHaveAttribute('aria-checked', 'false');
  });

  it('เรียก onChange ด้วย palette key เมื่อคลิก swatch', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPickerField value="red" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'tag.color.green' }));
    expect(onChange).toHaveBeenCalledWith('green');
  });

  it('fallback เป็น default เมื่อ value เป็น undefined', () => {
    render(<ColorPickerField value={undefined} onChange={vi.fn()} />);
    const defaultSwatch = screen.getByRole('radio', { name: 'tag.color.default' });
    expect(defaultSwatch).toHaveAttribute('aria-checked', 'true');
  });

  it('fallback เป็น default เมื่อ value เป็น legacy hex', () => {
    render(<ColorPickerField value="#ff0000" onChange={vi.fn()} />);
    const defaultSwatch = screen.getByRole('radio', { name: 'tag.color.default' });
    expect(defaultSwatch).toHaveAttribute('aria-checked', 'true');
  });

  it('fallback เป็น default เมื่อ value เป็น empty string', () => {
    render(<ColorPickerField value="" onChange={vi.fn()} />);
    const defaultSwatch = screen.getByRole('radio', { name: 'tag.color.default' });
    expect(defaultSwatch).toHaveAttribute('aria-checked', 'true');
  });

  it('แสดง label สีที่เลือกด้านล่าง', () => {
    render(<ColorPickerField value="red" onChange={vi.fn()} />);
    const label = screen.getByTestId('selected-color-label');
    // i18n mock คืน "tag.color.selected" พร้อม {{color}} = "tag.color.red"
    expect(label).toHaveTextContent('tag.color.selected');
  });

  it('ทุก swatch มี backgroundColor ตรงกับ TAG_PALETTE hex', () => {
    render(<ColorPickerField value="red" onChange={vi.fn()} />);
    const swatches = screen.getAllByRole('radio');
    swatches.forEach((swatch, idx) => {
      const entry = TAG_PALETTE[idx];
      expect(swatch).toHaveStyle({ backgroundColor: entry.hex });
    });
  });
});
