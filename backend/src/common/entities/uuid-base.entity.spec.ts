// Mock uuid module to avoid ESM import issue with uuid@13
jest.mock('uuid', () => ({
  validate: (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),
  v7: () => '01912345-6789-7abc-8def-0123456789ab',
}));

import { UuidBaseEntity } from './uuid-base.entity';

// Concrete subclass for testing the abstract base
class TestEntity extends UuidBaseEntity {
  id!: number;
}

describe('UuidBaseEntity', () => {
  // ==========================================================
  // generatePublicId() — @BeforeInsert hook
  // ==========================================================

  describe('generatePublicId()', () => {
    it('should generate a UUIDv7 when publicId is not set', () => {
      const entity = new TestEntity();
      expect(entity.publicId).toBeUndefined();

      entity.generatePublicId();

      expect(entity.publicId).toBe('01912345-6789-7abc-8def-0123456789ab');
    });

    it('should not overwrite an existing publicId', () => {
      const entity = new TestEntity();
      entity.publicId = 'existing-publicId-value-should-be-kept';

      entity.generatePublicId();

      expect(entity.publicId).toBe('existing-publicId-value-should-be-kept');
    });

    it('should not overwrite a pre-set UUIDv1 from DB default', () => {
      const entity = new TestEntity();
      entity.publicId = '550e8400-e29b-11d4-a716-446655440000';

      entity.generatePublicId();

      expect(entity.publicId).toBe('550e8400-e29b-11d4-a716-446655440000');
    });

    it('should generate publicId when publicId is empty string', () => {
      const entity = new TestEntity();
      entity.publicId = '';

      entity.generatePublicId();

      // Empty string is falsy, so generatePublicId should assign a new value
      expect(entity.publicId).toBe('01912345-6789-7abc-8def-0123456789ab');
    });
  });

  // ==========================================================
  // Inheritance
  // ==========================================================

  describe('inheritance', () => {
    it('should be an instance of UuidBaseEntity', () => {
      const entity = new TestEntity();
      expect(entity).toBeInstanceOf(UuidBaseEntity);
    });

    it('should have publicId property accessible from subclass', () => {
      const entity = new TestEntity();
      entity.publicId = 'test-publicId';
      entity.id = 42;

      expect(entity.publicId).toBe('test-publicId');
      expect(entity.id).toBe(42);
    });
  });
});
