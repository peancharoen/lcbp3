// File: types/next-auth.d.ts
import _NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      publicId: string; // ✅ Added (ADR-019 Waived for session)
      username: string; // ✅ Added
      firstName: string; // ✅ Added
      lastName: string; // ✅ Added
      role: string;
      organizationId?: number;
    } & DefaultSession['user'];
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }

  interface User {
    id: string;
    publicId: string; // ✅ Added
    username: string; // ✅ Added
    firstName: string; // ✅ Added
    lastName: string; // ✅ Added
    role: string;
    organizationId?: number;
    accessToken?: string;
    refreshToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    username: string; // ✅ Added
    role: string;
    organizationId?: number;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}
