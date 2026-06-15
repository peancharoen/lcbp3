// File: lib/api/__tests__/admin.test.ts
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { describe, it, expect, vi } from 'vitest';
import { adminApi } from '../admin';

describe('adminApi', () => {
  describe('getUsers', () => {
    it('ควร return array of users', async () => {
      const users = await adminApi.getUsers();
      
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
    });

    it('ควร return users ที่มี publicId, username, email', async () => {
      const users = await adminApi.getUsers();
      
      expect(users[0]).toHaveProperty('publicId');
      expect(users[0]).toHaveProperty('username');
      expect(users[0]).toHaveProperty('email');
    });
  });

  describe('createUser', () => {
    it('ควร create user ใหม่และ return user object', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        roles: [2],
      };

      const newUser = await adminApi.createUser(userData);
      
      expect(newUser).toHaveProperty('publicId');
      expect(newUser.username).toBe('testuser');
      expect(newUser.email).toBe('test@example.com');
    });

    it('ควร assign userId ใหม่ให้ user', async () => {
      const userData = {
        username: 'newuser',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        isActive: true,
        roles: [2],
      };

      const newUser = await adminApi.createUser(userData);
      
      expect(newUser.userId).toBeGreaterThan(0);
    });
  });

  describe('getOrganizations', () => {
    it('ควร return array of organizations', async () => {
      const orgs = await adminApi.getOrganizations();
      
      expect(Array.isArray(orgs)).toBe(true);
      expect(orgs.length).toBeGreaterThan(0);
    });

    it('ควร return organizations ที่มี publicId, orgCode, orgName', async () => {
      const orgs = await adminApi.getOrganizations();
      
      expect(orgs[0]).toHaveProperty('publicId');
      expect(orgs[0]).toHaveProperty('orgCode');
      expect(orgs[0]).toHaveProperty('orgName');
    });
  });

  describe('createOrganization', () => {
    it('ควร create organization ใหม่และ return org object', async () => {
      const orgData = {
        publicId: 'org-003',
        orgCode: 'TEST',
        orgName: 'Test Organization',
        description: 'Test description',
      };

      const newOrg = await adminApi.createOrganization(orgData);
      
      expect(newOrg).toHaveProperty('publicId');
      expect(newOrg.orgCode).toBe('TEST');
      expect(newOrg.orgName).toBe('Test Organization');
    });

    it('ควร assign orgId ใหม่ให้ organization', async () => {
      const orgData = {
        publicId: 'org-004',
        orgCode: 'TEST2',
        orgName: 'Test Organization 2',
        description: 'Test description 2',
      };

      const newOrg = await adminApi.createOrganization(orgData);
      
      expect(newOrg.orgId).toBeGreaterThan(0);
    });
  });

  describe('getAuditLogs', () => {
    it('ควร return array of audit logs', async () => {
      const logs = await adminApi.getAuditLogs();
      
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    it('ควร return logs ที่มี publicId, userName, action', async () => {
      const logs = await adminApi.getAuditLogs();
      
      expect(logs[0]).toHaveProperty('publicId');
      expect(logs[0]).toHaveProperty('userName');
      expect(logs[0]).toHaveProperty('action');
    });
  });
});
