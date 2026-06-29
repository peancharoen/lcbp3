// File: frontend/components/common/__tests__/error-display.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for ErrorDisplay component and parseApiError helper
// - 2026-06-13: Refactor to remove blank lines inside functions to satisfy project guidelines

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorDisplay, parseApiError } from '../error-display';

describe('ErrorDisplay Component', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      open: vi.fn(),
    });
  });

  it('ควรส่งกลับ null เมื่อไม่มี error หรือ payload', () => {
    const { container } = render(<ErrorDisplay error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('ควรเรนเดอร์ในโหมด compact สำเร็จ', () => {
    const errorPayload = {
      type: 'VALIDATION_ERROR',
      code: 'ERR_VAL',
      message: 'Validation failed',
      severity: 'LOW' as const,
      timestamp: new Date().toISOString(),
    };
    render(<ErrorDisplay error={errorPayload} compact={true} />);
    expect(screen.getByText('Validation failed')).toBeInTheDocument();
  });

  it('ควรเรนเดอร์ในโหมดปกติพร้อม Recovery Actions สำเร็จ', () => {
    const errorResponse = {
      error: {
        type: 'SYSTEM_ERROR',
        code: 'ERR_SYS',
        message: 'System crashed',
        severity: 'CRITICAL' as const,
        timestamp: new Date().toISOString(),
        recoveryActions: ['Restart app', 'Clear cache'],
      },
    };
    render(<ErrorDisplay error={errorResponse} compact={false} />);
    expect(screen.getByText('System crashed')).toBeInTheDocument();
    expect(screen.getByText('วิธีแก้ไข:')).toBeInTheDocument();
    expect(screen.getByText('Restart app')).toBeInTheDocument();
    expect(screen.getByText('Clear cache')).toBeInTheDocument();
  });

  it('ควรเรนเดอร์รายละเอียดทางเทคนิคเมื่อรันในสภาพแวดล้อม development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const errorPayload = {
      type: 'DATABASE_ERROR',
      code: 'ERR_DB',
      message: 'DB connection lost',
      severity: 'HIGH' as const,
      timestamp: new Date().toISOString(),
      technicalMessage: 'Failed to connect to host postgres://localhost:5432',
    };
    render(<ErrorDisplay error={errorPayload} />);
    expect(screen.getByText('รายละเอียดทางเทคนิค (Development)')).toBeInTheDocument();
    expect(screen.getByText('Failed to connect to host postgres://localhost:5432')).toBeInTheDocument();
    process.env.NODE_ENV = originalEnv;
  });

  it('ควรเรียก onRetry เมื่อคลิกปุ่มลองใหม่', () => {
    const mockOnRetry = vi.fn();
    const errorPayload = {
      type: 'API_ERROR',
      code: 'ERR_API',
      message: 'API failed',
      severity: 'MEDIUM' as const,
      timestamp: new Date().toISOString(),
    };
    render(<ErrorDisplay error={errorPayload} onRetry={mockOnRetry} />);
    const retryBtn = screen.getByText('ลองใหม่');
    fireEvent.click(retryBtn);
    expect(mockOnRetry).toHaveBeenCalled();
  });

  it('ควรเปิดเมลเมื่อคลิกปุ่มติดต่อผู้ดูแลระบบ', () => {
    const errorPayload = {
      type: 'API_ERROR',
      code: 'ERR_API',
      message: 'API failed',
      severity: 'MEDIUM' as const,
      timestamp: new Date().toISOString(),
    };
    render(<ErrorDisplay error={errorPayload} />);
    const supportBtn = screen.getByText('ติดต่อผู้ดูแลระบบ');
    fireEvent.click(supportBtn);
    expect(window.open).toHaveBeenCalledWith('mailto:support@np-dms.work', '_blank');
  });
});

describe('parseApiError helper', () => {
  it('ควรจัดการข้อผิดพลาดจากโครงสร้าง Axios Error ได้อย่างถูกต้อง', () => {
    const mockAxiosError = {
      response: {
        data: {
          error: {
            type: 'API_ERROR',
            code: 'ERR_CODE',
            message: 'Mock Axios Error',
            severity: 'MEDIUM' as const,
            timestamp: '2026-06-13T00:00:00.000Z',
          },
        },
      },
    };
    const parsed = parseApiError(mockAxiosError);
    expect(parsed.error.message).toBe('Mock Axios Error');
    expect(parsed.error.code).toBe('ERR_CODE');
  });

  it('ควรคืนค่าเดิมถ้าเป็นโครงสร้าง ApiErrorResponse อยู่แล้ว', () => {
    const mockResponse = {
      error: {
        type: 'CUSTOM_ERROR',
        code: 'ERR_CUSTOM',
        message: 'Mock Custom Error',
        severity: 'LOW' as const,
        timestamp: '2026-06-13T00:00:00.000Z',
      },
    };
    const parsed = parseApiError(mockResponse);
    expect(parsed).toEqual(mockResponse);
  });

  it('ควรส่งกลับ Internal/Network error เมื่อมีข้อผิดพลาดที่ไม่รู้จัก', () => {
    const parsed = parseApiError('Random Error String');
    expect(parsed.error.type).toBe('INTERNAL_ERROR');
    expect(parsed.error.code).toBe('NETWORK_ERROR');
    expect(parsed.error.message).toBe('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
  });
});
