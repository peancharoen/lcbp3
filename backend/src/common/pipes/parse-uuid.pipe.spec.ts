import { BadRequestException } from '@nestjs/common';
import { ParseUuidPipe } from './parse-uuid.pipe';

// Mock uuid module to avoid ESM import issue with uuid@13
jest.mock('uuid', () => ({
  validate: (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      str
    ),
  v7: () => '01912345-6789-7abc-8def-0123456789ab',
}));

describe('ParseUuidPipe', () => {
  let pipe: ParseUuidPipe;

  beforeEach(() => {
    pipe = new ParseUuidPipe();
  });

  // ==========================================================
  // Valid UUIDs
  // ==========================================================

  describe('valid UUIDs', () => {
    it('should accept a valid UUIDv4 and return lowercase', () => {
      const uuid = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
      expect(pipe.transform(uuid)).toBe(uuid);
    });

    it('should accept a valid UUIDv7 and return lowercase', () => {
      const uuid = '01912345-6789-7abc-8def-0123456789ab';
      expect(pipe.transform(uuid)).toBe(uuid);
    });

    it('should accept a valid UUIDv1 (MariaDB DEFAULT)', () => {
      const uuid = '550e8400-e29b-11d4-a716-446655440000';
      expect(pipe.transform(uuid)).toBe(uuid);
    });

    it('should normalize uppercase UUID to lowercase', () => {
      const uuid = 'A1B2C3D4-E5F6-4789-ABCD-EF0123456789';
      expect(pipe.transform(uuid)).toBe(uuid.toLowerCase());
    });

    it('should normalize mixed case UUID to lowercase', () => {
      const uuid = 'a1B2c3D4-e5F6-4789-AbCd-eF0123456789';
      expect(pipe.transform(uuid)).toBe(uuid.toLowerCase());
    });
  });

  // ==========================================================
  // Invalid inputs
  // ==========================================================

  describe('invalid inputs', () => {
    it('should throw BadRequestException for empty string', () => {
      expect(() => pipe.transform('')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for random string', () => {
      expect(() => pipe.transform('not-a-uuid')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for numeric string', () => {
      expect(() => pipe.transform('12345')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for UUID without hyphens', () => {
      expect(() => pipe.transform('a1b2c3d4e5f64789abcdef0123456789')).toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException for UUID with extra characters', () => {
      expect(() =>
        pipe.transform('a1b2c3d4-e5f6-4789-abcd-ef0123456789-extra')
      ).toThrow(BadRequestException);
    });

    it('should include the invalid value in error message', () => {
      try {
        pipe.transform('bad-value');
        fail('Should have thrown');
      } catch (error) {
        expect((error as BadRequestException).message).toContain('bad-value');
      }
    });
  });
});
