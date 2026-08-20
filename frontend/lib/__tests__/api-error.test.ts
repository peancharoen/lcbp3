// File: frontend/lib/__tests__/api-error.test.ts
// Change Log:
// - 2026-08-20: Initial creation — regression test สำหรับ getApiErrorMessage
//   ป้องกัน bug ที่ซ่อน ADR-007 structured error จากผู้ใช้ (Legacy Review Queue: "Failed to load queue")

import { describe, it, expect } from 'vitest';
import { getApiErrorMessage } from '@/types/api-error';

describe('getApiErrorMessage', () => {
  it('อ่าน message จาก ADR-007 structured shape ที่ interceptor reject ด้วย', () => {
    // รูปแบบที่ lib/api/client.ts response interceptor reject ออกมา
    const structuredError = {
      error: {
        type: 'PERMISSION_DENIED',
        code: 'HTTP_ERROR',
        message: 'User does not have required permissions: migration.view',
        severity: 'MEDIUM' as const,
        timestamp: '2026-08-20T08:38:07.542Z',
        statusCode: 403,
        recoveryActions: ['ติดต่อผู้ดูแลระบบ'],
      },
    };
    expect(getApiErrorMessage(structuredError, 'Fallback')).toBe(
      'User does not have required permissions: migration.view'
    );
  });

  it('อ่าน message จาก Axios raw error ที่มี structured payload ใน response.data', () => {
    const axiosError = {
      response: {
        status: 403,
        data: {
          error: {
            type: 'PERMISSION_DENIED',
            code: 'HTTP_ERROR',
            message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
            severity: 'MEDIUM',
            timestamp: '2026-08-20T08:37:52.551Z',
            statusCode: 401,
          },
        },
      },
    };
    expect(getApiErrorMessage(axiosError, 'Fallback')).toBe(
      'กรุณาเข้าสู่ระบบก่อนใช้งาน'
    );
  });

  it('อ่าน message จาก legacy Axios shape { response: { data: { message } } }', () => {
    const legacyError = {
      response: {
        status: 400,
        data: { message: 'Validation failed' },
      },
    };
    expect(getApiErrorMessage(legacyError, 'Fallback')).toBe('Validation failed');
  });

  it('อ่าน message จาก Error.message ธรรมดา', () => {
    const err = new Error('Network timeout');
    expect(getApiErrorMessage(err, 'Fallback')).toBe('Network timeout');
  });

  it('คืน fallback เมื่อ error เป็น null/undefined', () => {
    expect(getApiErrorMessage(null, 'Failed to load queue')).toBe(
      'Failed to load queue'
    );
    expect(getApiErrorMessage(undefined, 'Failed to load queue')).toBe(
      'Failed to load queue'
    );
  });

  it('คืน fallback เมื่อ structured error ไม่มี message', () => {
    const noMessage = { error: { code: 'X', type: 'Y' } };
    expect(getApiErrorMessage(noMessage, 'Fallback')).toBe('Fallback');
  });

  it('คืน fallback เมื่อเป็นค่าว่างที่ไม่ใช่ error shape', () => {
    expect(getApiErrorMessage({}, 'Fallback')).toBe('Fallback');
    expect(getApiErrorMessage('some string', 'Fallback')).toBe('Fallback');
  });

  it('ใช้ default fallback เมื่อไม่ส่ง fallback มา', () => {
    expect(getApiErrorMessage(null)).toBe('An unexpected error occurred');
  });
});
