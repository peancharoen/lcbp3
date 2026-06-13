// File: frontend/components/layout/__tests__/theme-toggle.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for ThemeToggle component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../theme-toggle';

const mockSetTheme = vi.fn();
let mockResolvedTheme = 'dark';

vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: mockResolvedTheme,
    setTheme: mockSetTheme,
  }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolvedTheme = 'dark';
  });

  it('ควรแสดงปุ่ม Toggle White/Dark mode', () => {
    render(<ThemeToggle />);
    const button = screen.getByTitle('Toggle white/dark mode');
    expect(button).toBeInTheDocument();
  });

  it('ควรแสดงข้อความ White เมื่อ theme ปัจจุบันเป็น dark', () => {
    mockResolvedTheme = 'dark';
    render(<ThemeToggle />);
    expect(screen.getByText('White')).toBeInTheDocument();
  });

  it('ควรแสดงข้อความ Dark เมื่อ theme ปัจจุบันเป็น light', () => {
    mockResolvedTheme = 'light';
    render(<ThemeToggle />);
    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('ควรเรียก setTheme("light") เมื่อคลิกขณะ theme เป็น dark', () => {
    mockResolvedTheme = 'dark';
    render(<ThemeToggle />);
    const button = screen.getByTitle('Toggle white/dark mode');
    fireEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('ควรเรียก setTheme("dark") เมื่อคลิกขณะ theme เป็น light', () => {
    mockResolvedTheme = 'light';
    render(<ThemeToggle />);
    const button = screen.getByTitle('Toggle white/dark mode');
    fireEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });
});
