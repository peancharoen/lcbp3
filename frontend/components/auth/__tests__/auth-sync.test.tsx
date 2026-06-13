// File: frontend/components/auth/__tests__/auth-sync.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for AuthSync component
// - 2026-06-13: Refactor to use static ESM imports instead of CommonJS require() to resolve Vitest module path errors

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { AuthSync } from '../auth-sync';
import { useSession, signOut } from 'next-auth/react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { clearAuthTokenCache } from '@/lib/api/client';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

// Mock auth-store
vi.mock('@/lib/stores/auth-store', () => ({
  useAuthStore: vi.fn(),
}));

// Mock clearAuthTokenCache
vi.mock('@/lib/api/client', () => ({
  clearAuthTokenCache: vi.fn(),
}));

describe('AuthSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render null (component renders nothing)', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    } as any);
    vi.mocked(useAuthStore).mockReturnValue({
      setAuth: vi.fn(),
      logout: vi.fn(),
    } as any);
    const { container } = render(<AuthSync />);
    expect(container.firstChild).toBeNull();
  });

  it('should sync user data when authenticated', () => {
    const mockSetAuth = vi.fn();
    const mockLogout = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          id: 'user-id-1',
          publicId: '019505a1-7c3e-7000-8000-abc123def456',
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'Admin',
          permissions: ['read', 'write'],
        },
        accessToken: 'test-token',
      },
      status: 'authenticated',
    } as any);
    vi.mocked(useAuthStore).mockReturnValue({
      setAuth: mockSetAuth,
      logout: mockLogout,
    } as any);
    render(<AuthSync />);
    expect(mockSetAuth).toHaveBeenCalledWith(
      {
        id: 'user-id-1',
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'Admin',
        permissions: ['read', 'write'],
      },
      'test-token'
    );
  });

  it('should handle user_id fallback when id is missing', () => {
    const mockSetAuth = vi.fn();
    const mockLogout = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          user_id: 'user-id-2',
          publicId: '019505a1-7c3e-7000-8000-abc123def457',
          username: 'testuser2',
          email: 'test2@example.com',
          firstName: 'Test2',
          lastName: 'User2',
          role: 'User',
        },
        accessToken: 'test-token-2',
      },
      status: 'authenticated',
    } as any);
    vi.mocked(useAuthStore).mockReturnValue({
      setAuth: mockSetAuth,
      logout: mockLogout,
    } as any);
    render(<AuthSync />);
    expect(mockSetAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-id-2',
      }),
      'test-token-2'
    );
  });

  it('should clear auth cache and logout on unauthenticated', () => {
    const mockSetAuth = vi.fn();
    const mockLogout = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    } as any);
    vi.mocked(useAuthStore).mockReturnValue({
      setAuth: mockSetAuth,
      logout: mockLogout,
    } as any);
    render(<AuthSync />);
    expect(clearAuthTokenCache).toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalled();
  });

  it('should clear auth cache and sign out on RefreshAccessTokenError', () => {
    const mockSetAuth = vi.fn();
    const mockLogout = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      data: {
        error: 'RefreshAccessTokenError',
      },
      status: 'authenticated',
    } as any);
    vi.mocked(useAuthStore).mockReturnValue({
      setAuth: mockSetAuth,
      logout: mockLogout,
    } as any);
    render(<AuthSync />);
    expect(clearAuthTokenCache).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' });
  });

  it('should use default values when user fields are missing', () => {
    const mockSetAuth = vi.fn();
    const mockLogout = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          publicId: '019505a1-7c3e-7000-8000-abc123def458',
        },
        accessToken: 'test-token-3',
      },
      status: 'authenticated',
    } as any);
    vi.mocked(useAuthStore).mockReturnValue({
      setAuth: mockSetAuth,
      logout: mockLogout,
    } as any);
    render(<AuthSync />);
    expect(mockSetAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '',
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        role: 'User',
      }),
      'test-token-3'
    );
  });

  it('should use session.user fields when typed user fields are missing', () => {
    const mockSetAuth = vi.fn();
    const mockLogout = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          publicId: '019505a1-7c3e-7000-8000-abc123def459',
          username: 'session-username',
          email: 'session-email@example.com',
          firstName: 'SessionFirst',
          lastName: 'SessionLast',
          role: 'SessionRole',
        },
        accessToken: 'test-token-4',
      },
      status: 'authenticated',
    } as any);
    vi.mocked(useAuthStore).mockReturnValue({
      setAuth: mockSetAuth,
      logout: mockLogout,
    } as any);
    render(<AuthSync />);
    expect(mockSetAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'session-username',
        email: 'session-email@example.com',
        firstName: 'SessionFirst',
        lastName: 'SessionLast',
        role: 'SessionRole',
      }),
      'test-token-4'
    );
  });
});
