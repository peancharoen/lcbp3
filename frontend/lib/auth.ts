// File: lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { User } from "next-auth";

// Schema for input validation
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// Helper to parse JWT expiry
function getJwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000; // Convert to ms
  } catch (e) {
    return Date.now(); // If invalid, treat as expired
  }
}

async function refreshAccessToken(token: any) {
  try {
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.refreshToken}`,
      },
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    const data = refreshedTokens.data || refreshedTokens;

    return {
      ...token,
      accessToken: data.access_token,
      accessTokenExpires: getJwtExpiry(data.access_token),
      refreshToken: data.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.log("RefreshAccessTokenError", error);

    return {
      ...token,
      error: "RefreshAccessTokenError",
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
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        try {
          const { username, password } = await loginSchema.parseAsync(credentials);

          console.log(`Attempting login to: ${baseUrl}/auth/login`);

          const res = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });

          if (!res.ok) {
            const errorMsg = await res.text();
            console.error("Login failed:", errorMsg);
            return null;
          }

          const responseJson = await res.json();
          const backendData = responseJson.data || responseJson;

          if (!backendData || !backendData.access_token) {
            console.error("No access token received");
            return null;
          }

          return {
            id: backendData.user.user_id.toString(),
            name: `${backendData.user.firstName} ${backendData.user.lastName}`,
            email: backendData.user.email,
            username: backendData.user.username,
            role: backendData.user.role || "User",
            organizationId: backendData.user.primaryOrganizationId,
            accessToken: backendData.access_token,
            refreshToken: backendData.refresh_token,
          } as User;

        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return {
          ...token,
          id: user.id,
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

      // Token expired, refresh it
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
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
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
});
