// File: src/modules/workflow-engine/dsl/parallel-gateway.handler.ts
// Parallel Gateway DSL handler สำหรับ RFA parallel review (T066, ADR-001)
// Strangler Pattern: ขยาย WorkflowEngine โดยไม่แก้ไข core DSL
import { Injectable, Logger } from '@nestjs/common';

export interface ParallelGatewayStep {
  type: 'parallel_gateway';
  id: string;
  branches: ParallelBranch[];
  completionStrategy: 'ALL' | 'MAJORITY' | 'ANY';
  onComplete: string; // next step ID
}

export interface ParallelBranch {
  id: string;
  assigneeType: 'DISCIPLINE' | 'USER' | 'TEAM';
  assigneeId: string; // publicId
  steps: string[]; // step IDs within this branch
}

export interface GatewayExecutionContext {
  rfaRevisionPublicId: string;
  completedBranches: Set<string>;
  totalBranches: number;
}

@Injectable()
export class ParallelGatewayHandler {
  private readonly logger = new Logger(ParallelGatewayHandler.name);

  /**
   * ตรวจสอบว่า gateway สามารถเดินหน้าได้หรือยัง ตาม completionStrategy (FR-008)
   */
  canAdvance(step: ParallelGatewayStep, ctx: GatewayExecutionContext): boolean {
    const { completedBranches, totalBranches } = ctx;

    switch (step.completionStrategy) {
      case 'ALL':
        return completedBranches.size === totalBranches;

      case 'MAJORITY':
        return completedBranches.size > Math.floor(totalBranches / 2);

      case 'ANY':
        return completedBranches.size >= 1;

      default:
        this.logger.warn(`Unknown completion strategy: ${step.completionStrategy as string}`);
        return false;
    }
  }

  /**
   * สร้าง execution context จาก gateway definition
   */
  createContext(
    rfaRevisionPublicId: string,
    step: ParallelGatewayStep,
  ): GatewayExecutionContext {
    return {
      rfaRevisionPublicId,
      completedBranches: new Set<string>(),
      totalBranches: step.branches.length,
    };
  }

  /**
   * Mark a branch complete and check if gateway can advance
   */
  markBranchComplete(
    ctx: GatewayExecutionContext,
    branchId: string,
    step: ParallelGatewayStep,
  ): { canAdvance: boolean; completedCount: number } {
    ctx.completedBranches.add(branchId);

    const canAdvance = this.canAdvance(step, ctx);

    this.logger.log(
      `Branch ${branchId} complete. ${ctx.completedBranches.size}/${ctx.totalBranches} — canAdvance: ${canAdvance}`,
    );

    return { canAdvance, completedCount: ctx.completedBranches.size };
  }
}
