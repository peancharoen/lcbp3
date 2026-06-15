// File: lib/api/__tests__/dashboard.test.ts
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { describe, it, expect } from 'vitest';
import { dashboardApi } from '../dashboard';

describe('dashboardApi', () => {
  describe('getStats', () => {
    it('ควร return dashboard stats', async () => {
      const stats = await dashboardApi.getStats();
      
      expect(stats).toHaveProperty('totalDocuments');
      expect(stats).toHaveProperty('documentsThisMonth');
      expect(stats).toHaveProperty('pendingApprovals');
      expect(stats).toHaveProperty('approved');
      expect(stats).toHaveProperty('totalRfas');
      expect(stats).toHaveProperty('totalCirculations');
    });

    it('ควร return numbers สำหรับ stats', async () => {
      const stats = await dashboardApi.getStats();
      
      expect(typeof stats.totalDocuments).toBe('number');
      expect(typeof stats.documentsThisMonth).toBe('number');
      expect(typeof stats.pendingApprovals).toBe('number');
    });
  });

  describe('getRecentActivity', () => {
    it('ควร return array of activity logs', async () => {
      const activities = await dashboardApi.getRecentActivity();
      
      expect(Array.isArray(activities)).toBe(true);
      expect(activities.length).toBeGreaterThan(0);
    });

    it('ควร return activities ที่มี id, user, action, description', async () => {
      const activities = await dashboardApi.getRecentActivity();
      
      expect(activities[0]).toHaveProperty('id');
      expect(activities[0]).toHaveProperty('user');
      expect(activities[0]).toHaveProperty('action');
      expect(activities[0]).toHaveProperty('description');
    });

    it('ควร return activities ที่มี user.name และ user.initials', async () => {
      const activities = await dashboardApi.getRecentActivity();
      
      expect(activities[0].user).toHaveProperty('name');
      expect(activities[0].user).toHaveProperty('initials');
    });
  });

  describe('getPendingTasks', () => {
    it('ควร return array of pending tasks', async () => {
      const tasks = await dashboardApi.getPendingTasks();
      
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
    });

    it('ควร return tasks ที่มี publicId, workflowCode, currentState', async () => {
      const tasks = await dashboardApi.getPendingTasks();
      
      expect(tasks[0]).toHaveProperty('publicId');
      expect(tasks[0]).toHaveProperty('workflowCode');
      expect(tasks[0]).toHaveProperty('currentState');
    });

    it('ควร return tasks ที่มี entityType, documentNumber, subject', async () => {
      const tasks = await dashboardApi.getPendingTasks();
      
      expect(tasks[0]).toHaveProperty('entityType');
      expect(tasks[0]).toHaveProperty('documentNumber');
      expect(tasks[0]).toHaveProperty('subject');
    });
  });
});
