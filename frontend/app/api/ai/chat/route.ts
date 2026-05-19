// File: frontend/app/api/ai/chat/route.ts
// Change Log:
// - 2026-05-19: สร้าง API Proxy สำหรับ AI Document Chat

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: { message: 'ไม่มีสิทธิ์เข้าถึงระบบ' } }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { query, context } = body;
    if (!query || !context || !context.type || !context.publicId) {
      return NextResponse.json({ error: { message: 'ข้อมูลนำเข้าไม่ถูกต้อง' } }, { status: 400 });
    }
    const backendUrl = (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') + '/ai/chat';
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ query, context }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(errorData, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (_error) {
    return NextResponse.json(
      {
        error: {
          type: 'INTERNAL_ERROR',
          code: 'PROXY_ERROR',
          message: 'เกิดข้อผิดพลาดในการประมวลผลคำขอ',
          severity: 'HIGH',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
