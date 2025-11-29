// File: src/modules/json-schema/json-schema.service.ts
// บันทึกการแก้ไข: Fix TS2345 (undefined check)

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { Repository } from 'typeorm';

import { CreateJsonSchemaDto } from './dto/create-json-schema.dto';
import { SearchJsonSchemaDto } from './dto/search-json-schema.dto';
import { UpdateJsonSchemaDto } from './dto/update-json-schema.dto';
import { JsonSchema } from './entities/json-schema.entity';

// Services ย่อยที่แยกตามหน้าที่ (Single Responsibility)
import {
  JsonSecurityService,
  SecurityContext,
} from './services/json-security.service';
import { UiSchemaService } from './services/ui-schema.service';
import { VirtualColumnService } from './services/virtual-column.service';

import {
  ValidationErrorDetail,
  ValidationOptions,
  ValidationResult,
} from './interfaces/validation-result.interface';

@Injectable()
export class JsonSchemaService implements OnModuleInit {
  private ajv: Ajv;
  private validators = new Map<string, ValidateFunction>(); // Cache สำหรับเก็บ Validator ที่ Compile แล้ว
  private readonly logger = new Logger(JsonSchemaService.name);

  // ค่า Default สำหรับการตรวจสอบข้อมูล
  private readonly defaultOptions: ValidationOptions = {
    removeAdditional: true, // ลบฟิลด์เกิน
    coerceTypes: true, // แปลงชนิดข้อมูลอัตโนมัติ (เช่น "123" -> 123)
    useDefaults: true, // ใส่ค่า Default ถ้าไม่มีข้อมูล
  };

  constructor(
    @InjectRepository(JsonSchema)
    private readonly jsonSchemaRepository: Repository<JsonSchema>,
    private readonly virtualColumnService: VirtualColumnService,
    private readonly uiSchemaService: UiSchemaService,
    private readonly jsonSecurityService: JsonSecurityService,
  ) {
    // กำหนดค่าเริ่มต้นให้กับ AJV Validation Engine
    this.ajv = new Ajv({
      allErrors: true, // แสดง Error ทั้งหมด ไม่หยุดแค่จุดแรก
      strict: false, // ไม่เคร่งครัดเกินไป (ยอมรับ Keyword แปลกๆ เช่น ui:widget)
      coerceTypes: true,
      useDefaults: true,
      removeAdditional: true,
    });
    addFormats(this.ajv); // เพิ่ม Format มาตรฐาน (email, date, uri ฯลฯ)
    this.registerCustomValidators(); // ลงทะเบียน Validator เฉพาะของโปรเจกต์
  }

  async onModuleInit() {
    // สามารถโหลด Schema ที่ Active ทั้งหมดมา Cache ไว้ล่วงหน้าได้ที่นี่ เพื่อความเร็วในการตอบสนองครั้งแรก
  }

  /**
   * ลงทะเบียน Custom Validators เฉพาะสำหรับ LCBP3
   */
  private registerCustomValidators() {
    // 1. ตรวจสอบรูปแบบเลขที่เอกสาร (เช่น TEAM-RFA-STR-0001)
    this.ajv.addFormat('document-number', {
      type: 'string',
      validate: (value: string) => {
        // Regex อย่างง่าย: กลุ่มตัวอักษรขีดคั่นด้วย -
        return /^[A-Z0-9]{2,10}-[A-Z]{2,5}(-[A-Z0-9]{2,5})?-\d{4}-\d{3,5}$/.test(
          value,
        );
      },
    });

    // 2. Keyword สำหรับระบุ Role ที่จำเป็น (ใช้ร่วมกับ Security Service)
    this.ajv.addKeyword({
      keyword: 'requiredRole',
      type: 'string',
      metaSchema: { type: 'string' },
      validate: (schema: string, data: any) => true, // ผ่านเสมอในขั้น AJV (Security Service จะจัดการเอง)
    });
  }

  /**
   * สร้าง Schema ใหม่ พร้อมจัดการ Version, UI Schema และ Virtual Columns
   */
  async create(createDto: CreateJsonSchemaDto): Promise<JsonSchema> {
    // 1. ตรวจสอบความถูกต้องของ JSON Schema Definition (AJV Syntax)
    try {
      this.ajv.compile(createDto.schemaDefinition);
    } catch (error: any) {
      throw new BadRequestException(
        `Invalid JSON Schema format: ${error.message}`,
      );
    }

    // 2. จัดการ UI Schema
    if (createDto.uiSchema) {
      // ถ้าส่งมา ให้ตรวจสอบความถูกต้องเทียบกับ Data Schema
      this.uiSchemaService.validateUiSchema(
        createDto.uiSchema as any,
        createDto.schemaDefinition,
      );
    } else {
      // ถ้าไม่ส่งมา ให้สร้าง UI Schema พื้นฐานให้อัตโนมัติ
      createDto.uiSchema = this.uiSchemaService.generateDefaultUiSchema(
        createDto.schemaDefinition,
      );
    }

    // 3. จัดการ Versioning อัตโนมัติ (Auto-increment)
    const latestSchema = await this.jsonSchemaRepository.findOne({
      where: { schemaCode: createDto.schemaCode },
      order: { version: 'DESC' },
    });

    let newVersion = 1;
    if (latestSchema) {
      // ถ้าผู้ใช้ไม่ระบุ Version หรือระบุมาน้อยกว่าล่าสุด ให้ +1
      if (!createDto.version || createDto.version <= latestSchema.version) {
        newVersion = latestSchema.version + 1;
      } else {
        newVersion = createDto.version;
      }
    } else if (createDto.version) {
      newVersion = createDto.version;
    }

    // 4. บันทึกลงฐานข้อมูล
    const newSchema = this.jsonSchemaRepository.create({
      ...createDto,
      version: newVersion,
    });

    const savedSchema = await this.jsonSchemaRepository.save(newSchema);

    // ล้าง Cache เพื่อให้โหลดตัวใหม่ในครั้งถัดไป
    this.validators.delete(savedSchema.schemaCode);

    this.logger.log(
      `Schema '${savedSchema.schemaCode}' created (v${savedSchema.version})`,
    );

    // 5. สร้าง/อัปเดต Virtual Columns บน Database จริง (Performance Optimization)
    // Fix TS2345: Add empty array fallback
    if (savedSchema.virtualColumns && savedSchema.virtualColumns.length > 0) {
      await this.virtualColumnService.setupVirtualColumns(
        savedSchema.tableName,
        savedSchema.virtualColumns || [],
      );
    }

    return savedSchema;
  }

  /**
   * ค้นหา Schema ทั้งหมด (Pagination & Filter)
   */
  async findAll(searchDto: SearchJsonSchemaDto) {
    const { search, isActive, page = 1, limit = 20 } = searchDto;
    const skip = (page - 1) * limit;

    const query = this.jsonSchemaRepository.createQueryBuilder('schema');

    if (search) {
      query.andWhere('schema.schemaCode LIKE :search', {
        search: `%${search}%`,
      });
    }

    if (isActive !== undefined) {
      query.andWhere('schema.isActive = :isActive', { isActive });
    }

    // เรียงตาม Code ก่อน แล้วตามด้วย Version ล่าสุด
    query.orderBy('schema.schemaCode', 'ASC');
    query.addOrderBy('schema.version', 'DESC');

    const [items, total] = await query.skip(skip).take(limit).getManyAndCount();

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ดึงข้อมูล Schema ตาม ID
   */
  async findOne(id: number): Promise<JsonSchema> {
    const schema = await this.jsonSchemaRepository.findOne({ where: { id } });
    if (!schema) {
      throw new NotFoundException(`JsonSchema with ID ${id} not found`);
    }
    return schema;
  }

  /**
   * ดึงข้อมูล Schema ตาม Code และ Version (สำหรับ Migration)
   */
  async findOneByCodeAndVersion(
    code: string,
    version: number,
  ): Promise<JsonSchema> {
    const schema = await this.jsonSchemaRepository.findOne({
      where: { schemaCode: code, version },
    });

    if (!schema) {
      throw new NotFoundException(
        `JsonSchema '${code}' version ${version} not found`,
      );
    }
    return schema;
  }

  /**
   * ดึง Schema เวอร์ชันล่าสุดที่ Active (สำหรับใช้งานทั่วไป)
   */
  async findLatestByCode(code: string): Promise<JsonSchema> {
    const schema = await this.jsonSchemaRepository.findOne({
      where: { schemaCode: code, isActive: true },
      order: { version: 'DESC' },
    });

    if (!schema) {
      throw new NotFoundException(
        `Active JsonSchema with code '${code}' not found`,
      );
    }
    return schema;
  }

  /**
   * [CORE FUNCTION] ตรวจสอบข้อมูล (Validate), ทำความสะอาด (Sanitize) และเข้ารหัส (Encrypt)
   * ใช้สำหรับ "ขาเข้า" (Write) ก่อนบันทึกลง Database
   */
  async validateData(
    schemaCode: string,
    data: any,
    options: ValidationOptions = {},
  ): Promise<ValidationResult> {
    // 1. ดึงและ Compile Validator
    const validate = await this.getValidator(schemaCode);
    const schema = await this.findLatestByCode(schemaCode); // ดึง Full Schema เพื่อใช้ Config อื่นๆ

    // 2. สำเนาข้อมูลเพื่อป้องกัน Side Effect และเตรียมสำหรับ AJV Mutation (Sanitization)
    const dataToValidate = JSON.parse(JSON.stringify(data));

    // 3. เริ่มการตรวจสอบ (AJV จะทำการ Coerce Type และ Remove Additional Properties ให้ด้วย)
    const valid = validate(dataToValidate);

    // 4. จัดการกรณีข้อมูลไม่ถูกต้อง
    if (!valid) {
      const errors: ValidationErrorDetail[] = (validate.errors || []).map(
        (err) => ({
          field: err.instancePath || 'root',
          message: err.message || 'Validation error',
          value: err.params,
        }),
      );

      return {
        isValid: false,
        errors,
        sanitizedData: null,
      };
    }

    // 5. เข้ารหัสข้อมูล (Encryption) สำหรับ Field ที่มีความลับ (x-encrypt: true)
    const secureData = this.jsonSecurityService.encryptFields(
      dataToValidate,
      schema.schemaDefinition,
    );

    return {
      isValid: true,
      errors: [],
      sanitizedData: secureData, // ข้อมูลนี้สะอาดและปลอดภัย พร้อมบันทึก
    };
  }

  /**
   * [CORE FUNCTION] อ่านข้อมูล, ถอดรหัส (Decrypt) และกรองตามสิทธิ์ (Filter)
   * ใช้สำหรับ "ขาออก" (Read) ก่อนส่งให้ Frontend
   */
  async processReadData(
    schemaCode: string,
    data: any,
    userContext: SecurityContext,
  ): Promise<any> {
    if (!data) return data;

    // ดึง Schema เพื่อดู Config การถอดรหัสและการมองเห็น
    const schema = await this.findLatestByCode(schemaCode);

    return this.jsonSecurityService.decryptAndFilterFields(
      data,
      schema.schemaDefinition,
      userContext,
    );
  }

  /**
   * Helper: ดึงและ Cache AJV Validator Function เพื่อประสิทธิภาพ
   */
  private async getValidator(schemaCode: string): Promise<ValidateFunction> {
    let validate = this.validators.get(schemaCode);

    if (!validate) {
      const schema = await this.findLatestByCode(schemaCode);
      try {
        validate = this.ajv.compile(schema.schemaDefinition);
        this.validators.set(schemaCode, validate);
      } catch (error: any) {
        throw new BadRequestException(
          `Invalid Schema Definition for '${schemaCode}': ${error.message}`,
        );
      }
    }
    return validate;
  }

  /**
   * Wrapper เก่าสำหรับ Backward Compatibility (ถ้ามีโค้ดเก่าเรียกใช้)
   */
  async validate(schemaCode: string, data: any): Promise<boolean> {
    const result = await this.validateData(schemaCode, data);
    if (!result.isValid) {
      const errorMsg = result.errors
        .map((e) => `${e.field}: ${e.message}`)
        .join(', ');
      throw new BadRequestException(`JSON Validation Failed: ${errorMsg}`);
    }
    return true;
  }

  /**
   * อัปเดตข้อมูล Schema และจัดการผลกระทบ (Virtual Columns / UI Schema)
   */
  async update(
    id: number,
    updateDto: UpdateJsonSchemaDto,
  ): Promise<JsonSchema> {
    const schema = await this.findOne(id);

    // ตรวจสอบ JSON Schema
    if (updateDto.schemaDefinition) {
      try {
        this.ajv.compile(updateDto.schemaDefinition);
      } catch (error: any) {
        throw new BadRequestException(
          `Invalid JSON Schema format: ${error.message}`,
        );
      }
      this.validators.delete(schema.schemaCode); // เคลียร์ Cache เก่า
    }

    // ตรวจสอบ UI Schema
    if (updateDto.uiSchema) {
      this.uiSchemaService.validateUiSchema(
        updateDto.uiSchema as any,
        updateDto.schemaDefinition || schema.schemaDefinition,
      );
    }

    const updatedSchema = this.jsonSchemaRepository.merge(schema, updateDto);
    const savedSchema = await this.jsonSchemaRepository.save(updatedSchema);

    // อัปเดต Virtual Columns ใน Database ถ้ามีการเปลี่ยนแปลง Config
    // Fix TS2345: Add empty array fallback
    if (updateDto.virtualColumns && updatedSchema.virtualColumns) {
      await this.virtualColumnService.setupVirtualColumns(
        savedSchema.tableName,
        savedSchema.virtualColumns || [],
      );
    }

    return savedSchema;
  }

  /**
   * ลบ Schema (Hard Delete)
   */
  async remove(id: number): Promise<void> {
    const schema = await this.findOne(id);
    this.validators.delete(schema.schemaCode);
    await this.jsonSchemaRepository.remove(schema);
  }
}
