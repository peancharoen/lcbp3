// File: frontend/lib/services/__tests__/workflow-engine.service.test.ts
// Change Log:
// - 2026-06-13: Refactor to use static imports instead of require, fixing ESM module resolution errors

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  workflowEngineService,
  normalizeWorkflowType,
  extractDslDefinition,
  extractArrayData,
  extractNestedData,
  mapWorkflow,
} from '../workflow-engine.service';
import apiClient from '@/lib/api/client';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('workflowEngineService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Engine Execution', () => {
    it('should get available actions', async () => {
      const mockActions = ['APPROVE', 'REJECT'];
      (apiClient.post as any).mockResolvedValue({ data: { data: mockActions } });
      const result = await workflowEngineService.getAvailableActions({
        entityType: 'RFA',
        entityId: '019505a1-7c3e-7000-8000-abc123def456',
      });
      expect(result).toEqual(mockActions);
      expect(apiClient.post).toHaveBeenCalledWith('/workflow-engine/available-actions', {
        entityType: 'RFA',
        entityId: '019505a1-7c3e-7000-8000-abc123def456',
      });
    });

    it('should evaluate workflow transition', async () => {
      const mockEvaluation = { nextState: 'APPROVED', events: [] };
      (apiClient.post as any).mockResolvedValue({ data: { data: mockEvaluation } });
      const result = await workflowEngineService.evaluate({
        entityType: 'RFA',
        entityId: '019505a1-7c3e-7000-8000-abc123def456',
        action: 'APPROVE',
      });
      expect(result).toEqual(mockEvaluation);
      expect(apiClient.post).toHaveBeenCalledWith('/workflow-engine/evaluate', {
        entityType: 'RFA',
        entityId: '019505a1-7c3e-7000-8000-abc123def456',
        action: 'APPROVE',
      });
    });
  });

  describe('Definition Management', () => {
    it('should get all workflow definitions', async () => {
      const mockWorkflows = [
        {
          id: 1,
          workflow_code: 'RFA_FLOW_V1',
          description: 'RFA Workflow',
          version: 1,
          is_active: true,
          dsl: { workflowName: 'RFA Flow' },
          compiled: { states: { DFT: {}, FAP: {} } },
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      (apiClient.get as any).mockResolvedValue({ data: mockWorkflows });
      const result = await workflowEngineService.getDefinitions();
      expect(result).toHaveLength(1);
      expect(result[0].workflowName).toBe('RFA Flow');
      expect(result[0].workflowType).toBe('RFA');
      expect(apiClient.get).toHaveBeenCalledWith('/workflow-engine/definitions');
    });

    it('should get workflow definition by id', async () => {
      const mockWorkflow = {
        id: 1,
        workflow_code: 'RFA_FLOW_V1',
        description: 'RFA Workflow',
        version: 1,
        is_active: true,
        dsl: { workflowName: 'RFA Flow' },
        compiled: { states: { DFT: {}, FAP: {} } },
        updated_at: '2026-01-01T00:00:00Z',
      };
      (apiClient.get as any).mockResolvedValue({ data: { data: mockWorkflow } });
      const result = await workflowEngineService.getDefinitionById(1);
      expect(result.workflowName).toBe('RFA Flow');
      expect(apiClient.get).toHaveBeenCalledWith('/workflow-engine/definitions/1');
    });

    it('should create workflow definition', async () => {
      const mockCreated = { id: 1, workflow_code: 'NEW_FLOW' };
      (apiClient.post as any).mockResolvedValue({ data: { data: mockCreated } });
      const result = await workflowEngineService.createDefinition({
        workflowCode: 'NEW_FLOW',
        dslDefinition: '{}',
      });
      expect(result).toEqual(mockCreated);
      expect(apiClient.post).toHaveBeenCalledWith('/workflow-engine/definitions', {
        workflowCode: 'NEW_FLOW',
        dslDefinition: '{}',
      });
    });

    it('should update workflow definition', async () => {
      const mockUpdated = { id: 1, workflow_code: 'UPDATED_FLOW' };
      (apiClient.patch as any).mockResolvedValue({ data: { data: mockUpdated } });
      const result = await workflowEngineService.updateDefinition(1, {
        dslDefinition: '{}',
      });
      expect(result).toEqual(mockUpdated);
      expect(apiClient.patch).toHaveBeenCalledWith('/workflow-engine/definitions/1', {
        dslDefinition: '{}',
      });
    });

    it('should validate DSL', async () => {
      const mockValidation = { valid: true };
      (apiClient.post as any).mockResolvedValue({ data: { data: mockValidation } });
      const result = await workflowEngineService.validateDsl({ workflowName: 'Test' });
      expect(result).toEqual(mockValidation);
      expect(apiClient.post).toHaveBeenCalledWith('/workflow-engine/definitions/validate', {
        dsl: { workflowName: 'Test' },
      });
    });

    it('should return validation errors for invalid DSL', async () => {
      const mockValidation = {
        valid: false,
        errors: [{ path: 'states', message: 'Invalid state' }],
      };
      (apiClient.post as any).mockResolvedValue({ data: { data: mockValidation } });
      const result = await workflowEngineService.validateDsl({});
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toHaveLength(1);
      }
    });

    it('should delete workflow definition', async () => {
      const mockDeleted = { id: 1 };
      (apiClient.delete as any).mockResolvedValue({ data: { data: mockDeleted } });
      const result = await workflowEngineService.deleteDefinition(1);
      expect(result).toEqual(mockDeleted);
      expect(apiClient.delete).toHaveBeenCalledWith('/workflow-engine/definitions/1');
    });
  });

  describe('Workflow Transition and History', () => {
    it('should transition workflow instance', async () => {
      const mockTransition = { instanceId: 'uuid-1', state: 'APPROVED' };
      (apiClient.post as any).mockResolvedValue({ data: { data: mockTransition } });
      const result = await workflowEngineService.transition(
        '019505a1-7c3e-7000-8000-abc123def456',
        { action: 'APPROVE', comments: 'Approved' },
        'idempotency-key-123'
      );
      expect(result).toEqual(mockTransition);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/workflow-engine/instances/019505a1-7c3e-7000-8000-abc123def456/transition',
        { action: 'APPROVE', comments: 'Approved' },
        { headers: { 'Idempotency-Key': 'idempotency-key-123' } }
      );
    });

    it('should get workflow history', async () => {
      const mockHistory = [
        {
          id: 1,
          fromState: 'DFT',
          toState: 'FAP',
          action: 'SUBMIT',
          actorId: 'user-uuid',
          timestamp: '2026-01-01T00:00:00Z',
        },
      ];
      (apiClient.get as any).mockResolvedValue({ data: { data: mockHistory } });
      const result = await workflowEngineService.getHistory('019505a1-7c3e-7000-8000-abc123def456');
      expect(result).toEqual(mockHistory);
      expect(apiClient.get).toHaveBeenCalledWith(
        '/workflow-engine/instances/019505a1-7c3e-7000-8000-abc123def456/history'
      );
    });

    it('should handle empty history array', async () => {
      (apiClient.get as any).mockResolvedValue({ data: { data: [] } });
      const result = await workflowEngineService.getHistory('019505a1-7c3e-7000-8000-abc123def456');
      expect(result).toEqual([]);
    });
  });

  describe('Helper Functions', () => {
    it('should normalize workflow type to RFA', () => {
      expect(normalizeWorkflowType('RFA_FLOW_V1')).toBe('RFA');
      expect(normalizeWorkflowType('rfa_flow_v1')).toBe('RFA');
    });

    it('should normalize workflow type to DRAWING', () => {
      expect(normalizeWorkflowType('DRAWING_FLOW_V1')).toBe('DRAWING');
      expect(normalizeWorkflowType('drawing_flow_v1')).toBe('DRAWING');
    });

    it('should normalize workflow type to CORRESPONDENCE by default', () => {
      expect(normalizeWorkflowType('CORR_FLOW_V1')).toBe('CORRESPONDENCE');
      expect(normalizeWorkflowType(undefined)).toBe('CORRESPONDENCE');
    });

    it('should extract DSL definition from string', () => {
      const dsl = '{"workflowName": "Test"}';
      expect(extractDslDefinition(dsl)).toBe(dsl);
    });

    it('should extract DSL definition from object', () => {
      const dsl = { dslDefinition: '{"workflowName": "Test"}' };
      expect(extractDslDefinition(dsl)).toBe('{"workflowName": "Test"}');
    });

    it('should return empty string for invalid DSL', () => {
      expect(extractDslDefinition(null)).toBe('');
      expect(extractDslDefinition(undefined)).toBe('');
      expect(extractDslDefinition('')).toBe('');
    });

    it('should extract array data from nested structure', () => {
      const data = { data: { data: [1, 2, 3] } };
      const result = extractArrayData(data);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return empty array for non-array data', () => {
      const data = { data: 'not an array' };
      const result = extractArrayData(data);
      expect(result).toEqual([]);
    });

    it('should extract nested data', () => {
      const data = { data: { data: { id: 1 } } };
      const result = extractNestedData(data);
      expect(result).toEqual({ id: 1 });
    });

    it('should map backend workflow to frontend workflow', () => {
      const backendWorkflow = {
        id: 1,
        workflow_code: 'RFA_FLOW_V1',
        description: 'Test',
        version: 1,
        is_active: true,
        dsl: { workflowName: 'RFA Flow' },
        compiled: { states: { DFT: {}, FAP: {} } },
        updated_at: '2026-01-01T00:00:00Z',
      };
      const result = mapWorkflow(backendWorkflow);
      expect(result.publicId).toBe('1');
      expect(result.workflowName).toBe('RFA Flow');
      expect(result.workflowType).toBe('RFA');
      expect(result.version).toBe(1);
      expect(result.isActive).toBe(true);
      expect(result.stepCount).toBe(2);
    });

    it('should throw error when mapping null workflow', () => {
      expect(() => mapWorkflow(null as any)).toThrow('Workflow not found');
    });
  });
});
