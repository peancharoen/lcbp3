// File: src/common/resilience/decorators/circuit-breaker.decorator.ts
import CircuitBreaker from 'opossum'; // ✅ เปลี่ยนเป็น Default Import (ถ้าลง @types/opossum แล้วจะผ่าน)
import { Logger } from '@nestjs/common';

export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  fallback?: (...args: any[]) => any;
}

/**
 * Decorator สำหรับ Circuit Breaker
 * ใช้ป้องกัน System Overload เมื่อ External Service ล่ม
 */
export function UseCircuitBreaker(options: CircuitBreakerOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const logger = new Logger('CircuitBreakerDecorator');

    // สร้าง Opossum Circuit Breaker Instance
    const breaker = new CircuitBreaker(originalMethod, {
      timeout: options.timeout || 3000,
      errorThresholdPercentage: options.errorThresholdPercentage || 50,
      resetTimeout: options.resetTimeout || 10000,
    });

    breaker.on('open', () => logger.warn(`Circuit OPEN for ${propertyKey}`));
    breaker.on('halfOpen', () =>
      logger.log(`Circuit HALF-OPEN for ${propertyKey}`),
    );
    breaker.on('close', () => logger.log(`Circuit CLOSED for ${propertyKey}`));

    if (options.fallback) {
      breaker.fallback(options.fallback);
    }

    descriptor.value = async function (...args: any[]) {
      // ✅ ใช้ .fire โดยส่ง this context ให้ถูกต้อง
      return breaker.fire.apply(breaker, [this, ...args]);
    };

    return descriptor;
  };
}
