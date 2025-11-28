// File: src/modules/json-schema/interfaces/validation-result.interface.ts

export interface ValidationOptions {
  /**
   * ลบ field ที่ไม่ได้ระบุใน Schema ออกอัตโนมัติหรือไม่
   * Default: true
   */
  removeAdditional?: boolean;

  /**
   * แปลงชนิดข้อมูลอัตโนมัติถ้าเป็นไปได้ (เช่น "123" -> 123)
   * Default: true
   */
  coerceTypes?: boolean;

  /**
   * ใช้ค่า Default จาก Schema ถ้าข้อมูลไม่ถูกส่งมา
   * Default: true
   */
  useDefaults?: boolean;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrorDetail[];
  sanitizedData: any;
}

