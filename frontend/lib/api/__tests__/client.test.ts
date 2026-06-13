// File: frontend/lib/api/__tests__/client.test.ts
// Change Log:
// - 2026-06-13: Refactor to use static imports instead of require, fixing ESM module resolution errors
// - 2026-06-13: Unmock @/lib/api/client to test the real implementation
// - 2026-06-13: Invoke actual response interceptor handlers for event and redirect assertions
// - 2026-06-13: Capture rejectedHandler at module scope before beforeEach clears mock history

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clearAuthTokenCache,
  parseApiError,
  AI_FEATURES_UNAVAILABLE_EVENT,
  getAuthToken,
} from '../client';
import { getSession } from 'next-auth/react';
import apiClient from '@/lib/api/client';

// Unmock the api client so we test the actual implementation
vi.unmock('@/lib/api/client');
vi.unmock('../client');

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: {
          use: vi.fn(),
        },
        response: {
          use: vi.fn(),
        },
      },
    })),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-123'),
}));

// Mock next-auth
vi.mock('next-auth/react', () => ({
  getSession: vi.fn(),
}));

// Capture the rejectedHandler at module scope
const rejectedHandler = (apiClient.interceptors.response.use as any).mock.calls[0][1];

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthTokenCache();
  });

  afterEach(() => {
    clearAuthTokenCache();
  });

  describe('Token Caching', () => {
    it('should cache token from getSession', async () => {
      (getSession as any).mockResolvedValue({ accessToken: 'test-token' });
      const token = await getAuthToken();
      expect(token).toBe('test-token');
      expect(getSession).toHaveBeenCalled();
    });

    it('should fallback to localStorage if getSession fails', async () => {
      (getSession as any).mockRejectedValue(new Error('Session error'));
      const mockLocalStorage = {
        getItem: vi.fn(() => JSON.stringify({ state: { token: 'local-token' } })),
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });
      const token = await getAuthToken();
      expect(token).toBe('local-token');
    });

    it('should return null if all token methods fail', async () => {
      (getSession as any).mockRejectedValue(new Error('Session error'));
      const mockLocalStorage = {
        getItem: vi.fn(() => null),
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });
      const token = await getAuthToken();
      expect(token).toBeNull();
    });

    it('should use cached token on subsequent calls', async () => {
      (getSession as any).mockResolvedValue({ accessToken: 'test-token' });
      await getAuthToken();
      const token2 = await getAuthToken();
      expect(getSession).toHaveBeenCalledTimes(1);
      expect(token2).toBe('test-token');
    });
  });

  describe('clearAuthTokenCache', () => {
    it('should clear cached token', async () => {
      (getSession as any).mockResolvedValue({ accessToken: 'test-token' });
      await getAuthToken();
      clearAuthTokenCache();
      await getAuthToken();
      expect(getSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('parseApiError', () => {
    it('should parse ADR-007 structured error', () => {
      const axiosError = {
        response: {
          data: {
            error: {
              type: 'VALIDATION',
              code: 'INVALID_INPUT',
              message: 'Invalid input',
              severity: 'MEDIUM',
              timestamp: '2026-01-01T00:00:00Z',
            },
          },
          status: 400,
        },
      };
      const result = parseApiError(axiosError as unknown as Parameters<typeof parseApiError>[0]);
      expect(result.error.type).toBe('VALIDATION');
      expect(result.error.code).toBe('INVALID_INPUT');
      expect(result.error.statusCode).toBe(400);
    });

    it('should parse NestJS validation error', () => {
      const axiosError = {
        response: {
          data: {
            message: ['Field is required', 'Invalid format'],
          },
          status: 400,
        },
      };
      const result = parseApiError(axiosError as unknown as Parameters<typeof parseApiError>[0]);
      expect(result.error.type).toBe('VALIDATION');
      expect(result.error.code).toBe('HTTP_ERROR');
      expect(result.error.message).toBe('ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่');
      expect(result.error.severity).toBe('MEDIUM');
    });

    it('should parse NestJS validation error with string message', () => {
      const axiosError = {
        response: {
          data: {
            message: 'Single error message',
          },
          status: 400,
        },
      };
      const result = parseApiError(axiosError as unknown as Parameters<typeof parseApiError>[0]);
      expect(result.error.message).toBe('Single error message');
    });

    it('should parse network error', () => {
      const axiosError = {
        response: undefined,
      };
      const result = parseApiError(axiosError as unknown as Parameters<typeof parseApiError>[0]);
      expect(result.error.type).toBe('INFRASTRUCTURE');
      expect(result.error.code).toBe('NETWORK_ERROR');
      expect(result.error.message).toBe('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    });

    it('should parse 5xx error as HIGH severity', () => {
      const axiosError = {
        response: {
          data: {
            message: 'Server error',
          },
          status: 500,
        },
      };
      const result = parseApiError(axiosError as unknown as Parameters<typeof parseApiError>[0]);
      expect(result.error.severity).toBe('HIGH');
    });

    it('should fallback to unknown error', () => {
      const axiosError = {
        response: {
          data: {},
          status: 418,
        },
      };
      const result = parseApiError(axiosError as unknown as Parameters<typeof parseApiError>[0]);
      expect(result.error.type).toBe('INTERNAL_ERROR');
      expect(result.error.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('AI Features Unavailable Event', () => {
    it('should dispatch AI_FEATURES_UNAVAILABLE_EVENT on 503 error', async () => {
      const mockDispatchEvent = vi.fn();
      Object.defineProperty(window, 'dispatchEvent', {
        value: mockDispatchEvent,
        writable: true,
      });
      const axiosError = {
        response: {
          data: {
            error: {
              type: 'INFRASTRUCTURE',
              code: 'AI_FEATURES_UNAVAILABLE',
              message: 'AI features unavailable',
              severity: 'HIGH',
              timestamp: '2026-01-01T00:00:00Z',
            },
          },
          status: 503,
        },
      };
      await rejectedHandler(axiosError).catch(() => {});
      const result = parseApiError(axiosError as any);
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        new CustomEvent(AI_FEATURES_UNAVAILABLE_EVENT, {
          detail: result.error,
        })
      );
    });

    it('should not dispatch event for non-503 errors', async () => {
      const mockDispatchEvent = vi.fn();
      Object.defineProperty(window, 'dispatchEvent', {
        value: mockDispatchEvent,
        writable: true,
      });
      const axiosError = {
        response: {
          data: {
            error: {
              type: 'VALIDATION',
              code: 'INVALID_INPUT',
              message: 'Invalid input',
              severity: 'MEDIUM',
              timestamp: '2026-01-01T00:00:00Z',
            },
          },
          status: 400,
        },
      };
      await rejectedHandler(axiosError).catch(() => {});
      expect(mockDispatchEvent).not.toHaveBeenCalled();
    });
  });

  describe('401 Handling', () => {
    it('should redirect to login on 401 error', async () => {
      const mockLocation = { href: '' };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
      });
      const axiosError = {
        response: {
          status: 401,
        },
      };
      await rejectedHandler(axiosError).catch(() => {});
      expect(mockLocation.href).toBe('/login');
    });
  });
});
