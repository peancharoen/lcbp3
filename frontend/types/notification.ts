export interface Notification {
  publicId: string; // ADR-019: exposed as 'id' in API responses
  notificationId?: number; // Excluded from API responses (ADR-019)
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface NotificationResponse {
  items: Notification[];
  unreadCount: number;
}
