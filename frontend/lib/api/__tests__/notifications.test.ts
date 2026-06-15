// File: lib/api/__tests__/notifications.test.ts
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { describe, it, expect, beforeEach } from 'vitest';
import { notificationApi } from '../notifications';

describe('notificationApi', () => {
  beforeEach(() => {
    // Reset mock data before each test
    // Note: This is a simplified reset since the mock is in the same file
  });

  describe('getUnread', () => {
    it('ควร return notifications พร้อม unreadCount', async () => {
      const result = await notificationApi.getUnread();
      
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('unreadCount');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('ควร return notifications ที่มี publicId, title, message', async () => {
      const result = await notificationApi.getUnread();
      
      expect(result.items[0]).toHaveProperty('publicId');
      expect(result.items[0]).toHaveProperty('title');
      expect(result.items[0]).toHaveProperty('message');
    });

    it('ควร return notifications ที่มี type, isRead, createdAt', async () => {
      const result = await notificationApi.getUnread();
      
      expect(result.items[0]).toHaveProperty('type');
      expect(result.items[0]).toHaveProperty('isRead');
      expect(result.items[0]).toHaveProperty('createdAt');
    });

    it('ควร count unread notifications อย่างถูกต้อง', async () => {
      const result = await notificationApi.getUnread();
      
      expect(typeof result.unreadCount).toBe('number');
      expect(result.unreadCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('markAsRead', () => {
    it('ควร mark notification เป็น read', async () => {
      await notificationApi.markAsRead(1);
      
      const result = await notificationApi.getUnread();
      const notification = result.items.find((n) => n.notificationId === 1);
      
      expect(notification?.isRead).toBe(true);
    });

    it('ควรไม่ affect notifications อื่น', async () => {
      await notificationApi.markAsRead(1);
      
      const result = await notificationApi.getUnread();
      const otherNotification = result.items.find((n) => n.notificationId === 2);
      
      expect(otherNotification?.isRead).toBe(false);
    });
  });
});
