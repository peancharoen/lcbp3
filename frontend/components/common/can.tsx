// File: components/common/can.tsx
'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { ReactNode } from 'react';

interface CanProps {
  permission?: string;
  role?: string;
  children: ReactNode;
  fallback?: ReactNode;
  // Logic: OR (default) - if multiple provided, any match is enough?
  // For simplicity, let's enforce: if permission provided -> check permission.
  // If role provided -> check role. If both -> check both (AND/OR needs definition).
  // Let's go with: if multiple props are provided, ALL must pass (AND logic) for now, or just handle one.
  // Common use case: <Can permission="x">
}

export function Can({
  permission,
  role,
  children,
  fallback = null,
}: CanProps) {
  const { hasPermission, hasRole } = useAuthStore();

  let allowed = true;

  if (permission && !hasPermission(permission)) {
    allowed = false;
  }

  if (role && !hasRole(role)) {
    allowed = false;
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
