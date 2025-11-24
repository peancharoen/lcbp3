// File: src/common/services/request-context.service.ts
// บันทึกการแก้ไข: เก็บ Context ระหว่าง Request (User, TraceID) (T1.1)

import { Injectable, Scope } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable({ scope: Scope.DEFAULT })
export class RequestContextService {
  private static readonly cls = new AsyncLocalStorage<Map<string, any>>();

  static run(fn: () => void) {
    this.cls.run(new Map(), fn);
  }

  static set(key: string, value: any) {
    const store = this.cls.getStore();
    if (store) {
      store.set(key, value);
    }
  }

  static get<T>(key: string): T | undefined {
    const store = this.cls.getStore();
    return store?.get(key);
  }

  // Helper methods
  static get currentUserId(): number | null {
    return this.get('user_id') || null;
  }

  static get requestId(): string | null {
    return this.get('request_id') || null;
  }
}
