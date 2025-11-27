// File: middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// รายการ Route ที่ไม่ต้อง Login ก็เข้าได้ (Public Routes)
const publicRoutes = ["/login", "/register", "/"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;
  
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
  const isAuthRoute = nextUrl.pathname.startsWith("/api/auth");

  // 1. ถ้าเป็น API Auth routes ให้ผ่านไปเลย
  if (isAuthRoute) {
    return NextResponse.next(); // แก้ไขจาก null เพื่อความถูกต้องของ Type ใน Next.js 14
  }

  // 2. ถ้า Login อยู่แล้ว แต่พยายามเข้าหน้า Login -> ให้ไป Dashboard
  if (isLoggedIn && nextUrl.pathname === "/login") {
    return Response.redirect(new URL("/dashboard", nextUrl));
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

  return NextResponse.next(); // แก้ไขจาก null
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
     * - images (public images)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images).*)',
  ],
};