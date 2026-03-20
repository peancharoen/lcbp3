// Mock uuid module to avoid ESM import issue with uuid@13
jest.mock('uuid', () => ({
  validate: (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      str
    ),
  v7: () => '01912345-6789-7abc-8def-0123456789ab',
}));

import { UuidBaseEntity } from './uuid-base.entity';

// Concrete subclass for testing the abstract base
class TestEntity extends UuidBaseEntity {
  id!: number;
}

describe('UuidBaseEntity', () => {
  // ==========================================================
  // generateUuid() — @BeforeInsert hook
  // ==========================================================

  describe('generateUuid()', () => {
    it('should generate a UUIDv7 when uuid is not set', () => {
      const entity = new TestEntity();
      expect(entity.uuid).toBeUndefined();

      entity.generateUuid();

      expect(entity.uuid).toBe('01912345-6789-7abc-8def-0123456789ab');
    });

    it('should not overwrite an existing uuid', () => {
      const entity = new TestEntity();
      entity.uuid = 'existing-uuid-value-should-be-kept';

      entity.generateUuid();

      expect(entity.uuid).toBe('existing-uuid-value-should-be-kept');
    });

    it('should not overwrite a pre-set UUIDv1 from DB default', () => {
      const entity = new TestEntity();
      entity.uuid = '550e8400-e29b-11d4-a716-446655440000';

      entity.generateUuid();

      expect(entity.uuid).toBe('550e8400-e29b-11d4-a716-446655440000');
    });

    it('should generate uuid when uuid is empty string', () => {
      const entity = new TestEntity();
      entity.uuid = '';

      entity.generateUuid();

      // Empty string is falsy, so generateUuid should assign a new value
      expect(entity.uuid).toBe('01912345-6789-7abc-8def-0123456789ab');
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

    it('should have uuid property accessible from subclass', () => {
      const entity = new TestEntity();
      entity.uuid = 'test-uuid';
      entity.id = 42;

      expect(entity.uuid).toBe('test-uuid');
      expect(entity.id).toBe(42);
    });
  });
});
