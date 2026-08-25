// File: proxy.ts
// Change Log:
// - 2026-08-25: เพิ่ม frame-src 'self' blob: เพื่ออนุญาต blob: URL ใน iframe (D160)
//   สาเหตุ: StagingFileViewer และ FilePreviewModal ใช้ blob: URL เป็น iframe src
//   แต่ CSP ขาด frame-src → default-src 'self' บล็อก blob: → Chrome แสดง "This content is blocked"
// - 2026-08-25: แยก CSP generation ออกเป็น generateCspHeader() ใน lib/security/csp.ts เพื่อ test ได้

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { generateCspHeader } from '@/lib/security/csp';

// รายการ Route ที่ไม่ต้อง Login ก็เข้าได้ (Public Routes)
const publicRoutes = ['/login', '/register', '/'];

// 🛡️ Bot/Scanner Patterns - บล็อก requests ที่เป็น automated scanning
const blockedPatterns = [
  // WordPress scanning
  /\/wp-includes/i,
  /\/wp-content/i,
  /\/wp\//i,
  /\/wordpress/i,
  /\/xmlrpc\.php/i,
  /wlwmanifest\.xml/i,
  // Environment/config files
  /\/\.env/i,
  /\/\.env\./i,
  /\/config\/\.env/i,
  /\/api\/\.env/i,
  // Database admin tools
  /\/phpmyadmin/i,
  /\/adminer/i,
  /\/pma/i,
  // Common scanner paths
  /\/\.git/i,
  /\/\.svn/i,
  /\/config\.json/i,
  /\/package\.json/i,
];

function isBlockedPath(path: string): boolean {
  return blockedPatterns.some((pattern) => pattern.test(path));
}

export default auth((req) => {
  const { nextUrl } = req;

  // 🛡️ 0. Block Bot/Scanner Requests (ไม่ส่งต่อไป backend)
  if (isBlockedPath(nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const isLoggedIn = !!req.auth;

  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
  const isAuthRoute = nextUrl.pathname.startsWith('/api/auth');

  // 1. ถ้าเป็น API Auth routes ให้ผ่านไปเลย
  if (isAuthRoute) {
    return NextResponse.next(); // แก้ไขจาก null เพื่อความถูกต้องของ Type ใน Next.js 14
  }

  // 2. ถ้า Login อยู่แล้ว แต่พยายามเข้าหน้า Login -> ให้ไป Dashboard
  if (isLoggedIn && nextUrl.pathname === '/login') {
    return Response.redirect(new URL('/dashboard', nextUrl));
  }

  // 3. ถ้ายังไม่ Login และพยายามเข้า Private Route -> ให้ไป Login
  if (!isLoggedIn && !isPublicRoute) {
    // สร้าง URL สำหรับ Redirect กลับมาหน้าเดิมหลังจาก Login เสร็จ
    let callbackUrl = nextUrl.pathname;
    if (nextUrl.search) {
      callbackUrl += nextUrl.search;
    }

    const encodedCallbackUrl = encodeURIComponent(callbackUrl);
    return Response.redirect(new URL(`/login?callbackUrl=${encodedCallbackUrl}`, nextUrl));
  }

  // 4. Protect Admin Routes (Security Phase 1)
  if (nextUrl.pathname.startsWith('/admin')) {
    const userRole = req.auth?.user?.role as string | undefined;
    if (userRole !== 'ADMIN' && userRole !== 'DC') {
      return Response.redirect(new URL('/dashboard', nextUrl));
    }
  }

  // 5. Generate CSP with Nonce (Security Rule Tier 1)
  // ใช้ Nonce Strategy เพื่ออนุญาต Inline Script เฉพาะที่ระบบตัวตนได้ ป้องกัน XSS
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = generateCspHeader(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
});

// กำหนดว่า Middleware นี้จะทำงานกับ Route ไหนบ้าง
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt (robots file)
     * - images (public images)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|images).*)',
  ],
};
