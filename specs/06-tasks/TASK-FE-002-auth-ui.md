# TASK-FE-002: Authentication & Authorization UI

**ID:** TASK-FE-002
**Title:** Login, Session Management & RBAC UI
**Category:** Foundation
**Priority:** P0 (Critical)
**Effort:** 3-4 days
**Dependencies:** TASK-FE-001, TASK-BE-002
**Assigned To:** Frontend Developer

---

## 📋 Overview

Implement authentication UI including login form, session management with Zustand, and permission-based UI rendering.

---

## 🎯 Objectives

1. Create login page with form validation
2. Implement JWT token management
3. Setup Zustand auth store
4. Create protected route middleware
5. Implement permission-based UI components
6. Add logout functionality

---

## ✅ Acceptance Criteria

- [ ] User can login with username/password
- [ ] JWT token stored securely
- [ ] Unauthorized users redirected to login
- [ ] UI elements hidden based on permissions
- [ ] Session persists after page reload
- [ ] Logout clears session

---

## 🔧 Implementation Steps

### Step 1: Create Auth Store (Zustand)

```typescript
// File: src/lib/stores/auth-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: Array<{
    role_name: string;
    scope: string;
    scope_id: number;
  }>;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  setAuth: (user: User, token: string) => void;
  logout: () => void;
  hasPermission: (permission: string, scope?: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        set({ user, token, isAuthenticated: true });
        localStorage.setItem('auth-token', token);
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        localStorage.removeItem('auth-token');
      },

      hasPermission: (permission, scope) => {
        const { user } = get();
        if (!user) return false;

        // Check user roles for permission
        return user.roles.some((role) => {
          // Permission logic based on RBAC
          return true; // Implement actual logic
        });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

### Step 2: Login API Client

```typescript
// File: src/lib/api/auth.ts
import { apiClient } from './client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: {
    user_id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    roles: any[];
  };
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};
```

### Step 3: Login Page

```typescript
// File: src/app/(public)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/auth-store';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError('');
      const response = await authApi.login(data);
      setAuth(response.user, response.access_token);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">LCBP3-DMS Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                {...register('username')}
                placeholder="Enter username"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder="Enter password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 4: Protected Route Middleware

```typescript
// File: src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token');
  const isPublicPage = request.nextUrl.pathname.startsWith('/login');

  if (!token && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isPublicPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### Step 5: Permission-Based UI Components

```typescript
// File: src/components/common/can.tsx
'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { ReactNode } from 'react';

interface CanProps {
  permission: string;
  scope?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({
  permission,
  scope,
  children,
  fallback = null,
}: CanProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  if (!hasPermission(permission, scope)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

```typescript
// Usage example
import { Can } from '@/components/common/can';

<Can permission="correspondence:create">
  <Button>Create Correspondence</Button>
</Can>;
```

### Step 6: User Menu Component

```typescript
// File: src/components/layout/user-menu.tsx
'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';

export function UserMenu() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 🧪 Testing & Verification

### Test Cases

1. **Login Success**

   - Enter valid credentials
   - User redirected to dashboard
   - Token stored

2. **Login Failure**

   - Enter invalid credentials
   - Error message displayed
   - User stays on login page

3. **Protected Routes**

   - Access protected route without login → Redirect to login
   - Login → Access protected route successfully

4. **Session Persistence**

   - Login → Refresh page → Still logged in

5. **Logout**

   - Click logout → Token cleared → Redirected to login

6. **Permission-Based UI**
   - User with permission sees button
   - User without permission doesn't see button

---

## 📦 Deliverables

- [ ] Login page with validation
- [ ] Zustand auth store
- [ ] Auth API client
- [ ] Protected route middleware
- [ ] Permission-based UI components
- [ ] User menu with logout
- [ ] Session persistence

---

## 🔗 Related Documents

- [ADR-014: State Management](../../05-decisions/ADR-014-state-management.md)
- [ADR-013: Form Handling](../../05-decisions/ADR-013-form-handling-validation.md)
- [TASK-BE-002: Auth & RBAC](./TASK-BE-002-auth-rbac.md)

---

**Created:** 2025-12-01
**Status:** Ready
