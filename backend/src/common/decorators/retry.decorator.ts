// File: src/common/resilience/decorators/retry.decorator.ts
import retry from 'async-retry'; // ✅ แก้ Import: เปลี่ยนจาก * as retry เป็น default import
import { Logger } from '@nestjs/common';

export interface RetryOptions {
  retries?: number;
  factor?: number;
  minTimeout?: number;
  maxTimeout?: number;
  onRetry?: (e: Error, attempt: number) => any;
}

/**
 * Decorator สำหรับการ Retry Function เมื่อเกิด Error
 * ใช้สำหรับ External Call ที่อาจมีปัญหา Network ชั่วคราว
 */
export function Retry(options: RetryOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const logger = new Logger('RetryDecorator');

    descriptor.value = async function (...args: any[]) {
      return retry(
        // ✅ ระบุ Type ให้กับ bail และ attempt เพื่อแก้ Implicit any
        async (bail: (e: Error) => void, attempt: number) => {
          try {
            return await originalMethod.apply(this, args);
          } catch (error) {
            // ✅ Cast error เป็น Error Object เพื่อแก้ปัญหา 'unknown'
            const err = error as Error;

            if (options.onRetry) {
              options.onRetry(err, attempt);
            }

            logger.warn(
              `Attempt ${attempt} failed for ${propertyKey}. Error: ${err.message}`, // ✅ ใช้ err.message
            );

            // ถ้าต้องการให้หยุด Retry ทันทีในบางเงื่อนไข สามารถเรียก bail(err) ได้ที่นี่
            throw err;
          }
        },
        {
          retries: options.retries || 3,
          factor: options.factor || 2,
          minTimeout: options.minTimeout || 1000,
          maxTimeout: options.maxTimeout || 5000,
          ...options,
        },
      );
    };

    return descriptor;
  };
}
