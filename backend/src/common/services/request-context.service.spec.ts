// File: backend/src/common/services/request-context.service.spec.ts
// Change Log:
// - 2026-08-26: สร้าง unit test สำหรับ RequestContextService ครอบคลุม run/set/get/currentUserId/requestId (T1.1)

import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  it('ควรสร้าง instance ได้', () => {
    expect(new RequestContextService()).toBeDefined();
  });

  describe('run() + set() + get()', () => {
    it('ควร set และ get ค่าภายใน context ของ run ได้', () => {
      RequestContextService.run(() => {
        RequestContextService.set('test_key', 'test_value');
        expect(RequestContextService.get<string>('test_key')).toBe(
          'test_value'
        );
      });
    });

    it('ควรคืน undefined เมื่อ get นอก context (ไม่มี store)', () => {
      expect(RequestContextService.get<string>('nonexistent')).toBeUndefined();
    });

    it('ควรไม่ set ค่าเมื่อไม่มี store (นอก run)', () => {
      // ไม่ควร throw เมื่อ set นอก context
      expect(() => {
        RequestContextService.set('key', 'value');
      }).not.toThrow();
    });
  });

  describe('currentUserId', () => {
    it('ควรคืน user_id ที่ set ไว้ใน context', () => {
      RequestContextService.run(() => {
        RequestContextService.set('user_id', 42);
        expect(RequestContextService.currentUserId).toBe(42);
      });
    });

    it('ควรคืน null เมื่อไม่ได้ set user_id', () => {
      RequestContextService.run(() => {
        expect(RequestContextService.currentUserId).toBeNull();
      });
    });

    it('ควรคืน null เมื่อนอก context', () => {
      expect(RequestContextService.currentUserId).toBeNull();
    });
  });

  describe('requestId', () => {
    it('ควรคืน request_id ที่ set ไว้ใน context', () => {
      RequestContextService.run(() => {
        RequestContextService.set('request_id', 'req-abc-123');
        expect(RequestContextService.requestId).toBe('req-abc-123');
      });
    });

    it('ควรคืน null เมื่อไม่ได้ set request_id', () => {
      RequestContextService.run(() => {
        expect(RequestContextService.requestId).toBeNull();
      });
    });

    it('ควรคืน null เมื่อนอก context', () => {
      expect(RequestContextService.requestId).toBeNull();
    });
  });

  describe('isolation ระหว่าง context', () => {
    it('context แยกกัน ไม่แชร์ข้อมูล', () => {
      RequestContextService.run(() => {
        RequestContextService.set('shared', 'first');
      });
      RequestContextService.run(() => {
        expect(RequestContextService.get<string>('shared')).toBeUndefined();
        RequestContextService.set('shared', 'second');
        expect(RequestContextService.get<string>('shared')).toBe('second');
      });
    });
  });
});
