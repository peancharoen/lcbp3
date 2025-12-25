// File: lib/api/client.ts
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from "axios";
import { v4 as uuidv4 } from "uuid";

// อ่านค่า Base URL จาก Environment Variable
const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// สร้าง Axios Instance หลัก
const apiClient: AxiosInstance = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
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
    if (method && ["post", "put", "delete", "patch"].includes(method)) {
      config.headers["Idempotency-Key"] = uuidv4();
    }

    // 2. Authentication Token Injection
    // ดึง Token จาก Zustand persist store (localStorage)
    if (typeof window !== "undefined") {
      try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          const token = parsed?.state?.token;

          if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
          }
        }
      } catch (error) {
        console.warn("Failed to retrieve auth token:", error);
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
        console.error("Unauthorized: Please login again.");
        // สามารถเพิ่ม Logic Redirect ไปหน้า Login ได้ถ้าต้องการ
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
