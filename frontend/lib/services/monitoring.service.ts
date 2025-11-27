// File: lib/services/monitoring.service.ts
import apiClient from "@/lib/api/client";

export interface SetMaintenanceDto {
  enabled: boolean;
  message?: string; // ข้อความที่จะแสดงหน้าเว็บตอนปิดปรับปรุง
}

export const monitoringService = {
  /** ตรวจสอบสถานะสุขภาพระบบ (Health Check) */
  getHealth: async () => {
    const response = await apiClient.get("/health");
    return response.data;
  },

  /** ดึง Metrics การทำงาน (CPU, Memory, Request Count) */
  getMetrics: async () => {
    const response = await apiClient.get("/monitoring/metrics");
    return response.data;
  },

  /** เปิด/ปิด Maintenance Mode */
  setMaintenanceMode: async (data: SetMaintenanceDto) => {
    const response = await apiClient.post("/monitoring/maintenance", data);
    return response.data;
  }
};