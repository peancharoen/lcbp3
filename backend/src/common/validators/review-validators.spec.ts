// File: backend/src/common/validators/review-validators.spec.ts
// Change Log:
// - 2026-09-15: Initial creation — unit tests for all exported validator functions

import {
  validateDueDate,
  validateDelegationDateRange,
  validateTaskCompletionRequirements,
  validateVersion,
  validateOverrideReason,
} from './review-validators';

describe('review-validators', () => {
  describe('validateDueDate', () => {
    it('should not throw when due date is in the future', () => {
      const future = new Date(Date.now() + 86_400_000); // +1 day
      expect(() => validateDueDate(future)).not.toThrow();
    });

    it('should throw when due date is in the past', () => {
      const past = new Date(Date.now() - 86_400_000); // -1 day
      expect(() => validateDueDate(past)).toThrow(
        'Due date must be in the future'
      );
    });

    it('should throw when due date is now', () => {
      const now = new Date();
      expect(() => validateDueDate(now)).toThrow(
        'Due date must be in the future'
      );
    });
  });

  describe('validateDelegationDateRange', () => {
    it('should not throw when range is valid and within 90 days', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-02-01');
      expect(() => validateDelegationDateRange(start, end)).not.toThrow();
    });

    it('should throw when end date equals start date', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-01');
      expect(() => validateDelegationDateRange(start, end)).toThrow(
        'End date must be after start date'
      );
    });

    it('should throw when end date is before start date', () => {
      const start = new Date('2026-02-01');
      const end = new Date('2026-01-01');
      expect(() => validateDelegationDateRange(start, end)).toThrow(
        'End date must be after start date'
      );
    });

    it('should throw when delegation period exceeds 90 days', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-04-15'); // >90 days
      expect(() => validateDelegationDateRange(start, end)).toThrow(
        'Delegation period cannot exceed 90 days'
      );
    });

    it('should allow exactly 90 days', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-04-01'); // 90 days
      expect(() => validateDelegationDateRange(start, end)).not.toThrow();
    });
  });

  describe('validateTaskCompletionRequirements', () => {
    it('should not throw when task is COMPLETED with responseCodeId and comments not required', () => {
      expect(() =>
        validateTaskCompletionRequirements('COMPLETED', 1, false, undefined)
      ).not.toThrow();
    });

    it('should not throw when task is COMPLETED with responseCodeId and comments provided', () => {
      expect(() =>
        validateTaskCompletionRequirements('COMPLETED', 1, true, 'Some comment')
      ).not.toThrow();
    });

    it('should throw when task is COMPLETED without responseCodeId', () => {
      expect(() =>
        validateTaskCompletionRequirements(
          'COMPLETED',
          undefined,
          false,
          undefined
        )
      ).toThrow('Response code is required to complete a review task');
    });

    it('should throw when task is COMPLETED with null responseCodeId', () => {
      expect(() =>
        validateTaskCompletionRequirements('COMPLETED', null, false, undefined)
      ).toThrow('Response code is required to complete a review task');
    });

    it('should throw when comments required but not provided', () => {
      expect(() =>
        validateTaskCompletionRequirements('COMPLETED', 1, true, undefined)
      ).toThrow('Comments are required for this response code');
    });

    it('should throw when comments required but empty string', () => {
      expect(() =>
        validateTaskCompletionRequirements('COMPLETED', 1, true, '   ')
      ).toThrow('Comments are required for this response code');
    });

    it('should not throw when task status is not COMPLETED', () => {
      expect(() =>
        validateTaskCompletionRequirements(
          'PENDING',
          undefined,
          true,
          undefined
        )
      ).not.toThrow();
    });
  });

  describe('validateVersion', () => {
    it('should not throw when versions match', () => {
      expect(() => validateVersion(5, 5, 'Correspondence')).not.toThrow();
    });

    it('should throw when versions do not match', () => {
      expect(() => validateVersion(5, 6, 'Correspondence')).toThrow(
        'Optimistic lock conflict on Correspondence: expected version 5, got 6. Please retry.'
      );
    });

    it('should include entity name in error message', () => {
      expect(() => validateVersion(1, 2, 'RFA')).toThrow(
        'Optimistic lock conflict on RFA'
      );
    });
  });

  describe('validateOverrideReason', () => {
    it('should not throw when reason meets default minimum length', () => {
      expect(() =>
        validateOverrideReason('This is a valid override reason')
      ).not.toThrow();
    });

    it('should throw when reason is too short', () => {
      expect(() => validateOverrideReason('short')).toThrow(
        'Override reason must be at least 10 characters'
      );
    });

    it('should throw when reason is empty', () => {
      expect(() => validateOverrideReason('')).toThrow(
        'Override reason must be at least 10 characters'
      );
    });

    it('should throw when reason is only whitespace', () => {
      expect(() => validateOverrideReason('          ')).toThrow(
        'Override reason must be at least 10 characters'
      );
    });

    it('should respect custom minLength parameter', () => {
      expect(() => validateOverrideReason('abc', 5)).toThrow(
        'Override reason must be at least 5 characters'
      );
    });

    it('should allow reason exactly at custom minLength', () => {
      expect(() => validateOverrideReason('abcde', 5)).not.toThrow();
    });
  });
});
