// File: frontend/app/backend-logout/route.ts
// Change Log:
// - 2026-09-11: สร้าง API Proxy สำหรับ backend logout (B2/B8 fix)
//   ใช้ path /backend-logout (ไม่ใช้ /api/ prefix) เพื่อหลีกเลี่ยง
//   การชนกับ NextAuth route /api/auth/[...nextauth] และ nginx /api/* proxy

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST() {
  const session = await auth();
  if (!session || !session.accessToken) {
    return NextResponse.json({ ok: true, message: 'No session — nothing to logout' });
  }
  try {
    const backendUrl =
      (process.env.INTERNAL_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        'http://localhost:3001/api') + '/auth/logout';
    await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
    });
    // ไม่สนใจ status code — เป้าหมายคือ blacklist token ฝั่ง backend ถ้าได้
  } catch {
    // ไม่สำคัญถ้า backend logout ล้มเหลว — session ฝั่ง client ยังต้อง clear
  }
  return NextResponse.json({ ok: true });
}
