// File: types/next-auth.d.ts
import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      organizationId?: number;
    } & DefaultSession["user"]
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }

  interface User {
    id: string;
    role: string;
    organizationId?: number;
    accessToken?: string;
    refreshToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    organizationId?: number;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}
