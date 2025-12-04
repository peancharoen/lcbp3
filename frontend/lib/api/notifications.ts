import { NotificationResponse } from "@/types/notification";

// Mock Data
let mockNotifications = [
  {
    notification_id: 1,
    title: "RFA Approved",
    message: "RFA-001 has been approved by the Project Manager.",
    type: "SUCCESS" as const,
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
    link: "/rfas/1",
  },
  {
    notification_id: 2,
    title: "New Correspondence",
    message: "You have received a new correspondence from Contractor A.",
    type: "INFO" as const,
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    link: "/correspondences/3",
  },
  {
    notification_id: 3,
    title: "Drawing Revision Required",
    message: "Drawing S-201 requires revision based on recent comments.",
    type: "WARNING" as const,
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    link: "/drawings/2",
  },
];

export const notificationApi = {
  getUnread: async (): Promise<NotificationResponse> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const unread = mockNotifications.filter((n) => !n.is_read);
    return {
      items: mockNotifications, // Return all for the list, but count unread
      unreadCount: unread.length,
    };
  },

  markAsRead: async (id: number) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    mockNotifications = mockNotifications.map((n) =>
      n.notification_id === id ? { ...n, is_read: true } : n
    );
  },
};
