// File: src/modules/correspondence/correspondence.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, In } from 'typeorm';

// Entities
import { Correspondence } from './entities/correspondence.entity.js';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity.js';
import { CorrespondenceType } from './entities/correspondence-type.entity.js';
import { CorrespondenceStatus } from './entities/correspondence-status.entity.js';
import { RoutingTemplate } from './entities/routing-template.entity.js';
import { CorrespondenceRouting } from './entities/correspondence-routing.entity.js';
import { CorrespondenceReference } from './entities/correspondence-reference.entity.js'; // Entity สำหรับตารางเชื่อมโยง
import { User } from '../user/entities/user.entity.js';

// DTOs
import { CreateCorrespondenceDto } from './dto/create-correspondence.dto.js';
import { WorkflowActionDto } from './dto/workflow-action.dto.js';
import { AddReferenceDto } from './dto/add-reference.dto.js';
import { SearchCorrespondenceDto } from './dto/search-correspondence.dto.js';

// Interfaces & Enums
import { WorkflowAction } from '../workflow-engine/interfaces/workflow.interface.js';

// Services
import { DocumentNumberingService } from '../document-numbering/document-numbering.service.js';
import { JsonSchemaService } from '../json-schema/json-schema.service.js';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service.js';
import { UserService } from '../user/user.service.js';

@Injectable()
export class CorrespondenceService {
  private readonly logger = new Logger(CorrespondenceService.name);

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
    @InjectRepository(CorrespondenceReference)
    private referenceRepo: Repository<CorrespondenceReference>,

    private numberingService: DocumentNumberingService,
    private jsonSchemaService: JsonSchemaService,
    private workflowEngine: WorkflowEngineService,
    private userService: UserService,
    private dataSource: DataSource,
  ) {}

  /**
   * สร้างเอกสารใหม่ (Create Document)
   * รองรับ Impersonation Logic: Superadmin สามารถสร้างในนามองค์กรอื่นได้
   *
   * @param createDto ข้อมูลสำหรับการสร้างเอกสาร
   * @param user ผู้ใช้งานที่ทำการสร้าง
   * @returns ข้อมูลเอกสารที่สร้างเสร็จแล้ว
   */
  async create(createDto: CreateCorrespondenceDto, user: User) {
    // 1. ตรวจสอบข้อมูลพื้นฐาน (Basic Validation)
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

    // 2. Impersonation Logic & Organization Context
    // กำหนด Org เริ่มต้นเป็นของผู้ใช้งานปัจจุบัน
    let userOrgId = user.primaryOrganizationId;

    // Fallback: หากใน Token ไม่มี Org ID ให้ดึงจาก DB อีกครั้งเพื่อความชัวร์
    if (!userOrgId) {
      const fullUser = await this.userService.findOne(user.user_id);
      if (fullUser) {
        userOrgId = fullUser.primaryOrganizationId;
      }
    }

    // ตรวจสอบกรณีต้องการสร้างในนามองค์กรอื่น (Impersonation)
    if (createDto.originatorId && createDto.originatorId !== userOrgId) {
      // ดึง Permissions ของผู้ใช้มาตรวจสอบ
      const permissions = await this.userService.getUserPermissions(
        user.user_id,
      );

      // ผู้ใช้ต้องมีสิทธิ์ 'system.manage_all' เท่านั้นจึงจะสวมสิทธิ์ได้
      if (!permissions.includes('system.manage_all')) {
        throw new ForbiddenException(
          'You do not have permission to create documents on behalf of other organizations.',
        );
      }

      // อนุญาตให้ใช้ Org ID ที่ส่งมา
      userOrgId = createDto.originatorId;
    }

    // Final Validation: ต้องมี Org ID เสมอ
    if (!userOrgId) {
      throw new BadRequestException(
        'User must belong to an organization to create documents',
      );
    }

    // 3. Validate JSON Details (ถ้ามี)
    if (createDto.details) {
      try {
        await this.jsonSchemaService.validate(type.typeCode, createDto.details);
      } catch (error: any) {
        // Log warning แต่ไม่ Block การสร้าง (ตามความยืดหยุ่นที่ต้องการ) หรือจะ Throw ก็ได้ตาม Req
        this.logger.warn(
          `Schema validation warning for ${type.typeCode}: ${error.message}`,
        );
      }
    }

    // 4. เริ่ม Transaction (เพื่อความสมบูรณ์ของข้อมูล: เลขที่เอกสาร + ตัวเอกสาร + Revision)
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 4.1 ขอเลขที่เอกสาร (Double-Lock Mechanism ผ่าน NumberingService)
      // TODO: Fetch ORG_CODE จาก DB จริงๆ โดยใช้ userOrgId
      const orgCode = 'ORG'; // Mock ไว้ก่อน ควร query จาก Organization Entity

      const docNumber = await this.numberingService.generateNextNumber(
        createDto.projectId,
        userOrgId, // ใช้ ID ของเจ้าของเอกสารจริง (Originator)
        createDto.typeId,
        new Date().getFullYear(),
        {
          TYPE_CODE: type.typeCode,
          ORG_CODE: orgCode,
        },
      );

      // 4.2 สร้าง Correspondence (หัวจดหมาย)
      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber,
        correspondenceTypeId: createDto.typeId,
        projectId: createDto.projectId,
        originatorId: userOrgId, // บันทึก Org ที่ถูกต้อง
        isInternal: createDto.isInternal || false,
        createdBy: user.user_id,
      });
      const savedCorr = await queryRunner.manager.save(correspondence);

      // 4.3 สร้าง Revision แรก (Rev 0)
      const revision = queryRunner.manager.create(CorrespondenceRevision, {
        correspondenceId: savedCorr.id,
        revisionNumber: 0,
        revisionLabel: 'A', // หรือเริ่มที่ 0 แล้วแต่ Business Logic
        isCurrent: true,
        statusId: statusDraft.id,
        title: createDto.title,
        description: createDto.description, // ถ้ามีใน DTO
        details: createDto.details,
        createdBy: user.user_id,
      });
      await queryRunner.manager.save(revision);

      await queryRunner.commitTransaction();

      return {
        ...savedCorr,
        currentRevision: revision,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create correspondence: ${(err as Error).message}`,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * ค้นหาเอกสาร (Find All)
   * รองรับการกรองและค้นหา
   */
  async findAll(searchDto: SearchCorrespondenceDto = {}) {
    const { search, typeId, projectId, statusId } = searchDto;

    const query = this.correspondenceRepo
      .createQueryBuilder('corr')
      .leftJoinAndSelect('corr.revisions', 'rev')
      .leftJoinAndSelect('corr.type', 'type')
      .leftJoinAndSelect('corr.project', 'project')
      .leftJoinAndSelect('corr.originator', 'org')
      .where('rev.isCurrent = :isCurrent', { isCurrent: true }); // ดูเฉพาะ Rev ปัจจุบัน

    if (projectId) {
      query.andWhere('corr.projectId = :projectId', { projectId });
    }

    if (typeId) {
      query.andWhere('corr.correspondenceTypeId = :typeId', { typeId });
    }

    if (statusId) {
      query.andWhere('rev.statusId = :statusId', { statusId });
    }

    if (search) {
      query.andWhere(
        '(corr.correspondenceNumber LIKE :search OR rev.title LIKE :search)',
        { search: `%${search}%` },
      );
    }

    query.orderBy('corr.createdAt', 'DESC');

    return query.getMany();
  }

  /**
   * ดึงข้อมูลเอกสารรายตัว (Find One)
   * พร้อม Relations ที่จำเป็น
   */
  async findOne(id: number) {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { id },
      relations: [
        'revisions',
        'revisions.status', // สถานะของ Revision
        'type',
        'project',
        'originator',
        // 'tags', // ถ้ามี Relation
        // 'attachments' // ถ้ามี Relation ผ่าน Junction
      ],
    });

    if (!correspondence) {
      throw new NotFoundException(`Correspondence with ID ${id} not found`);
    }
    return correspondence;
  }

  /**
   * ส่งเอกสารเข้า Workflow (Submit)
   * สร้าง Routing เริ่มต้นตาม Template
   */
  async submit(correspondenceId: number, templateId: number, user: User) {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { id: correspondenceId },
      relations: ['revisions'],
    });

    if (!correspondence) {
      throw new NotFoundException('Correspondence not found');
    }

    const currentRevision = correspondence.revisions?.find((r) => r.isCurrent);
    if (!currentRevision) {
      throw new NotFoundException('Current revision not found');
    }

    // ตรวจสอบสถานะปัจจุบัน (ต้องเป็น DRAFT หรือสถานะที่แก้ได้)
    // TODO: เพิ่ม Logic ตรวจสอบ Status ID ว่าเป็น DRAFT หรือไม่

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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const firstStep = template.steps[0];

      // สร้าง Routing Record แรก
      const routing = queryRunner.manager.create(CorrespondenceRouting, {
        correspondenceId: currentRevision.id, // ผูกกับ Revision
        templateId: template.id, // บันทึก templateId ไว้ใช้อ้างอิง
        sequence: 1,
        fromOrganizationId: user.primaryOrganizationId, // ส่งจากเรา
        toOrganizationId: firstStep.toOrganizationId, // ไปยังผู้รับคนแรก
        stepPurpose: firstStep.stepPurpose,
        status: 'SENT',
        dueDate: new Date(
          Date.now() + (firstStep.expectedDays || 7) * 24 * 60 * 60 * 1000,
        ),
        processedByUserId: user.user_id, // บันทึกว่าใครกดส่ง
        processedAt: new Date(),
      });
      await queryRunner.manager.save(routing);

      // TODO: อัปเดตสถานะเอกสารเป็น SUBMITTED (เปลี่ยน statusId ใน Revision)

      await queryRunner.commitTransaction();
      return routing;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * ประมวลผล Action ใน Workflow (Approve/Reject/Etc.)
   */
  async processAction(
    correspondenceId: number,
    dto: WorkflowActionDto,
    user: User,
  ) {
    // 1. Find Document & Current Revision
    const correspondence = await this.correspondenceRepo.findOne({
      where: { id: correspondenceId },
      relations: ['revisions'],
    });

    if (!correspondence)
      throw new NotFoundException('Correspondence not found');

    const currentRevision = correspondence.revisions?.find((r) => r.isCurrent);
    if (!currentRevision)
      throw new NotFoundException('Current revision not found');

    // 2. Find Active Routing Step (Status = SENT)
    // หาสเต็ปล่าสุดที่ส่งมาถึง Org ของเรา และสถานะเป็น SENT
    const currentRouting = await this.routingRepo.findOne({
      where: {
        correspondenceId: currentRevision.id,
        status: 'SENT',
      },
      order: { sequence: 'DESC' },
      relations: ['toOrganization'],
    });

    if (!currentRouting) {
      throw new BadRequestException(
        'No active workflow step found for this document',
      );
    }

    // 3. Check Permissions (Must be in target Org)
    // Logic: ผู้กด Action ต้องสังกัด Org ที่เป็นปลายทางของ Routing นี้
    // TODO: เพิ่ม Logic ให้ Superadmin หรือ Document Control กดแทนได้
    if (currentRouting.toOrganizationId !== user.primaryOrganizationId) {
      throw new BadRequestException(
        'You are not authorized to process this step',
      );
    }

    // 4. Load Template to find Next Step Config
    if (!currentRouting.templateId) {
      throw new InternalServerErrorException(
        'Routing record missing templateId',
      );
    }

    const template = await this.templateRepo.findOne({
      where: { id: currentRouting.templateId },
      relations: ['steps'],
    });

    if (!template || !template.steps) {
      throw new InternalServerErrorException('Template definition not found');
    }

    const totalSteps = template.steps.length;
    const currentSeq = currentRouting.sequence;

    // 5. Calculate Next State using Workflow Engine Service
    const result = this.workflowEngine.processAction(
      currentSeq,
      totalSteps,
      dto.action,
      dto.returnToSequence,
    );

    // 6. Execute Database Updates
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 6.1 Update Current Step
      currentRouting.status =
        dto.action === WorkflowAction.REJECT ? 'REJECTED' : 'ACTIONED';
      currentRouting.processedByUserId = user.user_id;
      currentRouting.processedAt = new Date();
      currentRouting.comments = dto.comments;

      await queryRunner.manager.save(currentRouting);

      // 6.2 Create Next Step (If exists and not rejected/completed)
      if (result.nextStepSequence && dto.action !== WorkflowAction.REJECT) {
        // ค้นหา Config ของ Step ถัดไปจาก Template
        const nextStepConfig = template.steps.find(
          (s) => s.sequence === result.nextStepSequence,
        );

        if (!nextStepConfig) {
          // อาจจะเป็นกรณี End of Workflow หรือ Logic Error
          this.logger.warn(
            `Next step ${result.nextStepSequence} not found in template`,
          );
        } else {
          const nextRouting = queryRunner.manager.create(
            CorrespondenceRouting,
            {
              correspondenceId: currentRevision.id,
              templateId: template.id,
              sequence: result.nextStepSequence,
              fromOrganizationId: user.primaryOrganizationId, // ส่งจากคนปัจจุบัน
              toOrganizationId: nextStepConfig.toOrganizationId, // ไปยังคนถัดไปตาม Template
              stepPurpose: nextStepConfig.stepPurpose,
              status: 'SENT',
              dueDate: new Date(
                Date.now() +
                  (nextStepConfig.expectedDays || 7) * 24 * 60 * 60 * 1000,
              ),
            },
          );
          await queryRunner.manager.save(nextRouting);
        }
      }

      // 6.3 Update Document Status (Optional / Based on result)
      if (result.shouldUpdateStatus) {
        // Logic เปลี่ยนสถานะ revision เช่นจาก SUBMITTED -> APPROVED
        // await this.updateDocumentStatus(currentRevision, result.documentStatus, queryRunner);
      }

      await queryRunner.commitTransaction();
      return { message: 'Action processed successfully', result };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // --- REFERENCE MANAGEMENT ---

  /**
   * เพิ่มเอกสารอ้างอิง (Add Reference)
   * ตรวจสอบ Circular Reference และ Duplicate
   */
  async addReference(id: number, dto: AddReferenceDto) {
    // 1. เช็คว่าเอกสารทั้งคู่มีอยู่จริง
    const source = await this.correspondenceRepo.findOne({ where: { id } });
    const target = await this.correspondenceRepo.findOne({
      where: { id: dto.targetId },
    });

    if (!source || !target) {
      throw new NotFoundException('Source or Target correspondence not found');
    }

    // 2. ป้องกันการอ้างอิงตัวเอง (Self-Reference)
    if (source.id === target.id) {
      throw new BadRequestException('Cannot reference self');
    }

    // 3. ตรวจสอบว่ามีอยู่แล้วหรือไม่ (Duplicate Check)
    const exists = await this.referenceRepo.findOne({
      where: {
        sourceId: id,
        targetId: dto.targetId,
      },
    });

    if (exists) {
      return exists; // ถ้ามีแล้วก็คืนตัวเดิมไป (Idempotency)
    }

    // 4. สร้าง Reference
    const ref = this.referenceRepo.create({
      sourceId: id,
      targetId: dto.targetId,
    });

    return this.referenceRepo.save(ref);
  }

  /**
   * ลบเอกสารอ้างอิง (Remove Reference)
   */
  async removeReference(id: number, targetId: number) {
    const result = await this.referenceRepo.delete({
      sourceId: id,
      targetId: targetId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Reference not found');
    }
  }

  /**
   * ดึงรายการเอกสารอ้างอิง (Get References)
   * ทั้งที่อ้างถึง (Outgoing) และถูกอ้างถึง (Incoming)
   */
  async getReferences(id: number) {
    // ดึงรายการที่เอกสารนี้ไปอ้างถึง (Outgoing: This -> Others)
    const outgoing = await this.referenceRepo.find({
      where: { sourceId: id },
      relations: ['target', 'target.type'], // Join เพื่อเอาข้อมูลเอกสารปลายทาง
    });

    // ดึงรายการที่มาอ้างถึงเอกสารนี้ (Incoming: Others -> This)
    const incoming = await this.referenceRepo.find({
      where: { targetId: id },
      relations: ['source', 'source.type'], // Join เพื่อเอาข้อมูลเอกสารต้นทาง
    });

    return { outgoing, incoming };
  }
}
