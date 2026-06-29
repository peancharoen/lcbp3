// File: frontend/components/common/__tests__/status-badge.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for StatusBadge component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../status-badge';

describe('StatusBadge Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควรเรนเดอร์ Draft สำหรับสถานะ DRAFT ได้อย่างถูกต้อง', () => {
    render(<StatusBadge status="DRAFT" />);
    const badge = screen.getByText('Draft');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-secondary');
  });

  it('ควรเรนเดอร์ Pending สำหรับสถานะ PENDING ได้อย่างถูกต้อง', () => {
    render(<StatusBadge status="PENDING" />);
    const badge = screen.getByText('Pending');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-yellow-500');
  });

  it('ควรเรนเดอร์ Approved สำหรับสถานะ APPROVED ได้อย่างถูกต้อง', () => {
    render(<StatusBadge status="APPROVED" />);
    const badge = screen.getByText('Approved');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-500');
  });

  it('ควรเรนเดอร์ Rejected สำหรับสถานะ REJECTED ได้อย่างถูกต้อง', () => {
    render(<StatusBadge status="REJECTED" />);
    const badge = screen.getByText('Rejected');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-destructive');
  });

  it('ควรเรนเดอร์ข้อความตามสถานะเดิมและใช้ default styling เมื่อไม่พบรูปแบบสถานะที่ระบุ', () => {
    render(<StatusBadge status="UNKNOWN_STATUS" />);
    const badge = screen.getByText('UNKNOWN_STATUS');
    expect(badge).toBeInTheDocument();
  });
});
