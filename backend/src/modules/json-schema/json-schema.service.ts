import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { JsonSchema } from './entities/json-schema.entity.js';

@Injectable()
export class JsonSchemaService implements OnModuleInit {
  private ajv: Ajv;
  // Cache ตัว Validator ที่ Compile แล้ว เพื่อประสิทธิภาพ
  private validators = new Map<string, any>();

  constructor(
    @InjectRepository(JsonSchema)
    private schemaRepo: Repository<JsonSchema>,
  ) {
    // ตั้งค่า AJV
    this.ajv = new Ajv({ allErrors: true, strict: false }); // strict: false เพื่อยืดหยุ่นกับ custom keywords
    addFormats(this.ajv); // รองรับ format เช่น email, date-time
  }

  onModuleInit() {
    // (Optional) โหลด Schema ทั้งหมดมา Cache ตอนเริ่ม App ก็ได้
    // แต่ตอนนี้ใช้วิธี Lazy Load (โหลดเมื่อใช้) ไปก่อน
  }

  /**
   * ตรวจสอบข้อมูล JSON ว่าถูกต้องตาม Schema หรือไม่
   */
  async validate(schemaCode: string, data: any): Promise<boolean> {
    let validate = this.validators.get(schemaCode);

    // ถ้ายังไม่มีใน Cache หรือต้องการตัวล่าสุด ให้ดึงจาก DB
    if (!validate) {
      const schema = await this.schemaRepo.findOne({
        where: { schemaCode, isActive: true },
      });

      if (!schema) {
        throw new NotFoundException(`JSON Schema '${schemaCode}' not found`);
      }

      try {
        validate = this.ajv.compile(schema.schemaDefinition);
        this.validators.set(schemaCode, validate);
      } catch (error: any) {
        throw new BadRequestException(
          `Invalid Schema Definition for '${schemaCode}': ${error.message}`,
        );
      }
    }

    const valid = validate(data);

    if (!valid) {
      // รวบรวม Error ทั้งหมดส่งกลับไป
      const errors = validate.errors
        ?.map((e: any) => `${e.instancePath} ${e.message}`)
        .join(', ');
      throw new BadRequestException(`JSON Validation Failed: ${errors}`);
    }

    return true;
  }

  // ฟังก์ชันสำหรับสร้าง/อัปเดต Schema (สำหรับ Admin)
  async createOrUpdate(schemaCode: string, definition: any) {
    // ตรวจสอบก่อนว่า Definition เป็น JSON Schema ที่ถูกต้องไหม
    try {
      this.ajv.compile(definition);
    } catch (error: any) {
      throw new BadRequestException(
        `Invalid JSON Schema format: ${error.message}`,
      );
    }

    let schema = await this.schemaRepo.findOne({ where: { schemaCode } });

    if (schema) {
      schema.schemaDefinition = definition;
      schema.version += 1;
    } else {
      schema = this.schemaRepo.create({
        schemaCode,
        schemaDefinition: definition,
        version: 1,
      });
    }

    // Clear Cache เก่า
    this.validators.delete(schemaCode);

    return this.schemaRepo.save(schema);
  }
}
