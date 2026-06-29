// File: components/ai/__tests__/ai-suggestion-button.test.tsx
// Change Log
// - 2026-05-21: เพิ่ม unit tests สำหรับ soft fallback ของปุ่ม AI suggestion.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AiSuggestionButton } from '../ai-suggestion-button';

describe('AiSuggestionButton', () => {
  it('ควร disable และแสดงข้อความ fallback เมื่อ AI ถูกปิด', () => {
    const onClick = vi.fn();
    render(<AiSuggestionButton aiEnabled={false} onClick={onClick} />);

    const button = screen.getByRole('button', { name: /AI Suggestion/i });
    expect(button).toBeDisabled();
    expect(screen.getByText('ระบบ AI ไม่พร้อมใช้งานชั่วคราว กรุณากรอกข้อมูลด้วยตนเอง')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('ควรเรียก onClick เมื่อ AI เปิดใช้งาน', () => {
    const onClick = vi.fn();
    render(<AiSuggestionButton aiEnabled={true} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: /AI Suggestion/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
