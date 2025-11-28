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
  encryptFields(data: any, schemaDefinition: any): any {
    if (!data || typeof data !== 'object') return data;
    const processed = Array.isArray(data) ? [...data] : { ...data };

    // Traverse schema properties
    if (schemaDefinition.properties) {
      for (const [key, propSchema] of Object.entries<any>(
        schemaDefinition.properties,
      )) {
        if (data[key] !== undefined) {
          // 1. Check encryption flag
          if (propSchema['x-encrypt'] === true) {
            processed[key] = this.cryptoService.encrypt(data[key]);
          }

          // 2. Recursive for nested objects/arrays
          if (propSchema.type === 'object' && propSchema.properties) {
            processed[key] = this.encryptFields(data[key], propSchema);
          } else if (propSchema.type === 'array' && propSchema.items) {
            if (Array.isArray(data[key])) {
              processed[key] = data[key].map((item: any) =>
                this.encryptFields(item, propSchema.items),
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
    data: any,
    schemaDefinition: any,
    context: SecurityContext,
  ): any {
    if (!data || typeof data !== 'object') return data;

    // Clone data to avoid mutation
    const processed = Array.isArray(data) ? [...data] : { ...data };

    if (schemaDefinition.properties) {
      for (const [key, propSchema] of Object.entries<any>(
        schemaDefinition.properties,
      )) {
        if (data[key] !== undefined) {
          // 1. Decrypt (ถ้ามีค่าและถูกเข้ารหัสไว้)
          if (propSchema['x-encrypt'] === true) {
            processed[key] = this.cryptoService.decrypt(data[key]);
          }

          // 2. Security Check (Role-based Access Control)
          if (propSchema['x-security']) {
            const rule = propSchema['x-security'];
            const requiredRoles = rule.roles || [];
            const hasPermission = requiredRoles.some(
              (role: string) =>
                context.userRoles.includes(role) ||
                context.userRoles.includes('SUPERADMIN'),
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
                processed[key],
                propSchema,
                context,
              );
            } else if (propSchema.type === 'array' && propSchema.items) {
              if (Array.isArray(processed[key])) {
                processed[key] = processed[key].map((item: any) =>
                  this.decryptAndFilterFields(item, propSchema.items, context),
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
