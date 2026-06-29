// File: src/modules/response-code/services/implications.service.ts
// ประเมินผลกระทบของ Response Code ที่เลือก (FR-007)
import { Injectable, Logger } from '@nestjs/common';
import { ResponseCode } from '../entities/response-code.entity';

export interface CodeImplicationResult {
  affectsSchedule: boolean;
  affectsCost: boolean;
  requiresContractReview: boolean;
  requiresEiaAmendment: boolean;
  notifyRoles: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionRequired: string[];
}

@Injectable()
export class ImplicationsService {
  private readonly logger = new Logger(ImplicationsService.name);

  /**
   * ประเมินผลกระทบของ Response Code (FR-007)
   * Code 1C, 1D, 3 → Critical → trigger notifications
   */
  evaluate(responseCode: ResponseCode): CodeImplicationResult {
    const implications = responseCode.implications ?? {};
    const notifyRoles = responseCode.notifyRoles ?? [];

    const affectsSchedule = implications.affectsSchedule ?? false;
    const affectsCost = implications.affectsCost ?? false;
    const requiresContractReview = implications.requiresContractReview ?? false;
    const requiresEiaAmendment = implications.requiresEiaAmendment ?? false;

    // กำหนด severity ตามน้ำหนักผลกระทบ
    const severity = this.calculateSeverity(
      responseCode.code,
      affectsSchedule,
      affectsCost,
      requiresContractReview
    );

    const actionRequired = this.buildActionList(
      responseCode.code,
      requiresContractReview,
      requiresEiaAmendment,
      affectsCost
    );

    return {
      affectsSchedule,
      affectsCost,
      requiresContractReview,
      requiresEiaAmendment,
      notifyRoles,
      severity,
      actionRequired,
    };
  }

  private calculateSeverity(
    code: string,
    affectsSchedule: boolean,
    affectsCost: boolean,
    requiresContractReview: boolean
  ): CodeImplicationResult['severity'] {
    // Code 3 (Rejected) = CRITICAL เสมอ
    if (code === '3') return 'CRITICAL';

    // Code 1C (Contract Implications) หรือ 1D (Alternative) = HIGH
    if (code === '1C' || code === '1D') return 'HIGH';

    // มีผลต่อทั้ง schedule และ cost
    if (affectsSchedule && affectsCost) return 'HIGH';

    // มีผลต่ออย่างใดอย่างหนึ่ง
    if (requiresContractReview || affectsSchedule || affectsCost)
      return 'MEDIUM';

    return 'LOW';
  }

  private buildActionList(
    code: string,
    requiresContractReview: boolean,
    requiresEiaAmendment: boolean,
    affectsCost: boolean
  ): string[] {
    const actions: string[] = [];

    if (code === '3') {
      actions.push('Document rejected — originator must revise and resubmit');
    }

    if (requiresContractReview) {
      actions.push('Contract review required — notify Contract Manager');
    }

    if (affectsCost) {
      actions.push('Cost impact assessment required — notify QS Manager');
    }

    if (requiresEiaAmendment) {
      actions.push('EIA amendment may be required — notify EIA Officer');
    }

    if (code === '2') {
      actions.push('Minor comments — originator to revise and resubmit');
    }

    return actions;
  }
}
