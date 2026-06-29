import { assertUuid } from './uuid-guard';

describe('assertUuid', () => {
  // ==========================================================
  // Valid UUIDs (should pass)
  // ==========================================================
  describe('valid UUIDs', () => {
    it('should accept valid UUIDv7 format (lowercase)', () => {
      const uuid = '019505a1-7c3e-7000-8000-abc123def456';
      expect(assertUuid(uuid)).toBe(uuid);
    });

    it('should accept valid UUIDv7 format (uppercase)', () => {
      const uuid = '019505A1-7C3E-7000-8000-ABC123DEF456';
      expect(assertUuid(uuid)).toBe(uuid);
    });

    it('should accept valid UUIDv7 format (mixed case)', () => {
      const uuid = '019505a1-7C3E-7000-8000-aBc123DeF456';
      expect(assertUuid(uuid)).toBe(uuid);
    });

    it('should accept valid UUIDv4 format', () => {
      const uuid = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
      expect(assertUuid(uuid)).toBe(uuid);
    });

    it('should accept valid UUIDv1 format (MariaDB native)', () => {
      const uuid = '550e8400-e29b-11d4-a716-446655440000';
      expect(assertUuid(uuid)).toBe(uuid);
    });

    it('should accept UUID with all zeros', () => {
      const uuid = '00000000-0000-0000-0000-000000000000';
      expect(assertUuid(uuid)).toBe(uuid);
    });

    it('should accept UUID with all Fs', () => {
      const uuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      expect(assertUuid(uuid)).toBe(uuid);
    });
  });

  // ==========================================================
  // Invalid UUIDs (should throw)
  // ==========================================================
  describe('invalid UUIDs', () => {
    it('should throw for empty string', () => {
      expect(() => assertUuid('')).toThrow('Invalid UUID format: ');
    });

    it('should throw for null (as string)', () => {
      expect(() => assertUuid('null')).toThrow('Invalid UUID format: null');
    });

    it('should throw for undefined (as string)', () => {
      expect(() => assertUuid('undefined')).toThrow(
        'Invalid UUID format: undefined'
      );
    });

    it('should throw for numeric string', () => {
      expect(() => assertUuid('12345')).toThrow('Invalid UUID format: 12345');
    });

    it('should throw for string without hyphens', () => {
      expect(() => assertUuid('019505a17c3e70008000abc123def456')).toThrow(
        'Invalid UUID format: 019505a17c3e70008000abc123def456'
      );
    });

    it('should throw for UUID with missing segments', () => {
      expect(() => assertUuid('019505a1-7c3e-7000-8000')).toThrow(
        'Invalid UUID format: 019505a1-7c3e-7000-8000'
      );
    });

    it('should throw for UUID with extra segments', () => {
      expect(() =>
        assertUuid('019505a1-7c3e-7000-8000-abc123def456-extra')
      ).toThrow(
        'Invalid UUID format: 019505a1-7c3e-7000-8000-abc123def456-extra'
      );
    });

    it('should throw for UUID with invalid characters', () => {
      expect(() => assertUuid('019505a1-7c3e-7000-8000-abc123def45g')).toThrow(
        'Invalid UUID format: 019505a1-7c3e-7000-8000-abc123def45g'
      );
    });

    it('should throw for UUID with special characters', () => {
      expect(() => assertUuid('019505a1-7c3e-7000-8000-abc123def45!')).toThrow(
        'Invalid UUID format: 019505a1-7c3e-7000-8000-abc123def45!'
      );
    });

    it('should throw for whitespace-only string', () => {
      expect(() => assertUuid('   ')).toThrow('Invalid UUID format:    ');
    });

    it('should throw for UUID with leading whitespace', () => {
      expect(() => assertUuid(' 019505a1-7c3e-7000-8000-abc123def456')).toThrow(
        'Invalid UUID format:  019505a1-7c3e-7000-8000-abc123def456'
      );
    });

    it('should throw for UUID with trailing whitespace', () => {
      expect(() => assertUuid('019505a1-7c3e-7000-8000-abc123def456 ')).toThrow(
        'Invalid UUID format: 019505a1-7c3e-7000-8000-abc123def456 '
      );
    });

    it('should throw for random text', () => {
      expect(() => assertUuid('not-a-valid-uuid-string')).toThrow(
        'Invalid UUID format: not-a-valid-uuid-string'
      );
    });
  });

  // ==========================================================
  // ADR-019 Compliance Tests
  // ==========================================================
  describe('ADR-019 UUID compliance', () => {
    it('should NOT use parseInt on UUID (would cause incorrect behavior)', () => {
      const uuid = '019505a1-7c3e-7000-8000-abc123def456';
      // ADR-019: UUID must be validated as string — parseInt('019505a1-...') yields 19505 (WRONG)
      // assertUuid enforces string-based UUID validation, preventing this data corruption
      expect(() => assertUuid(uuid)).not.toThrow();
    });

    it('should validate UUID as string, not numeric', () => {
      // UUIDs that look like numbers should still be validated as strings
      const numericLikeUuid = '12345678-1234-1234-1234-123456789abc';
      expect(() => assertUuid(numericLikeUuid)).not.toThrow();
    });

    it('should return the original UUID string when valid', () => {
      const uuid = '019505a1-7c3e-7000-8000-abc123def456';
      const result = assertUuid(uuid);
      expect(result).toBe(uuid);
      expect(typeof result).toBe('string');
    });
  });
});
