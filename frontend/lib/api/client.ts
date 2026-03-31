// File: lib/api/client.ts
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';

// อ่านค่า Base URL จาก Environment Variable
const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Token cache for API calls outside React components
let cachedToken: string | null = null;
let tokenPromise: Promise<string | null> | null = null;

// Async function to get token
async function getAuthToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;

  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      if (typeof window !== 'undefined') {
        const { getSession } = await import('next-auth/react');
        const session = await getSession();
        cachedToken = session?.accessToken || null;
        return cachedToken;
      }
    } catch (_error) {
      // Fallback to localStorage
      try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          cachedToken = parsed?.state?.token || null;
          return cachedToken;
        }
      } catch (__error) {
        // All methods failed
      }
    }
    return null;
  })();

  return tokenPromise;
}

// Function to clear token cache (call on logout)
export function clearAuthTokenCache(): void {
  cachedToken = null;
  tokenPromise = null;
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

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const { status } = error.response;

      // กรณี Token หมดอายุ หรือ ไม่มีสิทธิ์
      if (status === 401) {
        // Clear cached token and redirect to login
        clearAuthTokenCache();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
