# P1-Frontend: Setup & Authentication Plan

## Goal
Finalize frontend setup and implement robust Authentication connecting to the NestJS Backend (P2-2 Refresh Token support).

## Status Analysis
- **P1-1 (Setup):** ✅ Project structure, Tailwind, Shadcn/UI are already present.
- **P1-2 (Auth):** 🚧 `lib/auth.ts` exists but lacks `refreshToken` rotation logic. Types need verification.

## Proposed Changes

### 1. Type Definitions (`types/next-auth.d.ts`)
- [ ] Add `refreshToken`, `accessTokenExpires` (optional), and `error` field to `Session` and `JWT` types.

### 2. Auth Configuration (`lib/auth.ts`)
- [ ] Update `authorize` to store `refresh_token` from Backend response.
- [ ] Implement `refreshToken` rotation logic in `jwt` callback:
  - Check if token is expired.
  - If expired, call backend POST `/auth/refresh`.
  - Update `accessToken` and `refreshToken`.
  - Handle refresh errors (Force sign out).

### 3. Login Page (`app/(auth)/login/page.tsx`)
- [ ] Polish Error Handling (Use Toasts instead of alerts).
- [ ] Ensure redirect works correctly.

### 4. Middleware (`middleware.ts`)
- [ ] Verify middleware protects dashboard routes.

## Verification Plan
1.  **Manual Test:** Login with valid credentials.
2.  **Inspection:** Check LocalStorage/Cookies (NextAuth session cookie).
3.  **Token Rotation:** Wait for short access token expiry (if configurable) or manually invalidate, and verify seamless refresh.
