// File: frontend/hooks/__tests__/use-workflows.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for use-workflows hooks

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import {
  useWorkflowDefinitions,
  useWorkflowDefinition,
  useCreateWorkflowDefinition,
  useUpdateWorkflowDefinition,
  useDeleteWorkflowDefinition,
  useEvaluateWorkflow,
  useGetAvailableActions,
  useValidateDsl,
  workflowKeys,
} from '../use-workflows';
import { workflowEngineService } from '@/lib/services/workflow-engine.service';

// Mock services
vi.mock('@/lib/services/workflow-engine.service', () => ({
  workflowEngineService: {
    getDefinitions: vi.fn(),
    getDefinitionById: vi.fn(),
    createDefinition: vi.fn(),
    updateDefinition: vi.fn(),
    deleteDefinition: vi.fn(),
    evaluate: vi.fn(),
    getAvailableActions: vi.fn(),
    validateDsl: vi.fn(),
  },
}));

describe('use-workflows hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('workflowKeys', () => {
    it('ควรสร้าง cache keys ที่ถูกต้อง', () => {
      expect(workflowKeys.all).toEqual(['workflows']);
      expect(workflowKeys.definitions()).toEqual(['workflows', 'definitions']);
      expect(workflowKeys.definition('uuid-1')).toEqual(['workflows', 'definitions', 'uuid-1']);
    });
  });

  describe('useWorkflowDefinitions', () => {
    it('ควรดึงข้อมูล definitions สำเร็จ', async () => {
      const mockData = [{ publicId: 'uuid-1', workflowName: 'Workflow A' }];
      vi.mocked(workflowEngineService.getDefinitions).mockResolvedValue(mockData as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useWorkflowDefinitions(), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(workflowEngineService.getDefinitions).toHaveBeenCalled();
    });
  });

  describe('useWorkflowDefinition', () => {
    it('ควรดึงข้อมูล definition ตาม id สำเร็จ', async () => {
      const mockData = { publicId: 'uuid-1', workflowName: 'Workflow A' };
      vi.mocked(workflowEngineService.getDefinitionById).mockResolvedValue(mockData as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useWorkflowDefinition('uuid-1'), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(workflowEngineService.getDefinitionById).toHaveBeenCalledWith('uuid-1');
    });
  });

  describe('useCreateWorkflowDefinition', () => {
    it('ควรสร้าง workflow definition สำเร็จ', async () => {
      const mockResponse = { publicId: 'uuid-1', workflowName: 'Workflow A' };
      vi.mocked(workflowEngineService.createDefinition).mockResolvedValue(mockResponse as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateWorkflowDefinition(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync({ workflowName: 'Workflow A', dslDefinition: {} } as any);
      });
      expect(workflowEngineService.createDefinition).toHaveBeenCalledWith({ workflowName: 'Workflow A', dslDefinition: {} });
    });
  });

  describe('useUpdateWorkflowDefinition', () => {
    it('ควรแก้ไข workflow definition สำเร็จ', async () => {
      const mockResponse = { publicId: 'uuid-1', workflowName: 'Workflow A Updated' };
      vi.mocked(workflowEngineService.updateDefinition).mockResolvedValue(mockResponse as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useUpdateWorkflowDefinition(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync({ id: 'uuid-1', data: { workflowName: 'Workflow A Updated' } as any });
      });
      expect(workflowEngineService.updateDefinition).toHaveBeenCalledWith('uuid-1', { workflowName: 'Workflow A Updated' });
    });
  });

  describe('useDeleteWorkflowDefinition', () => {
    it('ควรลบ workflow definition สำเร็จ', async () => {
      vi.mocked(workflowEngineService.deleteDefinition).mockResolvedValue({} as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDeleteWorkflowDefinition(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync('uuid-1');
      });
      expect(workflowEngineService.deleteDefinition).toHaveBeenCalledWith('uuid-1');
    });
  });

  describe('useEvaluateWorkflow', () => {
    it('ควรประเมิน workflow สำเร็จ', async () => {
      const mockResponse = { status: 'APPROVED' };
      vi.mocked(workflowEngineService.evaluate).mockResolvedValue(mockResponse as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useEvaluateWorkflow(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync({ workflowUuid: 'uuid-1', action: 'APPROVE' } as any);
      });
      expect(workflowEngineService.evaluate).toHaveBeenCalledWith({ workflowUuid: 'uuid-1', action: 'APPROVE' });
    });
  });

  describe('useGetAvailableActions', () => {
    it('ควรดึง actions ที่ใช้งานได้สำเร็จ', async () => {
      const mockResponse = ['APPROVE', 'REJECT'];
      vi.mocked(workflowEngineService.getAvailableActions).mockResolvedValue(mockResponse as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useGetAvailableActions(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync({ workflowUuid: 'uuid-1' } as any);
      });
      expect(workflowEngineService.getAvailableActions).toHaveBeenCalledWith({ workflowUuid: 'uuid-1' });
    });
  });

  describe('useValidateDsl', () => {
    it('ควรตรวจสอบความถูกต้องของ DSL สำเร็จ', async () => {
      const mockResponse = { valid: true };
      vi.mocked(workflowEngineService.validateDsl).mockResolvedValue(mockResponse as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useValidateDsl(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync({ steps: [] });
      });
      expect(workflowEngineService.validateDsl).toHaveBeenCalledWith({ steps: [] });
    });
  });
});
