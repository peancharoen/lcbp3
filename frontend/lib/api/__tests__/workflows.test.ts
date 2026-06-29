// File: lib/api/__tests__/workflows.test.ts
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { describe, it, expect, beforeEach } from 'vitest';
import { workflowApi } from '../workflows';

describe('workflowApi', () => {
  beforeEach(() => {
    // Reset mock data before each test
    // Note: This is a simplified reset since the mock is in the same file
  });

  describe('getWorkflows', () => {
    it('ควร return array of workflows', async () => {
      const workflows = await workflowApi.getWorkflows();

      expect(Array.isArray(workflows)).toBe(true);
      expect(workflows.length).toBeGreaterThan(0);
    });

    it('ควร return workflows ที่มี publicId, workflowName, workflowType', async () => {
      const workflows = await workflowApi.getWorkflows();

      expect(workflows[0]).toHaveProperty('publicId');
      expect(workflows[0]).toHaveProperty('workflowName');
      expect(workflows[0]).toHaveProperty('workflowType');
    });

    it('ควร return workflows ที่มี dslDefinition, version, isActive', async () => {
      const workflows = await workflowApi.getWorkflows();

      expect(workflows[0]).toHaveProperty('dslDefinition');
      expect(workflows[0]).toHaveProperty('version');
      expect(workflows[0]).toHaveProperty('isActive');
    });
  });

  describe('getWorkflow', () => {
    it('ควร return workflow เมื่อ id ถูกต้อง', async () => {
      const workflow = await workflowApi.getWorkflow('wf-001');

      expect(workflow).toBeDefined();
      expect(workflow?.publicId).toBe('wf-001');
    });

    it('ควร return undefined เมื่อ id ไม่ถูกต้อง', async () => {
      const workflow = await workflowApi.getWorkflow('non-existent');

      expect(workflow).toBeUndefined();
    });
  });

  describe('createWorkflow', () => {
    it('ควร create workflow ใหม่และ return workflow object', async () => {
      const data = {
        workflowName: 'Test Workflow',
        description: 'Test description',
        workflowType: 'RFA',
        dslDefinition: 'name: Test\nsteps: []',
      };

      const newWorkflow = await workflowApi.createWorkflow(data);

      expect(newWorkflow).toHaveProperty('publicId');
      expect(newWorkflow.workflowName).toBe('Test Workflow');
      expect(newWorkflow.version).toBe(1);
      expect(newWorkflow.isActive).toBe(true);
    });

    it('ควร assign workflowId ใหม่ให้ workflow', async () => {
      const data = {
        workflowName: 'New Workflow',
        description: 'New description',
        workflowType: 'CORRESPONDENCE',
        dslDefinition: 'name: New\nsteps: []',
      };

      const newWorkflow = await workflowApi.createWorkflow(data);

      expect(newWorkflow.workflowId).toBeGreaterThan(0);
    });
  });

  describe('updateWorkflow', () => {
    it('ควร update workflow และ return updated object', async () => {
      const data = {
        workflowName: 'Updated Workflow',
        description: 'Updated description',
      };

      const updatedWorkflow = await workflowApi.updateWorkflow('wf-001', data);

      expect(updatedWorkflow.workflowName).toBe('Updated Workflow');
      expect(updatedWorkflow.description).toBe('Updated description');
    });

    it('ควร throw error เมื่อ workflow ไม่พบ', async () => {
      const data = { workflowName: 'Test' };

      await expect(workflowApi.updateWorkflow('non-existent', data)).rejects.toThrow('Workflow not found');
    });
  });

  describe('validateDSL', () => {
    it('ควร return valid=true เมื่อ DSL ถูกต้อง', async () => {
      const dsl = 'name: Test Workflow\nsteps:\n  - name: Step 1\n    type: REVIEW';

      const result = await workflowApi.validateDSL(dsl);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('ควร return valid=false เมื่อ DSL ไม่มี name', async () => {
      const dsl = 'invalid dsl without name or steps';

      const result = await workflowApi.validateDSL(dsl);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('ควร return valid=false เมื่อ DSL ไม่มี steps', async () => {
      const dsl = 'name: Test Workflow';

      const result = await workflowApi.validateDSL(dsl);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
