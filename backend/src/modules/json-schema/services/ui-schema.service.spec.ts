// File: src/modules/json-schema/services/ui-schema.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ UiSchemaService

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { UiSchemaService } from './ui-schema.service';
import { UiSchema } from '../interfaces/ui-schema.interface';

// Helper สร้าง UiSchema ที่ valid
const makeValidUiSchema = (): UiSchema => ({
  layout: {
    type: 'stack',
    groups: [
      {
        id: 'g1',
        title: 'General',
        type: 'section',
        fields: ['title', 'status'],
      },
    ],
  },
  fields: {
    title: { type: 'string', title: 'Title', widget: 'text' },
    status: {
      type: 'string',
      title: 'Status',
      widget: 'select',
      enum: ['DRAFT', 'SUBMITTED'],
    },
  },
});

describe('UiSchemaService', () => {
  let service: UiSchemaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UiSchemaService],
    }).compile();
    service = module.get<UiSchemaService>(UiSchemaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUiSchema', () => {
    it('ควรคืน true เมื่อ uiSchema เป็น null/undefined (Optional)', () => {
      expect(service.validateUiSchema(null as any, {})).toBe(true);
    });

    it('ควรคืน true เมื่อ UI Schema ถูกต้อง', () => {
      const result = service.validateUiSchema(makeValidUiSchema(), {
        properties: { title: { type: 'string' }, status: { type: 'string' } },
      });
      expect(result).toBe(true);
    });

    it('ควร throw ValidationException เมื่อขาด layout', () => {
      const badSchema = {
        fields: { title: { type: 'string', title: 'Title' } },
      } as unknown as UiSchema;
      // ValidationException expose เฉพาะ class — เช็ค class instance
      expect(() => service.validateUiSchema(badSchema, {})).toThrow(
        /Validation/
      );
    });

    it('ควร throw ValidationException เมื่อขาด fields', () => {
      const badSchema = {
        layout: { type: 'stack', groups: [] },
      } as unknown as UiSchema;
      expect(() => service.validateUiSchema(badSchema, {})).toThrow(
        /Validation/
      );
    });

    it('ควร throw ValidationException เมื่อ field ใน layout ไม่มีนิยามใน fields', () => {
      const schema: UiSchema = {
        layout: {
          type: 'stack',
          groups: [
            {
              id: 'g1',
              title: 'G',
              type: 'section',
              fields: ['missing_field'],
            },
          ],
        },
        fields: {},
      };
      // ValidationException expose class message — เช็ค class instance
      expect(() => service.validateUiSchema(schema, {})).toThrow(/Validation/);
    });

    it('ควรไม่ throw แม้ dataSchema มี field ที่ไม่มีใน UI Schema (warn เฉยๆ)', () => {
      const result = service.validateUiSchema(makeValidUiSchema(), {
        properties: {
          title: { type: 'string' },
          status: { type: 'string' },
          extra_field_not_in_ui: { type: 'string' }, // ไม่ throw
        },
      });
      expect(result).toBe(true);
    });

    it('ควรคืน true เมื่อ dataSchema ไม่มี properties', () => {
      const result = service.validateUiSchema(makeValidUiSchema(), {});
      expect(result).toBe(true);
    });
  });

  describe('generateDefaultUiSchema', () => {
    it('ควรสร้าง UI Schema พื้นฐานจาก dataSchema', () => {
      const dataSchema = {
        properties: {
          title: { type: 'string', title: 'Document Title' },
          dueDate: { type: 'string', format: 'date' },
          isPublic: { type: 'boolean' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
        },
        required: ['title'],
      };
      const result = service.generateDefaultUiSchema(dataSchema);
      expect(result.layout.groups).toHaveLength(1);
      expect(result.layout.groups[0].title).toBe('General Information');
      expect(Object.keys(result.fields)).toHaveLength(4);
      // Widget guessing
      expect(result.fields['dueDate'].widget).toBe('date');
      expect(result.fields['isPublic'].widget).toBe('checkbox');
      expect(result.fields['priority'].widget).toBe('select');
      expect(result.fields['title'].widget).toBe('text');
    });

    it('ควรกำหนด required=true สำหรับ field ที่อยู่ใน required array', () => {
      const dataSchema = {
        properties: { title: { type: 'string' }, note: { type: 'string' } },
        required: ['title'],
      };
      const result = service.generateDefaultUiSchema(dataSchema);
      expect(result.fields['title'].required).toBe(true);
      expect(result.fields['note'].required).toBe(false);
    });

    it('ควรคืน empty schema เมื่อ dataSchema ไม่มี properties', () => {
      const result = service.generateDefaultUiSchema({});
      expect(result.layout.groups).toHaveLength(0);
      expect(result.fields).toEqual({});
    });

    it('ควรคืน empty schema เมื่อ dataSchema เป็น null/undefined', () => {
      const result = service.generateDefaultUiSchema(null as any);
      expect(result.fields).toEqual({});
    });

    it('ควร guess widget=datetime สำหรับ format=date-time', () => {
      const dataSchema = {
        properties: { createdAt: { type: 'string', format: 'date-time' } },
      };
      const result = service.generateDefaultUiSchema(dataSchema);
      expect(result.fields['createdAt'].widget).toBe('datetime');
    });

    it('ควร guess widget=file-upload สำหรับ format=binary', () => {
      const dataSchema = {
        properties: { attachment: { type: 'string', format: 'binary' } },
      };
      const result = service.generateDefaultUiSchema(dataSchema);
      expect(result.fields['attachment'].widget).toBe('file-upload');
    });

    it('ควร humanize field name สำหรับ camelCase', () => {
      const dataSchema = {
        properties: { documentTitle: { type: 'string' } },
      };
      const result = service.generateDefaultUiSchema(dataSchema);
      // humanize: "documentTitle" → "Document Title"
      expect(result.fields['documentTitle'].title).toBe('Document Title');
    });

    it('ควรใช้ title จาก property ถ้ามี', () => {
      const dataSchema = {
        properties: { myField: { type: 'string', title: 'My Custom Title' } },
      };
      const result = service.generateDefaultUiSchema(dataSchema);
      expect(result.fields['myField'].title).toBe('My Custom Title');
    });

    it('ควรกำหนด colSpan=12 เป็น default', () => {
      const dataSchema = {
        properties: { note: { type: 'string' } },
      };
      const result = service.generateDefaultUiSchema(dataSchema);
      expect(result.fields['note'].colSpan).toBe(12);
    });
  });
});
