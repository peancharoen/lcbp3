import apiClient from "@/lib/api/client";
import { NotificationResponse } from "@/types/notification";

export const notificationService = {
  getUnread: async (): Promise<NotificationResponse> => {
    const response = await apiClient.get("/notifications/unread");
    // Backend should return { items: [], unreadCount: number }
    // Or just items and we count on frontend, but typically backend gives count.
    return response.data;
  },

  markAsRead: async (id: number) => {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await apiClient.patch(`/notifications/read-all`);
    return response.data;
  }
};
