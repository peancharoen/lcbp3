// File: lib/api/client.ts
// Change Log:
// - 2026-06-13: Export getAuthToken for unit testing
// - 2026-09-05: Refactor getAuthToken — ตัด module-level cache ที่ fragile ออก
//   อ่านจาก useAuthStore แทน (AuthSync sync token จาก useSession ทุกครั้งที่ session
//   เปลี่ยน + persist ลง localStorage 'auth-storage') ทำให้ token สดเสมอและไม่ stale
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { useAuthStore } from '@/lib/stores/auth-store';

// อ่านค่า Base URL จาก Environment Variable
const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ดึง auth token — อ่านจาก useAuthStore (single source ที่ AuthSync/useSession อัปเดตให้)
// ไม่มี module-level cache อีกต่อไป เพราะ token อาจ stale หลัง refresh/logout
export async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  // แหล่งหลัก: auth store (persist อยู่ใน localStorage 'auth-storage' ผ่าน zustand persist)
  const storeToken = useAuthStore.getState().token;
  if (storeToken) return storeToken;
  // Fallback 1: NextAuth session โดยตรง (กรณี AuthSync ยังไม่ได้ sync เช่นเพิ่ง login จบ)
  try {
    const { getSession } = await import('next-auth/react');
    const session = await getSession();
    if (session?.accessToken) return session.accessToken;
  } catch (_error) {
    // ดำเนินการต่อไปยัง fallback ถัดไป
  }
  // Fallback 2: อ่าน localStorage โดยตรง (กรณี store ยังไม่ hydrate)
  try {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      const token = parsed?.state?.token || null;
      if (token) return token;
    }
  } catch (__error) {
    // ไม่มี token ให้ใช้
  }
  return null;
}

// สร้าง Axios Instance หลัก
const apiClient: AxiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // Timeout 15 วินาที
});

// ---------------------------------------------------------------------------
// Request Interceptors
// ---------------------------------------------------------------------------

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 1. Idempotency Key Injection
    // ป้องกันการทำรายการซ้ำสำหรับ Method ที่เปลี่ยนแปลงข้อมูล
    const method = config.method?.toLowerCase();
    if (method && ['post', 'put', 'delete', 'patch'].includes(method)) {
      config.headers['Idempotency-Key'] = uuidv4();
    }

    // 2. Authentication Token Injection
    // ดึง Token จาก NextAuth session ผ่าน getSession()
    if (typeof window !== 'undefined') {
      const token = await getAuthToken();
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Response Interceptors
// ---------------------------------------------------------------------------

// รูปแบบ Error Response จาก Backend (ADR-007)
export interface ApiErrorPayload {
  type: string;
  code: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  statusCode?: number;
  recoveryActions?: string[];
  technicalMessage?: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}

export const AI_FEATURES_UNAVAILABLE_EVENT = 'ai-features-unavailable';

// แปลง Axios error เป็น Structured Error Response (ADR-007)
export function parseApiError(axiosError: AxiosError): ApiErrorResponse {
  if (axiosError.response?.data) {
    const data = axiosError.response.data;
    // กรณีที่ backend ส่ง { error: { ... } } ตาม ADR-007
    if (typeof data === 'object' && data !== null && 'error' in data) {
      const parsed = data as ApiErrorResponse;
      return {
        error: {
          ...parsed.error,
          statusCode: axiosError.response.status,
        },
      };
    }
    // กรณี NestJS validation error { message: [...], statusCode: 400 }
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const status = axiosError.response.status;
      return {
        error: {
          type: 'VALIDATION',
          code: 'HTTP_ERROR',
          message: Array.isArray((data as Record<string, unknown>).message)
            ? 'ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่'
            : String((data as Record<string, unknown>).message),
          severity: status >= 500 ? 'HIGH' : 'MEDIUM',
          timestamp: new Date().toISOString(),
          statusCode: status,
          recoveryActions: ['ตรวจสอบข้อมูลที่กรอก', 'แก้ไขข้อมูลที่ผิดพลาด', 'ลองใหม่อีกครั้ง'],
        },
      };
    }
  }

  // กรณี Network Error
  if (!axiosError.response) {
    return {
      error: {
        type: 'INFRASTRUCTURE',
        code: 'NETWORK_ERROR',
        message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
        severity: 'HIGH',
        timestamp: new Date().toISOString(),
        recoveryActions: ['ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต', 'ลองใหม่ภายหลัง'],
      },
    };
  }

  // Fallback
  return {
    error: {
      type: 'INTERNAL_ERROR',
      code: 'UNKNOWN_ERROR',
      message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่ภายหลัง',
      severity: 'HIGH',
      timestamp: new Date().toISOString(),
      statusCode: axiosError.response?.status,
      recoveryActions: ['ลองใหม่อีกครั้ง', 'ติดต่อผู้ดูแลระบบหากยังพบปัญหา'],
    },
  };
}

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const { status } = error.response;

      // กรณี Token หมดอายุ หรือ ไม่มีสิทธิ์
      if (status === 401) {
        // ล้าง auth state ใน store แล้ว redirect ไป login
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    // แปลง error เป็น structured format ตาม ADR-007 ก่อน reject
    const structuredError = parseApiError(error);
    if (
      structuredError.error.statusCode === 503 &&
      structuredError.error.code === 'AI_FEATURES_UNAVAILABLE' &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(
        new CustomEvent(AI_FEATURES_UNAVAILABLE_EVENT, {
          detail: structuredError.error,
        })
      );
    }
    return Promise.reject(structuredError);
  }
);

export default apiClient;
