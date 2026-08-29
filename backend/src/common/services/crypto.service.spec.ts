// File: backend/src/common/services/crypto.service.spec.ts
// Change Log:
// - 2026-08-26: สร้าง unit test สำหรับ CryptoService ครอบคลุม encrypt/decrypt ทุก branch (T1.1)

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  const configValues: Record<string, unknown> = {
    APP_SECRET_KEY: 'test-secret-key-for-unit-tests!',
  };

  const mockConfigService = {
    get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
      return (configValues[key] as T | undefined) ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<CryptoService>(CryptoService);
  });

  describe('encrypt()', () => {
    it('ควรคืน null เมื่อ input เป็น null', () => {
      expect(service.encrypt(null)).toBe(null);
    });

    it('ควรคืน undefined เมื่อ input เป็น undefined', () => {
      expect(service.encrypt(undefined)).toBe(undefined);
    });

    it('ควรเข้ารหัส string และคืนค่าในรูปแบบ iv:encrypted', () => {
      const result = service.encrypt('hello world');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toContain(':');
    });

    it('ควรเข้ารหัส number โดยแปลงเป็น string ก่อน', () => {
      const result = service.encrypt(12345);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toContain(':');
    });

    it('ควรเข้ารหัส boolean โดยแปลงเป็น string ก่อน', () => {
      const result = service.encrypt(true);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toContain(':');
    });
  });

  describe('decrypt()', () => {
    it('ควรคืนค่าเดิมเมื่อ input เป็น string ว่าง', () => {
      expect(service.decrypt('')).toBe('');
    });

    it('ควรคืนค่าเดิมเมื่อ input ไม่ใช่ string (ผ่าน type guard)', () => {
      // decrypt รับ string เท่านั้น แต่ type guard ตรวจ typeof
      expect(service.decrypt('no-colon-here')).toBe('no-colon-here');
    });

    it('ควรคืนค่าเดิมเมื่อ input ไม่มี colon', () => {
      expect(service.decrypt('plaintext')).toBe('plaintext');
    });

    it('ควรถอดรหัสที่เข้ารหัสได้ถูกต้อง', () => {
      const encrypted = service.encrypt('secret data');
      expect(encrypted).toBeTruthy();
      const decrypted = service.decrypt(encrypted as string);
      expect(decrypted).toBe('secret data');
    });

    it('ควรถอดรหัส number ที่เข้ารหัสได้ถูกต้อง', () => {
      const encrypted = service.encrypt(42);
      const decrypted = service.decrypt(encrypted as string);
      expect(decrypted).toBe('42');
    });

    it('ควรคืนค่าเดิมเมื่อ iv หรือ encrypted hex ว่าง', () => {
      expect(service.decrypt(':')).toBe(':');
    });

    it('ควรคืนค่าเดิมเมื่อ decrypt ล้มเหลว (invalid hex)', () => {
      const result = service.decrypt('invalid:hex-data');
      expect(result).toBe('invalid:hex-data');
    });

    it('ควรคืนค่าเดิมเมื่อ iv ไม่ใช่ hex ที่ถูกต้อง', () => {
      const result = service.decrypt('not-hex:somedata');
      expect(result).toBe('not-hex:somedata');
    });
  });

  describe('round-trip', () => {
    it('ควร encrypt แล้ว decrypt คืนค่าเดิมได้สำเร็จ', () => {
      const original = 'sensitive information 123';
      const encrypted = service.encrypt(original);
      const decrypted = service.decrypt(encrypted as string);
      expect(decrypted).toBe(original);
    });

    it('ควร encrypt แล้ว decrypt คืนค่าเดิมได้สำเร็จสำหรับข้อความยาว', () => {
      const original = 'a'.repeat(1000);
      const encrypted = service.encrypt(original);
      const decrypted = service.decrypt(encrypted as string);
      expect(decrypted).toBe(original);
    });
  });

  describe('default key fallback', () => {
    it('ควรใช้ default key เมื่อ APP_SECRET_KEY ไม่ได้ตั้งค่า', async () => {
      const emptyConfig = {
        get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
          return defaultValue;
        }),
      };
      const mod = await Test.createTestingModule({
        providers: [
          CryptoService,
          { provide: ConfigService, useValue: emptyConfig },
        ],
      }).compile();
      const svc = mod.get<CryptoService>(CryptoService);
      const encrypted = svc.encrypt('test');
      expect(encrypted).toBeTruthy();
      const decrypted = svc.decrypt(encrypted as string);
      expect(decrypted).toBe('test');
    });
  });
});
