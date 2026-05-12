// File: src/common/validators/review-validators.ts
// Edge case validators สำหรับ RFA Review workflow (T073)

/**
 * ตรวจสอบว่า due date ถูกต้อง (ต้องอยู่ในอนาคต)
 */
export function validateDueDate(dueDate: Date): void {
  const now = new Date();
  if (dueDate <= now) {
    throw new Error('Due date must be in the future');
  }
}

/**
 * ตรวจสอบ delegation date range ไม่เกิน 90 วัน
 */
export function validateDelegationDateRange(startDate: Date, endDate: Date): void {
  if (endDate <= startDate) {
    throw new Error('End date must be after start date');
  }

  const maxDays = 90;
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays > maxDays) {
    throw new Error(`Delegation period cannot exceed ${maxDays} days`);
  }
}

/**
 * ตรวจสอบ ReviewTask ว่าสามารถ complete ได้ (ต้องมี response code)
 */
export function validateTaskCompletionRequirements(
  taskStatus: string,
  responseCodeId: number | undefined | null,
  requiresComments: boolean,
  comments: string | undefined | null,
): void {
  if (taskStatus === 'COMPLETED') {
    if (!responseCodeId) {
      throw new Error('Response code is required to complete a review task');
    }

    if (requiresComments && (!comments || comments.trim().length === 0)) {
      throw new Error('Comments are required for this response code');
    }
  }
}

/**
 * ตรวจสอบ version สำหรับ optimistic locking (ADR-002)
 */
export function validateVersion(
  expectedVersion: number,
  actualVersion: number,
  entityName: string,
): void {
  if (actualVersion !== expectedVersion) {
    throw new Error(
      `Optimistic lock conflict on ${entityName}: expected version ${expectedVersion}, got ${actualVersion}. Please retry.`,
    );
  }
}

/**
 * ตรวจสอบว่า override reason มีความยาวเพียงพอ
 */
export function validateOverrideReason(reason: string, minLength = 10): void {
  if (!reason || reason.trim().length < minLength) {
    throw new Error(`Override reason must be at least ${minLength} characters`);
  }
}
