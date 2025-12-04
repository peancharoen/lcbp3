// File: src/modules/rfa/rfa.service.ts

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

// Entities
import { CorrespondenceRouting } from '../correspondence/entities/correspondence-routing.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { RoutingTemplate } from '../correspondence/entities/routing-template.entity';
import { ShopDrawingRevision } from '../drawing/entities/shop-drawing-revision.entity';
import { User } from '../user/entities/user.entity';
import { RfaApproveCode } from './entities/rfa-approve-code.entity';
import { RfaItem } from './entities/rfa-item.entity';
import { RfaRevision } from './entities/rfa-revision.entity';
import { RfaStatusCode } from './entities/rfa-status-code.entity';
import { RfaType } from './entities/rfa-type.entity';
import { Rfa } from './entities/rfa.entity';

// DTOs
import { WorkflowActionDto } from '../correspondence/dto/workflow-action.dto';
import { CreateRfaDto } from './dto/create-rfa.dto';

// Interfaces & Enums
import { WorkflowAction } from '../workflow-engine/interfaces/workflow.interface';

// Services
import { DocumentNumberingService } from '../document-numbering/document-numbering.service';
import { NotificationService } from '../notification/notification.service';
import { SearchService } from '../search/search.service';
import { UserService } from '../user/user.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';

@Injectable()
export class RfaService {
  private readonly logger = new Logger(RfaService.name);

  constructor(
    @InjectRepository(Rfa)
    private rfaRepo: Repository<Rfa>,
    @InjectRepository(RfaRevision)
    private rfaRevisionRepo: Repository<RfaRevision>,
    @InjectRepository(RfaItem)
    private rfaItemRepo: Repository<RfaItem>,
    @InjectRepository(Correspondence)
    private correspondenceRepo: Repository<Correspondence>,
    @InjectRepository(RfaType)
    private rfaTypeRepo: Repository<RfaType>,
    @InjectRepository(RfaStatusCode)
    private rfaStatusRepo: Repository<RfaStatusCode>,
    @InjectRepository(RfaApproveCode)
    private rfaApproveRepo: Repository<RfaApproveCode>,
    @InjectRepository(ShopDrawingRevision)
    private shopDrawingRevRepo: Repository<ShopDrawingRevision>,
    @InjectRepository(CorrespondenceRouting)
    private routingRepo: Repository<CorrespondenceRouting>,
    @InjectRepository(RoutingTemplate)
    private templateRepo: Repository<RoutingTemplate>,

    private numberingService: DocumentNumberingService,
    private userService: UserService,
    private workflowEngine: WorkflowEngineService,
    private notificationService: NotificationService,
    private dataSource: DataSource,
    private searchService: SearchService
  ) {}

  async create(createDto: CreateRfaDto, user: User) {
    const rfaType = await this.rfaTypeRepo.findOne({
      where: { id: createDto.rfaTypeId },
    });
    if (!rfaType) throw new NotFoundException('RFA Type not found');

    const statusDraft = await this.rfaStatusRepo.findOne({
      where: { statusCode: 'DFT' },
    });
    if (!statusDraft) {
      throw new InternalServerErrorException(
        'Status DFT (Draft) not found in Master Data'
      );
    }

    // Determine User Organization
    let userOrgId = user.primaryOrganizationId;
    if (!userOrgId) {
      const fullUser = await this.userService.findOne(user.user_id);
      if (fullUser) userOrgId = fullUser.primaryOrganizationId;
    }
    if (!userOrgId) {
      throw new BadRequestException('User must belong to an organization');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const orgCode = 'ORG'; // TODO: Fetch real ORG Code from Org Service if needed

      // [UPDATED] Generate Document Number with Discipline
      const docNumber = await this.numberingService.generateNextNumber({
        projectId: createDto.projectId,
        originatorId: userOrgId,
        typeId: createDto.rfaTypeId,
        disciplineId: createDto.disciplineId ?? 0, // ✅ ส่ง disciplineId ไปด้วย (0 ถ้าไม่มี)
        year: new Date().getFullYear(),
        customTokens: {
          TYPE_CODE: rfaType.typeCode,
          ORG_CODE: orgCode,
        },
      });

      // 1. Create Correspondence Record
      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber,
        correspondenceTypeId: createDto.rfaTypeId,
        projectId: createDto.projectId,
        originatorId: userOrgId,
        isInternal: false,
        createdBy: user.user_id,
        disciplineId: createDto.disciplineId, // ✅ Add disciplineId
      });
      const savedCorr = await queryRunner.manager.save(correspondence);

      // 2. Create Rfa Master Record
      const rfa = queryRunner.manager.create(Rfa, {
        rfaTypeId: createDto.rfaTypeId,
        createdBy: user.user_id,
        disciplineId: createDto.disciplineId, // ✅ Add disciplineId
      });
      const savedRfa = await queryRunner.manager.save(rfa);

      // 3. Create First Revision (Draft)
      const rfaRevision = queryRunner.manager.create(RfaRevision, {
        correspondenceId: savedCorr.id,
        rfaId: savedRfa.id,
        revisionNumber: 0,
        revisionLabel: '0',
        isCurrent: true,
        rfaStatusCodeId: statusDraft.id,
        title: createDto.title,
        description: createDto.description,
        documentDate: createDto.documentDate
          ? new Date(createDto.documentDate)
          : new Date(),
        createdBy: user.user_id,
        details: createDto.details,
        schemaVersion: 1,
      });
      const savedRevision = await queryRunner.manager.save(rfaRevision);

      // 4. Link Shop Drawings
      if (
        createDto.shopDrawingRevisionIds &&
        createDto.shopDrawingRevisionIds.length > 0
      ) {
        const shopDrawings = await this.shopDrawingRevRepo.findBy({
          id: In(createDto.shopDrawingRevisionIds),
        });

        if (shopDrawings.length !== createDto.shopDrawingRevisionIds.length) {
          throw new NotFoundException('Some Shop Drawing Revisions not found');
        }

        const rfaItems = shopDrawings.map((sd) =>
          queryRunner.manager.create(RfaItem, {
            rfaRevisionId: savedCorr.id, // Use Correspondence ID as per schema
            shopDrawingRevisionId: sd.id,
          })
        );
        await queryRunner.manager.save(rfaItems);
      }

      await queryRunner.commitTransaction();

      // [NEW V1.5.1] Start Unified Workflow Instance
      try {
        const workflowCode = `RFA_${rfaType.typeCode}`; // e.g., RFA_GEN
        await this.workflowEngine.createInstance(
          workflowCode,
          'rfa',
          savedRfa.id.toString(),
          {
            projectId: createDto.projectId,
            originatorId: userOrgId,
            disciplineId: createDto.disciplineId,
            initiatorId: user.user_id,
          }
        );
      } catch (error) {
        this.logger.warn(
          `Workflow not started for ${docNumber}: ${(error as Error).message}`
        );
      }

      // Indexing for Search
      this.searchService
        .indexDocument({
          id: savedCorr.id,
          type: 'rfa',
          docNumber: docNumber,
          title: createDto.title,
          description: createDto.description,
          status: 'DRAFT',
          projectId: createDto.projectId,
          createdAt: new Date(),
        })
        .catch((err) => this.logger.error(`Indexing failed: ${err}`));

      return {
        ...savedRfa,
        correspondenceNumber: docNumber,
        currentRevision: savedRevision,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create RFA: ${(err as Error).message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ... (ส่วน findOne, submit, processAction คงเดิมจากไฟล์ที่แนบมา แค่ปรับปรุงเล็กน้อยตาม Context) ...

  async findOne(id: number) {
    const rfa = await this.rfaRepo.findOne({
      where: { id },
      relations: [
        'rfaType',
        'revisions',
        'revisions.statusCode',
        'revisions.approveCode',
        'revisions.correspondence',
        'revisions.items',
        'revisions.items.shopDrawingRevision',
        'revisions.items.shopDrawingRevision.shopDrawing',
      ],
      order: {
        revisions: { revisionNumber: 'DESC' },
      },
    });

    if (!rfa) {
      throw new NotFoundException(`RFA ID ${id} not found`);
    }

    return rfa;
  }

  async submit(rfaId: number, templateId: number, user: User) {
    const rfa = await this.findOne(rfaId);
    const currentRevision = rfa.revisions.find((r) => r.isCurrent);

    if (!currentRevision)
      throw new NotFoundException('Current revision not found');
    if (currentRevision.statusCode.statusCode !== 'DFT') {
      throw new BadRequestException('Only DRAFT documents can be submitted');
    }

    const template = await this.templateRepo.findOne({
      where: { id: templateId },
      relations: ['steps'],
      order: { steps: { sequence: 'ASC' } },
    });

    if (!template || !template.steps || template.steps.length === 0) {
      throw new BadRequestException('Invalid routing template');
    }

    const statusForApprove = await this.rfaStatusRepo.findOne({
      where: { statusCode: 'FAP' },
    });
    if (!statusForApprove)
      throw new InternalServerErrorException('Status FAP not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update Revision Status
      currentRevision.rfaStatusCodeId = statusForApprove.id;
      currentRevision.issuedDate = new Date();
      await queryRunner.manager.save(currentRevision);

      // Create First Routing Step
      const firstStep = template.steps[0];
      const routing = queryRunner.manager.create(CorrespondenceRouting, {
        correspondenceId: currentRevision.correspondenceId,
        templateId: template.id,
        sequence: 1,
        fromOrganizationId: user.primaryOrganizationId,
        toOrganizationId: firstStep.toOrganizationId,
        stepPurpose: firstStep.stepPurpose,
        status: 'SENT',
        dueDate: new Date(
          Date.now() + (firstStep.expectedDays || 7) * 24 * 60 * 60 * 1000
        ),
        processedByUserId: user.user_id,
        processedAt: new Date(),
      });
      await queryRunner.manager.save(routing);

      // Notify
      const recipientUserId = await this.userService.findDocControlIdByOrg(
        firstStep.toOrganizationId
      );
      if (recipientUserId) {
        await this.notificationService.send({
          userId: recipientUserId,
          title: `RFA Submitted: ${currentRevision.title}`,
          message: `RFA ${currentRevision.correspondence.correspondenceNumber} submitted for approval.`,
          type: 'SYSTEM',
          entityType: 'rfa',
          entityId: rfa.id,
        });
      }

      await queryRunner.commitTransaction();
      return { message: 'RFA Submitted successfully', routing };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async processAction(rfaId: number, dto: WorkflowActionDto, user: User) {
    // Logic คงเดิม: หา Current Routing -> Check Permission -> Call Workflow Engine -> Update DB
    // ใช้ this.workflowEngine.processAction (Legacy Support)
    // ... (สามารถใช้ Code เดิมจากที่คุณแนบมาได้เลย เพราะ Logic ถูกต้องแล้วสำหรับการใช้ CorrespondenceRouting) ...
    const rfa = await this.findOne(rfaId);
    const currentRevision = rfa.revisions.find((r) => r.isCurrent);
    if (!currentRevision)
      throw new NotFoundException('Current revision not found');

    const currentRouting = await this.routingRepo.findOne({
      where: {
        correspondenceId: currentRevision.correspondenceId,
        status: 'SENT',
      },
      order: { sequence: 'DESC' },
      relations: ['toOrganization'],
    });

    if (!currentRouting)
      throw new BadRequestException('No active workflow step found');
    if (currentRouting.toOrganizationId !== user.primaryOrganizationId) {
      throw new ForbiddenException(
        'You are not authorized to process this step'
      );
    }

    const template = await this.templateRepo.findOne({
      where: { id: currentRouting.templateId },
      relations: ['steps'],
    });

    if (!template || !template.steps)
      throw new InternalServerErrorException('Template not found');

    // Call Engine to calculate next step
    const result = this.workflowEngine.processAction(
      currentRouting.sequence,
      template.steps.length,
      dto.action,
      dto.returnToSequence
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update current routing
      currentRouting.status =
        dto.action === WorkflowAction.REJECT ? 'REJECTED' : 'ACTIONED';
      currentRouting.processedByUserId = user.user_id;
      currentRouting.processedAt = new Date();
      currentRouting.comments = dto.comments;
      await queryRunner.manager.save(currentRouting);

      // Create next routing if available
      if (result.nextStepSequence && dto.action !== WorkflowAction.REJECT) {
        const nextStep = template.steps.find(
          (s) => s.sequence === result.nextStepSequence
        );
        if (nextStep) {
          const nextRouting = queryRunner.manager.create(
            CorrespondenceRouting,
            {
              correspondenceId: currentRevision.correspondenceId,
              templateId: template.id,
              sequence: result.nextStepSequence,
              fromOrganizationId: user.primaryOrganizationId,
              toOrganizationId: nextStep.toOrganizationId,
              stepPurpose: nextStep.stepPurpose,
              status: 'SENT',
              dueDate: new Date(
                Date.now() + (nextStep.expectedDays || 7) * 24 * 60 * 60 * 1000
              ),
            }
          );
          await queryRunner.manager.save(nextRouting);
        }
      } else if (result.nextStepSequence === null) {
        // Workflow Ended (Completed or Rejected)
        // Update RFA Status (Approved/Rejected Code)
        if (dto.action !== WorkflowAction.REJECT) {
          const approveCode = await this.rfaApproveRepo.findOne({
            where: {
              approveCode: dto.action === WorkflowAction.APPROVE ? '1A' : '4X',
            },
          }); // Logic Map Code อย่างง่าย
          if (approveCode) {
            currentRevision.rfaApproveCodeId = approveCode.id;
            currentRevision.approvedDate = new Date();
          }
        } else {
          const rejectCode = await this.rfaApproveRepo.findOne({
            where: { approveCode: '4X' },
          });
          if (rejectCode) currentRevision.rfaApproveCodeId = rejectCode.id;
        }
        await queryRunner.manager.save(currentRevision);
      }

      await queryRunner.commitTransaction();
      return { message: 'Action processed', result };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
