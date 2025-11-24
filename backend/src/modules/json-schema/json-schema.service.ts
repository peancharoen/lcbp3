import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { JsonSchema } from './entities/json-schema.entity'; // ลบ .js

@Injectable()
export class JsonSchemaService implements OnModuleInit {
  private ajv: Ajv;
  private validators = new Map<string, any>();
  private readonly logger = new Logger(JsonSchemaService.name);

  constructor(
    @InjectRepository(JsonSchema)
    private schemaRepo: Repository<JsonSchema>,
  ) {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  async onModuleInit() {
    // Pre-load schemas (Optional for performance)
    // const schemas = await this.schemaRepo.find({ where: { isActive: true } });
    // schemas.forEach(s => this.createValidator(s.schemaCode, s.schemaDefinition));
  }

  /**
   * ตรวจสอบข้อมูล JSON ว่าถูกต้องตาม Schema หรือไม่
   */
  async validate(schemaCode: string, data: any): Promise<boolean> {
    let validate = this.validators.get(schemaCode);

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
      const errors = validate.errors
        ?.map((e: any) => `${e.instancePath} ${e.message}`)
        .join(', ');
      // โยน Error กลับไปเพื่อให้ Controller/Service ปลายทางจัดการ
      throw new BadRequestException(`JSON Validation Failed: ${errors}`);
    }

    return true;
  }

  /**
   * สร้างหรืออัปเดต Schema
   */
  async createOrUpdate(schemaCode: string, definition: Record<string, any>) {
    // 1. ตรวจสอบว่า Definition เป็น JSON Schema ที่ถูกต้องไหม
    try {
      this.ajv.compile(definition);
    } catch (error: any) {
      throw new BadRequestException(
        `Invalid JSON Schema format: ${error.message}`,
      );
    }

    // 2. บันทึกลง DB
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

    const savedSchema = await this.schemaRepo.save(schema);

    // 3. Clear Cache เพื่อให้ครั้งหน้าโหลดตัวใหม่
    this.validators.delete(schemaCode);
    this.logger.log(`Schema '${schemaCode}' updated (v${savedSchema.version})`);

    return savedSchema;
  }
}
