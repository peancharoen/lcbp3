import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

// Entities
import { Correspondence } from './entities/correspondence.entity.js';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity.js';
import { CorrespondenceType } from './entities/correspondence-type.entity.js';
import { CorrespondenceStatus } from './entities/correspondence-status.entity.js';
import { RoutingTemplate } from './entities/routing-template.entity.js';
import { CorrespondenceRouting } from './entities/correspondence-routing.entity.js';
import { User } from '../user/entities/user.entity.js';

// DTOs
import { CreateCorrespondenceDto } from './dto/create-correspondence.dto.js';

// Services
import { DocumentNumberingService } from '../document-numbering/document-numbering.service.js';
import { JsonSchemaService } from '../json-schema/json-schema.service.js';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service.js';

@Injectable()
export class CorrespondenceService {
  constructor(
    @InjectRepository(Correspondence)
    private correspondenceRepo: Repository<Correspondence>,
    @InjectRepository(CorrespondenceRevision)
    private revisionRepo: Repository<CorrespondenceRevision>,
    @InjectRepository(CorrespondenceType)
    private typeRepo: Repository<CorrespondenceType>,
    @InjectRepository(CorrespondenceStatus)
    private statusRepo: Repository<CorrespondenceStatus>,
    @InjectRepository(RoutingTemplate)
    private templateRepo: Repository<RoutingTemplate>,
    @InjectRepository(CorrespondenceRouting)
    private routingRepo: Repository<CorrespondenceRouting>,

    private numberingService: DocumentNumberingService,
    private jsonSchemaService: JsonSchemaService,
    private workflowEngine: WorkflowEngineService,
    private dataSource: DataSource,
  ) {}

  /**
   * สร้างเอกสารใหม่ (Create Correspondence)
   * - ตรวจสอบสิทธิ์และข้อมูลพื้นฐาน
   * - Validate JSON Details ตาม Type
   * - ขอเลขที่เอกสาร (Redis Lock)
   * - บันทึกข้อมูลลง DB (Transaction)
   */
  async create(createDto: CreateCorrespondenceDto, user: User) {
    // 1. ตรวจสอบข้อมูลพื้นฐาน (Type, Status, Org)
    const type = await this.typeRepo.findOne({
      where: { id: createDto.typeId },
    });
    if (!type) throw new NotFoundException('Document Type not found');

    const statusDraft = await this.statusRepo.findOne({
      where: { statusCode: 'DRAFT' },
    });
    if (!statusDraft) {
      throw new InternalServerErrorException(
        'Status DRAFT not found in Master Data',
      );
    }

    const userOrgId = user.primaryOrganizationId;
    if (!userOrgId) {
      throw new BadRequestException(
        'User must belong to an organization to create documents',
      );
    }

    // 2. Validate JSON Details (ถ้ามี)
    if (createDto.details) {
      try {
        // ใช้ Type Code เป็น Key ในการค้นหา Schema (เช่น 'RFA', 'LETTER')
        await this.jsonSchemaService.validate(type.typeCode, createDto.details);
      } catch (error: any) {
        // บันทึก Warning หรือ Throw Error ตามนโยบาย (ในที่นี้ให้ผ่านไปก่อนถ้ายังไม่สร้าง Schema)
        console.warn(
          `Schema validation warning for ${type.typeCode}: ${error.message}`,
        );
      }
    }

    // 3. เริ่ม Transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 3.1 ขอเลขที่เอกสาร (Double-Lock Mechanism)
      // Mock ค่า replacements ไว้ก่อน (จริงๆ ต้อง Join เอา Org Code มา)
      const docNumber = await this.numberingService.generateNextNumber(
        createDto.projectId,
        userOrgId,
        createDto.typeId,
        new Date().getFullYear(),
        {
          TYPE_CODE: type.typeCode,
          ORG_CODE: 'ORG', // TODO: Fetch real organization code
        },
      );

      // 3.2 สร้าง Correspondence (หัวจดหมาย)
      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber,
        correspondenceTypeId: createDto.typeId,
        projectId: createDto.projectId,
        originatorId: userOrgId,
        isInternal: createDto.isInternal || false,
        createdBy: user.user_id,
      });
      const savedCorr = await queryRunner.manager.save(correspondence);

      // 3.3 สร้าง Revision แรก (Rev 0)
      const revision = queryRunner.manager.create(CorrespondenceRevision, {
        correspondenceId: savedCorr.id,
        revisionNumber: 0,
        revisionLabel: 'A',
        isCurrent: true,
        statusId: statusDraft.id,
        title: createDto.title,
        details: createDto.details,
        createdBy: user.user_id,
      });
      await queryRunner.manager.save(revision);

      // 4. Commit Transaction
      await queryRunner.commitTransaction();

      return {
        ...savedCorr,
        currentRevision: revision,
      };
    } catch (err) {
      // Rollback หากเกิดข้อผิดพลาด
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * ดึงข้อมูลเอกสารทั้งหมด (สำหรับ List Page)
   */
  async findAll() {
    return this.correspondenceRepo.find({
      relations: ['revisions', 'type', 'project', 'originator'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * ดึงข้อมูลเอกสารรายตัว (Detail Page)
   */
  async findOne(id: number) {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { id },
      relations: ['revisions', 'type', 'project', 'originator'],
    });

    if (!correspondence) {
      throw new NotFoundException(`Correspondence with ID ${id} not found`);
    }

    return correspondence;
  }

  /**
   * ส่งเอกสาร (Submit) เพื่อเริ่ม Workflow การอนุมัติ/ส่งต่อ
   */
  async submit(correspondenceId: number, templateId: number, user: User) {
    // 1. ดึงข้อมูลเอกสารและหา Revision ปัจจุบัน
    const correspondence = await this.correspondenceRepo.findOne({
      where: { id: correspondenceId },
      relations: ['revisions'],
    });

    if (!correspondence) {
      throw new NotFoundException('Correspondence not found');
    }

    // หา Revision ที่เป็น current
    const currentRevision = correspondence.revisions?.find((r) => r.isCurrent);
    if (!currentRevision) {
      throw new NotFoundException('Current revision not found');
    }

    // 2. ดึงข้อมูล Template และ Steps
    const template = await this.templateRepo.findOne({
      where: { id: templateId },
      relations: ['steps'],
      order: { steps: { sequence: 'ASC' } },
    });

    if (!template || !template.steps?.length) {
      throw new BadRequestException(
        'Invalid routing template or no steps defined',
      );
    }

    // 3. เริ่ม Transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const firstStep = template.steps[0];

      // 3.1 สร้าง Routing Record แรก (Log การส่งต่อ)
      const routing = queryRunner.manager.create(CorrespondenceRouting, {
        correspondenceId: currentRevision.id, // เชื่อมกับ Revision ID
        sequence: 1,
        fromOrganizationId: user.primaryOrganizationId,
        toOrganizationId: firstStep.toOrganizationId,
        stepPurpose: firstStep.stepPurpose,
        status: 'SENT', // สถานะเริ่มต้นของการส่ง
        dueDate: new Date(
          Date.now() + (firstStep.expectedDays || 7) * 24 * 60 * 60 * 1000,
        ),
        processedByUserId: user.user_id, // ผู้ส่ง (User ปัจจุบัน)
        processedAt: new Date(),
      });
      await queryRunner.manager.save(routing);

      // 3.2 (Optional) อัปเดตสถานะของ Revision เป็น 'SUBMITTED'
      // const statusSubmitted = await this.statusRepo.findOne({ where: { statusCode: 'SUBMITTED' } });
      // if (statusSubmitted) {
      //   currentRevision.statusId = statusSubmitted.id;
      //   await queryRunner.manager.save(currentRevision);
      // }

      await queryRunner.commitTransaction();
      return routing;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
