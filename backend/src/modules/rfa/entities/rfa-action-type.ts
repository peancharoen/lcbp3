// File: src/modules/rfa/entities/rfa-action-type.ts
// ADR-049: แยก enum ออกจาก rfa-workflow-template-step.entity.ts หลังลบ entity เก่า

export enum RfaActionType {
  REVIEW = 'REVIEW',
  APPROVE = 'APPROVE',
  ACKNOWLEDGE = 'ACKNOWLEDGE',
}
