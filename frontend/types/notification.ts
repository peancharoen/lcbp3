export interface Notification {
  notificationId: number;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface NotificationResponse {
  items: Notification[];
  unreadCount: number;
}
