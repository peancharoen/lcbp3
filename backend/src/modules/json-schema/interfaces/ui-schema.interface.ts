// File: src/modules/json-schema/interfaces/ui-schema.interface.ts

export type WidgetType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'datetime'
  | 'file-upload'
  | 'document-ref'; // Custom widget สำหรับอ้างอิงเอกสารอื่น

export type Operator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'greaterThan'
  | 'lessThan'
  | 'in';

export interface FieldCondition {
  field: string;
  operator: Operator;
  value: any;
}

export interface FieldDependency {
  condition: FieldCondition;
  actions: {
    visibility?: boolean; // true = show, false = hide
    required?: boolean;
    disabled?: boolean;
    filterOptions?: Record<string, any>; // เช่น กรอง Dropdown ตามค่าที่เลือก
  };
}

export interface UiSchemaField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  widget?: WidgetType;
  title: string;
  description?: string;
  placeholder?: string;
  enum?: any[]; // กรณีเป็น static options
  enumNames?: string[]; // label สำหรับ options
  dataSource?: string; // กรณีดึง options จาก API (เช่น 'master-data/disciplines')
  defaultValue?: any;
  readOnly?: boolean;
  hidden?: boolean;

  // Validation & Rules
  required?: boolean;
  dependencies?: FieldDependency[];

  // For Nested Structures
  properties?: { [key: string]: UiSchemaField };
  items?: UiSchemaField; // For arrays

  // UI Grid Layout (Tailwind classes equivalent)
  colSpan?: number; // 1-12
}

export interface LayoutGroup {
  id: string;
  title: string;
  description?: string;
  type: 'group' | 'section';
  fields: string[]; // Field keys ที่จะอยู่ในกลุ่มนี้
}

export interface LayoutConfig {
  type: 'stack' | 'grid' | 'tabs' | 'steps' | 'wizard';
  groups: LayoutGroup[];
  options?: Record<string, any>; // Config เพิ่มเติมเฉพาะ Layout type
}

export interface UiSchema {
  layout: LayoutConfig;
  fields: {
    [key: string]: UiSchemaField;
  };
}

