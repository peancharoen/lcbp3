// File: src/modules/json-schema/services/json-security.service.ts
import { Injectable } from '@nestjs/common';
import { CryptoService } from '../../../common/services/crypto.service';

export interface SecurityContext {
  userRoles: string[]; // Role ของ user ปัจจุบัน (เช่น ['EDITOR', 'viewer'])
}

@Injectable()
export class JsonSecurityService {
  constructor(private readonly cryptoService: CryptoService) {}

  /**
   * ขาเข้า (Write): เข้ารหัสข้อมูล Sensitive ก่อนบันทึก
   */
  encryptFields(
    data: Record<string, unknown>,
    schemaDefinition: Record<string, unknown>
  ): Record<string, unknown> {
    if (!data || typeof data !== 'object') return data;
    const processed: Record<string, unknown> = { ...data };

    // Traverse schema properties
    const properties = schemaDefinition.properties as
      | Record<string, Record<string, unknown>>
      | undefined;
    if (properties) {
      for (const [key, propSchema] of Object.entries(properties)) {
        if (data[key] !== undefined) {
          // 1. Check encryption flag
          if (propSchema['x-encrypt'] === true) {
            processed[key] = this.cryptoService.encrypt(
              data[key] as string | number | boolean
            );
          }

          // 2. Recursive for nested objects/arrays
          if (propSchema.type === 'object' && propSchema.properties) {
            processed[key] = this.encryptFields(
              data[key] as Record<string, unknown>,
              propSchema
            );
          } else if (propSchema.type === 'array' && propSchema.items) {
            if (Array.isArray(data[key])) {
              processed[key] = (data[key] as Record<string, unknown>[]).map(
                (item) =>
                  this.encryptFields(
                    item,
                    propSchema.items as Record<string, unknown>
                  )
              );
            }
          }
        }
      }
    }
    return processed;
  }

  /**
   * ขาออก (Read): ถอดรหัส และ กรองข้อมูลตามสิทธิ์
   */
  decryptAndFilterFields(
    data: Record<string, unknown>,
    schemaDefinition: Record<string, unknown>,
    context: SecurityContext
  ): Record<string, unknown> {
    if (!data || typeof data !== 'object') return data;

    // Clone data to avoid mutation
    const processed: Record<string, unknown> = { ...data };

    const properties = schemaDefinition.properties as
      | Record<string, Record<string, unknown>>
      | undefined;
    if (properties) {
      for (const [key, propSchema] of Object.entries(properties)) {
        if (data[key] !== undefined) {
          // 1. Decrypt (ถ้ามีค่าและถูกเข้ารหัสไว้)
          if (propSchema['x-encrypt'] === true) {
            processed[key] = this.cryptoService.decrypt(data[key] as string);
          }

          // 2. Security Check (Role-based Access Control)
          if (propSchema['x-security']) {
            const rule = propSchema['x-security'] as Record<string, unknown>;
            const requiredRoles = (rule.roles as string[]) || [];
            const hasPermission = requiredRoles.some(
              (role: string) =>
                context.userRoles.includes(role) ||
                context.userRoles.includes('SUPERADMIN')
            );

            if (!hasPermission) {
              if (rule.onDeny === 'REMOVE') {
                delete processed[key];
                continue; // ข้ามไป field ถัดไป
              } else {
                // Default: MASK
                processed[key] = '********';
              }
            }
          }

          // 3. Recursive for nested objects/arrays
          // (ทำต่อเมื่อ Field ยังไม่ถูกลบ)
          if (processed[key] !== undefined) {
            if (propSchema.type === 'object' && propSchema.properties) {
              processed[key] = this.decryptAndFilterFields(
                processed[key] as Record<string, unknown>,
                propSchema,
                context
              );
            } else if (propSchema.type === 'array' && propSchema.items) {
              if (Array.isArray(processed[key])) {
                processed[key] = (
                  processed[key] as Record<string, unknown>[]
                ).map((item) =>
                  this.decryptAndFilterFields(
                    item,
                    propSchema.items as Record<string, unknown>,
                    context
                  )
                );
              }
            }
          }
        }
      }
    }
    return processed;
  }
}
