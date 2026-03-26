import { NotificationResponse } from '@/types/notification';

// Mock Data
let mockNotifications = [
  {
    publicId: '019575a0-0001-7000-8000-000000000001',
    notificationId: 1,
    title: 'RFA Approved',
    message: 'RFA-001 has been approved by the Project Manager.',
    type: 'SUCCESS' as const,
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
    link: '/rfas/1',
  },
  {
    publicId: '019575a0-0002-7000-8000-000000000002',
    notificationId: 2,
    title: 'New Correspondence',
    message: 'You have received a new correspondence from Contractor A.',
    type: 'INFO' as const,
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    link: '/correspondences/3',
  },
  {
    publicId: '019575a0-0003-7000-8000-000000000003',
    notificationId: 3,
    title: 'Drawing Revision Required',
    message: 'Drawing S-201 requires revision based on recent comments.',
    type: 'WARNING' as const,
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    link: '/drawings/2',
  },
];

export const notificationApi = {
  getUnread: async (): Promise<NotificationResponse> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const unread = mockNotifications.filter((n) => !n.isRead);
    return {
      items: mockNotifications, // Return all for the list, but count unread
      unreadCount: unread.length,
    };
  },

  markAsRead: async (id: number) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    mockNotifications = mockNotifications.map((n) => (n.notificationId === id ? { ...n, isRead: true } : n));
  },
};
