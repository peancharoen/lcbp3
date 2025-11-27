// File: lib/services/notification.service.ts
import apiClient from "@/lib/api/client";
import { 
  SearchNotificationDto, 
  CreateNotificationDto 
} from "@/types/dto/notification/notification.dto";

export const notificationService = {
  /** * ดึงรายการแจ้งเตือนของผู้ใช้ปัจจุบัน 
   * GET /notifications
   */
  getMyNotifications: async (params?: SearchNotificationDto) => {
    const response = await apiClient.get("/notifications", { params });
    return response.data;
  },

  /** * สร้างการแจ้งเตือนใหม่ (มักใช้โดย System หรือ Admin)
   * POST /notifications
   */
  create: async (data: CreateNotificationDto) => {
    const response = await apiClient.post("/notifications", data);
    return response.data;
  },

  /** * อ่านแจ้งเตือน (Mark as Read) 
   * PATCH /notifications/:id/read
   */
  markAsRead: async (id: number | string) => {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data;
  },

  /** * อ่านทั้งหมด (Mark All as Read) 
   * PATCH /notifications/read-all
   */
  markAllAsRead: async () => {
    const response = await apiClient.patch("/notifications/read-all");
    return response.data;
  },

  /** * ลบการแจ้งเตือน 
   * DELETE /notifications/:id
   */
  delete: async (id: number | string) => {
    const response = await apiClient.delete(`/notifications/${id}`);
    return response.data;
  }
};