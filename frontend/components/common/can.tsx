"use client";

import { useSession } from "next-auth/react";
import { ReactNode } from "react";

interface CanProps {
  permission: string;
  children: ReactNode;
}

export function Can({ permission, children }: CanProps) {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const userRole = session.user.role;

  // Simple role-based check
  // If the user's role matches the required permission (role), allow access.
  if (userRole === permission) {
    return <>{children}</>;
  }

  return null;
}
