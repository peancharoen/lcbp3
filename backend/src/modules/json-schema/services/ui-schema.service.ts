// File: src/modules/json-schema/services/ui-schema.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { UiSchema, UiSchemaField } from '../interfaces/ui-schema.interface';

@Injectable()
export class UiSchemaService {
  private readonly logger = new Logger(UiSchemaService.name);

  /**
   * ตรวจสอบความถูกต้องของ UI Schema
   */
  validateUiSchema(uiSchema: UiSchema, dataSchema: any): boolean {
    if (!uiSchema) return true; // Optional field

    // 1. Validate Structure เบื้องต้น
    if (!uiSchema.layout || !uiSchema.fields) {
      throw new BadRequestException(
        'UI Schema must contain "layout" and "fields" properties.',
      );
    }

    // 2. ตรวจสอบว่า Fields ใน Layout มีคำนิยามครบถ้วน
    const definedFields = new Set(Object.keys(uiSchema.fields));
    const layoutFields = new Set<string>();

    uiSchema.layout.groups.forEach((group) => {
      group.fields.forEach((fieldKey) => {
        layoutFields.add(fieldKey);
        if (!definedFields.has(fieldKey)) {
          throw new BadRequestException(
            `Field "${fieldKey}" used in layout "${group.title}" is not defined in "fields".`,
          );
        }
      });
    });

    // 3. (Optional) ตรวจสอบว่า Fields ใน Data Schema (AJV) มีครบใน UI Schema หรือไม่
    // ถ้า Data Schema บอกว่ามี field 'title' แต่ UI Schema ไม่มี -> Frontend อาจจะไม่เรนเดอร์
    if (dataSchema && dataSchema.properties) {
      const dataKeys = Object.keys(dataSchema.properties);
      const missingFields = dataKeys.filter((key) => !definedFields.has(key));

      if (missingFields.length > 0) {
        this.logger.warn(
          `Data schema properties [${missingFields.join(', ')}] are missing from UI Schema.`,
        );
        // ไม่ Throw Error เพราะบางทีเราอาจตั้งใจซ่อน Field (Hidden field)
      }
    }

    return true;
  }

  /**
   * สร้าง UI Schema พื้นฐานจาก Data Schema (AJV) อัตโนมัติ
   * ใช้กรณี user ไม่ได้ส่ง UI Schema มาให้
   */
  generateDefaultUiSchema(dataSchema: any): UiSchema {
    if (!dataSchema || !dataSchema.properties) {
      return {
        layout: { type: 'stack', groups: [] },
        fields: {},
      };
    }

    const fields: { [key: string]: UiSchemaField } = {};
    const groupFields: string[] = [];

    for (const [key, value] of Object.entries<any>(dataSchema.properties)) {
      groupFields.push(key);

      fields[key] = {
        type: value.type || 'string',
        title: value.title || this.humanize(key),
        description: value.description,
        required: (dataSchema.required || []).includes(key),
        widget: this.guessWidget(value),
        colSpan: 12, // Default full width
      };
    }

    return {
      layout: {
        type: 'stack',
        groups: [
          {
            id: 'default',
            title: 'General Information',
            type: 'section',
            fields: groupFields,
          },
        ],
      },
      fields,
    };
  }

  // Helpers
  private humanize(str: string): string {
    return str
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  private guessWidget(schemaProp: any): any {
    if (schemaProp.enum) return 'select';
    if (schemaProp.type === 'boolean') return 'checkbox';
    if (schemaProp.format === 'date') return 'date';
    if (schemaProp.format === 'date-time') return 'datetime';
    if (schemaProp.format === 'binary') return 'file-upload';
    return 'text';
  }
}

