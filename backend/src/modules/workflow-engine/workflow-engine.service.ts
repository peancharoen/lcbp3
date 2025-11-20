import { Injectable, BadRequestException } from '@nestjs/common';
import {
  WorkflowStep,
  WorkflowAction,
  StepStatus,
  TransitionResult,
} from './interfaces/workflow.interface.js';

@Injectable()
export class WorkflowEngineService {
  /**
   * คำนวณสถานะถัดไป (Next State Transition)
   * @param currentSequence ลำดับปัจจุบัน
   * @param totalSteps จำนวนขั้นตอนทั้งหมด
   * @param action การกระทำ (Approve/Reject/Return)
   * @param returnToSequence (Optional) ถ้า Return จะให้กลับไปขั้นไหน
   */
  processAction(
    currentSequence: number,
    totalSteps: number,
    action: WorkflowAction,
    returnToSequence?: number,
  ): TransitionResult {
    switch (action) {
      case WorkflowAction.APPROVE:
      case WorkflowAction.ACKNOWLEDGE:
        // ถ้าเป็นขั้นตอนสุดท้าย -> จบ Workflow
        if (currentSequence >= totalSteps) {
          return {
            nextStepSequence: null, // ไม่มีขั้นต่อไปแล้ว
            shouldUpdateStatus: true,
            documentStatus: 'COMPLETED', // หรือ APPROVED
          };
        }
        // ถ้ายังไม่จบ -> ไปขั้นต่อไป
        return {
          nextStepSequence: currentSequence + 1,
          shouldUpdateStatus: false,
        };

      case WorkflowAction.REJECT:
        // จบ Workflow ทันทีแบบไม่สวย
        return {
          nextStepSequence: null,
          shouldUpdateStatus: true,
          documentStatus: 'REJECTED',
        };

      case WorkflowAction.RETURN:
        // ย้อนกลับไปขั้นตอนก่อนหน้า (หรือที่ระบุ)
        const targetStep = returnToSequence || currentSequence - 1;
        if (targetStep < 1) {
          throw new BadRequestException('Cannot return beyond the first step');
        }
        return {
          nextStepSequence: targetStep,
          shouldUpdateStatus: true,
          documentStatus: 'REVISE_REQUIRED', // สถานะเอกสารเป็น "รอแก้ไข"
        };

      default:
        throw new BadRequestException(`Invalid action: ${action}`);
    }
  }

  /**
   * ตรวจสอบว่า User คนนี้ มีสิทธิ์กด Action ในขั้นตอนนี้ไหม
   * (Logic เบื้องต้น - เดี๋ยวเราจะเชื่อมกับ RBAC จริงๆ ใน Service หลัก)
   */
  validateAccess(
    step: WorkflowStep,
    userOrgId: number,
    userId: number,
  ): boolean {
    // ถ้าขั้นตอนนี้ยังไม่ Active (เช่น PENDING หรือ SKIPPED) -> ห้ามยุ่ง
    if (step.status !== StepStatus.IN_PROGRESS) {
      return false;
    }

    // เช็คว่าตรงกับ Organization ที่กำหนดไหม
    if (step.organizationId && step.organizationId !== userOrgId) {
      return false;
    }

    // เช็คว่าตรงกับ User ที่กำหนดไหม (ถ้าระบุ)
    if (step.assigneeId && step.assigneeId !== userId) {
      return false;
    }

    return true;
  }
}
