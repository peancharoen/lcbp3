// File: lib/auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import type { User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

// Schema for input validation
const _loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const baseUrl =
  (typeof window === 'undefined' ? process.env.INTERNAL_API_URL : null) ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001/api';

// Helper to parse JWT expiry
function getJwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000; // Convert to ms
  } catch {
    return Date.now(); // If invalid, treat as expired
  }
}

interface TokenPayload {
  access_token: string;
  refresh_token?: string;
}

interface LoginPayload extends TokenPayload {
  user: {
    publicId: string; // ✅ Added (ADR-019)
    user_id: number;
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    primaryOrganizationId?: number;
  };
}

function unwrapApiResponse(value: unknown): unknown {
  let current = value;

  for (let i = 0; i < 5; i += 1) {
    if (!current || typeof current !== 'object') {
      return current;
    }

    const record = current as Record<string, unknown>;
    if (typeof record.access_token === 'string') {
      return current;
    }

    if (!('data' in record)) {
      return current;
    }

    current = record.data;
  }

  return current;
}

function isTokenPayload(value: unknown): value is TokenPayload {
  return !!value && typeof value === 'object' && typeof (value as Record<string, unknown>).access_token === 'string';
}

function isLoginPayload(value: unknown): value is LoginPayload {
  if (!isTokenPayload(value)) {
    return false;
  }

  const user = (value as unknown as { user?: unknown }).user;
  return !!user && typeof user === 'object' && typeof (user as Record<string, unknown>).username === 'string';
}

async function refreshAccessToken(token: JWT) {
  try {
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.refreshToken}`,
      },
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    const data = unwrapApiResponse(refreshedTokens);

    if (!isTokenPayload(data)) {
      throw new Error('Invalid refresh response format');
    }

    return {
      ...token,
      accessToken: data.access_token,
      accessTokenExpires: getJwtExpiry(data.access_token),
      refreshToken: data.refresh_token ?? token.refreshToken,
    };
  } catch (_error) {
    // RefreshAccessTokenError - token will be invalidated

    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.username || !credentials?.password) return null;

        try {
          // 1. Sanitize payload (Only send username and password)
          const payload = {
            username: credentials.username as string,
            password: credentials.password as string,
          };

          const res = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
              'Content-Type': 'application/json',
            },
            cache: 'no-store', // Disable caching for auth requests
          });

          if (!res.ok) {
            const _errorBody = await res.text().catch(() => 'No error body');
            return null;
          }

          const data = await res.json();
          const backendData = unwrapApiResponse(data);

          if (!isLoginPayload(backendData)) {
            return null;
          }

          return {
            id: backendData.user.user_id.toString(),
            publicId: backendData.user.publicId, // ✅ Added (ADR-019 Waived for session)
            name: `${backendData.user.firstName ?? ''} ${backendData.user.lastName ?? ''}`.trim(),
            email: backendData.user.email,
            username: backendData.user.username,
            firstName: backendData.user.firstName, // ✅ Added
            lastName: backendData.user.lastName, // ✅ Added
            role: backendData.user.role || 'User',
            organizationId: backendData.user.primaryOrganizationId,
            accessToken: backendData.access_token,
            refreshToken: backendData.refresh_token,
          } as User;
        } catch (_error) {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return {
          ...token,
          id: user.id,
          publicId: user.publicId, // ✅ Save publicId
          username: user.username, // ✅ Save username
          firstName: user.firstName, // ✅ Save firstName
          lastName: user.lastName, // ✅ Save lastName
          role: user.role,
          organizationId: user.organizationId,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          accessTokenExpires: getJwtExpiry(user.accessToken!),
        };
      }

      // Return previous token if valid (minus 10s buffer)
      if (Date.now() < (token.accessTokenExpires as number) - 10000) {
        return token;
      }

      // If existing token has an error, do not retry refresh (prevents infinite loop)
      if (token.error) {
        return token;
      }

      // Token expired, refresh it
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.publicId = token.publicId as string; // ✅ Restore publicId
        session.user.username = token.username as string; // ✅ Restore username
        session.user.firstName = token.firstName as string; // ✅ Restore firstName
        session.user.lastName = token.lastName as string; // ✅ Restore lastName
        session.user.role = token.role as string;
        session.user.organizationId = token.organizationId as number;

        session.accessToken = token.accessToken as string;
        session.refreshToken = token.refreshToken as string;
        session.error = token.error as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
});
