import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowAction } from './interfaces/workflow.interface';
import { BadRequestException } from '@nestjs/common';

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkflowEngineService],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processAction', () => {
    // 🟢 กรณี: อนุมัติทั่วไป (ไปขั้นต่อไป)
    it('should move to next step on APPROVE', () => {
      const result = service.processAction(1, 3, WorkflowAction.APPROVE);
      expect(result.nextStepSequence).toBe(2);
      expect(result.shouldUpdateStatus).toBe(false);
    });

    // 🟢 กรณี: อนุมัติขั้นตอนสุดท้าย (จบงาน)
    it('should complete workflow on APPROVE at last step', () => {
      const result = service.processAction(3, 3, WorkflowAction.APPROVE);
      expect(result.nextStepSequence).toBeNull(); // ไม่มีขั้นต่อไป
      expect(result.shouldUpdateStatus).toBe(true);
      expect(result.documentStatus).toBe('COMPLETED');
    });

    // 🔴 กรณี: ปฏิเสธ (จบงานทันที)
    it('should stop workflow on REJECT', () => {
      const result = service.processAction(1, 3, WorkflowAction.REJECT);
      expect(result.nextStepSequence).toBeNull();
      expect(result.shouldUpdateStatus).toBe(true);
      expect(result.documentStatus).toBe('REJECTED');
    });

    // 🟠 กรณี: ส่งกลับ (ย้อนกลับ 1 ขั้น)
    it('should return to previous step on RETURN', () => {
      const result = service.processAction(2, 3, WorkflowAction.RETURN);
      expect(result.nextStepSequence).toBe(1);
      expect(result.shouldUpdateStatus).toBe(true);
      expect(result.documentStatus).toBe('REVISE_REQUIRED');
    });

    // 🟠 กรณี: ส่งกลับ (ระบุขั้น)
    it('should return to specific step on RETURN', () => {
      const result = service.processAction(3, 5, WorkflowAction.RETURN, 1);
      expect(result.nextStepSequence).toBe(1);
    });

    // ❌ กรณี: Error (ส่งกลับต่ำกว่า 1)
    it('should throw error if return step is invalid', () => {
      expect(() => {
        service.processAction(1, 3, WorkflowAction.RETURN);
      }).toThrow(BadRequestException);
    });
  });
});
