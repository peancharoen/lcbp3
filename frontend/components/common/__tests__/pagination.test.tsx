// File: frontend/components/common/__tests__/pagination.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for Pagination component
// - 2026-06-13: Refactor to remove blank lines inside functions to satisfy project guidelines

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '../pagination';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

describe('Pagination Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควรเรนเดอร์ข้อมูลหน้าปัจจุบัน หน้าทั้งหมด และรายการทั้งหมดสำเร็จ', () => {
    render(<Pagination currentPage={2} totalPages={5} total={50} />);
    expect(screen.getByText('Showing page 2 of 5 (50 total items)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('ควร disable ปุ่ม Previous เมื่ออยู่หน้าแรก', () => {
    render(<Pagination currentPage={1} totalPages={5} total={50} />);
    const prevBtn = screen.getByRole('button', { name: 'Previous' });
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();
  });

  it('ควร disable ปุ่ม Next เมื่ออยู่หน้าสุดท้าย', () => {
    render(<Pagination currentPage={5} totalPages={5} total={50} />);
    const prevBtn = screen.getByRole('button', { name: 'Previous' });
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });

  it('ควรเปลี่ยนหน้าเมื่อคลิกปุ่ม Next', () => {
    render(<Pagination currentPage={2} totalPages={5} total={50} />);
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextBtn);
    expect(mockPush).toHaveBeenCalledWith('/?page=3');
  });

  it('ควรเปลี่ยนหน้าเมื่อคลิกปุ่ม Previous', () => {
    render(<Pagination currentPage={2} totalPages={5} total={50} />);
    const prevBtn = screen.getByRole('button', { name: 'Previous' });
    fireEvent.click(prevBtn);
    expect(mockPush).toHaveBeenCalledWith('/?page=1');
  });

  it('ควรเปลี่ยนหน้าเมื่อคลิกหมายเลขหน้าโดยตรง', () => {
    render(<Pagination currentPage={2} totalPages={5} total={50} />);
    const pageBtn = screen.getByRole('button', { name: '4' });
    fireEvent.click(pageBtn);
    expect(mockPush).toHaveBeenCalledWith('/?page=4');
  });
});
