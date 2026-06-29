// File: types/next-auth.d.ts
import _NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string; // publicId (ADR-019)
      publicId: string;
      username: string;
      firstName: string;
      lastName: string;
      role: string;
      organizationId?: number;
    } & DefaultSession['user'];
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }

  interface User {
    id: string; // publicId (ADR-019)
    publicId: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
    organizationId?: number;
    accessToken?: string;
    refreshToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string; // publicId or username depending on auth flow
    username: string;
    role: string;
    organizationId?: number;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}
