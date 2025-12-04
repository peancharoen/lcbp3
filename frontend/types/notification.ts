export interface Notification {
  notification_id: number;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  is_read: boolean;
  created_at: string;
  link?: string;
}

export interface NotificationResponse {
  items: Notification[];
  unreadCount: number;
}
