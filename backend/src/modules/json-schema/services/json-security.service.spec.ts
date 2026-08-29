// File: backend/src/modules/json-schema/services/json-security.service.spec.ts
// Change Log:
// - 2026-06-15: Initial creation — ครอบคลุม encrypt/decrypt/filter/recursion/array branches

import { JsonSecurityService } from './json-security.service';
import { CryptoService } from '../../../common/services/crypto.service';

describe('JsonSecurityService', () => {
  let service: JsonSecurityService;
  let cryptoService: jest.Mocked<CryptoService>;

  beforeEach(() => {
    cryptoService = {
      encrypt: jest.fn((v: string | number | boolean) => `enc:${String(v)}`),
      decrypt: jest.fn((v: string) => v.replace(/^enc:/, '')),
    } as unknown as jest.Mocked<CryptoService>;

    service = new JsonSecurityService(cryptoService);
  });

  // ==========================================================
  // encryptFields
  // ==========================================================
  describe('encryptFields', () => {
    it('should return data as-is when data is not an object', () => {
      const result = service.encryptFields(
        null as unknown as Record<string, unknown>,
        {}
      );
      expect(result).toBeNull();
    });

    it('should return data as-is when schema has no properties', () => {
      const data = { name: 'test' };
      const result = service.encryptFields(data, {});
      expect(result).toEqual(data);
    });

    it('should encrypt fields marked with x-encrypt', () => {
      const data = { ssn: '123-45-6789', name: 'John' };
      const schema = {
        properties: {
          ssn: { 'x-encrypt': true, type: 'string' },
          name: { type: 'string' },
        },
      };
      const result = service.encryptFields(data, schema);
      expect(result.ssn).toBe('enc:123-45-6789');
      expect(result.name).toBe('John');
      expect(cryptoService.encrypt).toHaveBeenCalledWith('123-45-6789');
    });

    it('should skip fields not present in data', () => {
      const data = { name: 'John' };
      const schema = {
        properties: {
          ssn: { 'x-encrypt': true, type: 'string' },
          name: { type: 'string' },
        },
      };
      const result = service.encryptFields(data, schema);
      expect(result.ssn).toBeUndefined();
      expect(cryptoService.encrypt).not.toHaveBeenCalled();
    });

    it('should recurse into nested objects', () => {
      const data = {
        profile: { ssn: '111-22-3333', name: 'Jane' },
      };
      const schema = {
        properties: {
          profile: {
            type: 'object',
            properties: {
              ssn: { 'x-encrypt': true, type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      };
      const result = service.encryptFields(data, schema);
      expect((result.profile as Record<string, unknown>).ssn).toBe(
        'enc:111-22-3333'
      );
    });

    it('should recurse into arrays of objects', () => {
      const data = {
        items: [
          { code: 'A', secret: 's1' },
          { code: 'B', secret: 's2' },
        ],
      };
      const schema = {
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                secret: { 'x-encrypt': true, type: 'string' },
              },
            },
          },
        },
      };
      const result = service.encryptFields(data, schema);
      const items = result.items as Record<string, unknown>[];
      expect(items[0].secret).toBe('enc:s1');
      expect(items[1].secret).toBe('enc:s2');
    });

    it('should skip array recursion when data is not an array', () => {
      const data = { items: 'not-an-array' };
      const schema = {
        properties: {
          items: {
            type: 'array',
            items: { type: 'object', properties: {} },
          },
        },
      };
      const result = service.encryptFields(data, schema);
      expect(result.items).toBe('not-an-array');
    });
  });

  // ==========================================================
  // decryptAndFilterFields
  // ==========================================================
  describe('decryptAndFilterFields', () => {
    it('should return data as-is when data is not an object', () => {
      const result = service.decryptAndFilterFields(
        null as unknown as Record<string, unknown>,
        {},
        { userRoles: ['viewer'] }
      );
      expect(result).toBeNull();
    });

    it('should decrypt fields marked with x-encrypt', () => {
      const data = { ssn: 'enc:123-45-6789', name: 'John' };
      const schema = {
        properties: {
          ssn: { 'x-encrypt': true, type: 'string' },
          name: { type: 'string' },
        },
      };
      const result = service.decryptAndFilterFields(data, schema, {
        userRoles: ['viewer'],
      });
      expect(result.ssn).toBe('123-45-6789');
      expect(cryptoService.decrypt).toHaveBeenCalledWith('enc:123-45-6789');
    });

    it('should REMOVE fields when user lacks required roles and onDeny=REMOVE', () => {
      const data = { salary: 50000, name: 'John' };
      const schema = {
        properties: {
          salary: {
            'x-security': { roles: ['EDITOR'], onDeny: 'REMOVE' },
            type: 'number',
          },
          name: { type: 'string' },
        },
      };
      const result = service.decryptAndFilterFields(data, schema, {
        userRoles: ['viewer'],
      });
      expect(result.salary).toBeUndefined();
      expect(result.name).toBe('John');
    });

    it('should MASK fields when user lacks required roles and onDeny is not REMOVE', () => {
      const data = { salary: 50000, name: 'John' };
      const schema = {
        properties: {
          salary: {
            'x-security': { roles: ['EDITOR'] },
            type: 'number',
          },
          name: { type: 'string' },
        },
      };
      const result = service.decryptAndFilterFields(data, schema, {
        userRoles: ['viewer'],
      });
      expect(result.salary).toBe('********');
    });

    it('should allow access when user has SUPERADMIN role', () => {
      const data = { salary: 50000, name: 'John' };
      const schema = {
        properties: {
          salary: {
            'x-security': { roles: ['EDITOR'] },
            type: 'number',
          },
          name: { type: 'string' },
        },
      };
      const result = service.decryptAndFilterFields(data, schema, {
        userRoles: ['SUPERADMIN'],
      });
      expect(result.salary).toBe(50000);
    });

    it('should allow access when user has one of the required roles', () => {
      const data = { salary: 50000 };
      const schema = {
        properties: {
          salary: {
            'x-security': { roles: ['EDITOR', 'MANAGER'] },
            type: 'number',
          },
        },
      };
      const result = service.decryptAndFilterFields(data, schema, {
        userRoles: ['MANAGER'],
      });
      expect(result.salary).toBe(50000);
    });

    it('should handle x-security with empty roles array (allow all)', () => {
      const data = { salary: 50000 };
      const schema = {
        properties: {
          salary: {
            'x-security': { roles: [] },
            type: 'number',
          },
        },
      };
      const result = service.decryptAndFilterFields(data, schema, {
        userRoles: ['viewer'],
      });
      // Empty roles → some() returns false → MASK
      expect(result.salary).toBe('********');
    });

    it('should recurse into nested objects after security check', () => {
      const data = {
        profile: { ssn: 'enc:111-22-3333', name: 'Jane' },
      };
      const schema = {
        properties: {
          profile: {
            type: 'object',
            properties: {
              ssn: { 'x-encrypt': true, type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      };
      const result = service.decryptAndFilterFields(data, schema, {
        userRoles: ['viewer'],
      });
      expect((result.profile as Record<string, unknown>).ssn).toBe(
        '111-22-3333'
      );
    });

    it('should recurse into arrays after security check', () => {
      const data = {
        items: [
          { secret: 'enc:s1', code: 'A' },
          { secret: 'enc:s2', code: 'B' },
        ],
      };
      const schema = {
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                secret: { 'x-encrypt': true, type: 'string' },
                code: { type: 'string' },
              },
            },
          },
        },
      };
      const result = service.decryptAndFilterFields(data, schema, {
        userRoles: ['viewer'],
      });
      const items = result.items as Record<string, unknown>[];
      expect(items[0].secret).toBe('s1');
      expect(items[1].secret).toBe('s2');
    });

    it('should skip array recursion when value is not an array', () => {
      const data = { items: 'not-an-array' };
      const schema = {
        properties: {
          items: {
            type: 'array',
            items: { type: 'object', properties: {} },
          },
        },
      };
      const result = service.decryptAndFilterFields(data, schema, {
        userRoles: ['viewer'],
      });
      expect(result.items).toBe('not-an-array');
    });

    it('should skip fields not present in data', () => {
      const data = { name: 'John' };
      const schema = {
        properties: {
          ssn: { 'x-encrypt': true, type: 'string' },
          name: { type: 'string' },
        },
      };
      const result = service.decryptAndFilterFields(data, schema, {
        userRoles: ['viewer'],
      });
      expect(result.ssn).toBeUndefined();
      expect(cryptoService.decrypt).not.toHaveBeenCalled();
    });
  });
});
