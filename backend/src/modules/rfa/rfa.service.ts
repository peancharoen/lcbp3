// File: src/modules/rfa/rfa.service.ts

import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';

// Entities
import { Rfa } from './entities/rfa.entity.js';
import { RfaRevision } from './entities/rfa-revision.entity.js';
import { RfaItem } from './entities/rfa-item.entity.js';
import { RfaType } from './entities/rfa-type.entity.js';
import { RfaStatusCode } from './entities/rfa-status-code.entity.js';
import { RfaApproveCode } from './entities/rfa-approve-code.entity.js';
import { Correspondence } from '../correspondence/entities/correspondence.entity.js';
import { CorrespondenceRouting } from '../correspondence/entities/correspondence-routing.entity.js';
import { RoutingTemplate } from '../correspondence/entities/routing-template.entity.js';
import { ShopDrawingRevision } from '../drawing/entities/shop-drawing-revision.entity.js';
import { User } from '../user/entities/user.entity.js';

// DTOs
import { CreateRfaDto } from './dto/create-rfa.dto.js';
import { WorkflowActionDto } from '../correspondence/dto/workflow-action.dto.js';

// Interfaces & Enums
import { WorkflowAction } from '../workflow-engine/interfaces/workflow.interface.js';

// Services
import { DocumentNumberingService } from '../document-numbering/document-numbering.service.js';
import { UserService } from '../user/user.service.js';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { SearchService } from '../search/search.service.js';

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
    private searchService: SearchService,
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
        'Status DFT (Draft) not found in Master Data',
      );
    }

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
      const orgCode = 'ORG'; // TODO: Fetch real ORG Code

      // [FIXED] เรียกใช้แบบ Object Context พร้อม disciplineId
      const docNumber = await this.numberingService.generateNextNumber({
        projectId: createDto.projectId,
        originatorId: userOrgId,
        typeId: createDto.rfaTypeId, // RFA Type ใช้เป็น ID ในการนับเลข
        disciplineId: createDto.disciplineId, // สำคัญมากสำหรับ RFA (Req 6B)
        year: new Date().getFullYear(),
        customTokens: {
          TYPE_CODE: rfaType.typeCode,
          ORG_CODE: orgCode,
        },
      });

      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber,
        correspondenceTypeId: createDto.rfaTypeId, // Map RFA Type to Corr Type ID
        disciplineId: createDto.disciplineId, // บันทึก Discipline
        projectId: createDto.projectId,
        originatorId: userOrgId,
        isInternal: false,
        createdBy: user.user_id,
      });
      const savedCorr = await queryRunner.manager.save(correspondence);

      const rfa = queryRunner.manager.create(Rfa, {
        rfaTypeId: createDto.rfaTypeId,
        disciplineId: createDto.disciplineId, // บันทึก Discipline
        createdBy: user.user_id,
      });
      const savedRfa = await queryRunner.manager.save(rfa);

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
      });
      const savedRevision = await queryRunner.manager.save(rfaRevision);

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
            rfaRevisionId: savedCorr.id,
            shopDrawingRevisionId: sd.id,
          }),
        );
        await queryRunner.manager.save(rfaItems);
      }

      await queryRunner.commitTransaction();

      this.searchService.indexDocument({
        id: savedCorr.id,
        type: 'correspondence',
        docNumber: docNumber,
        title: createDto.title,
        description: createDto.description,
        status: 'DRAFT',
        projectId: createDto.projectId,
        createdAt: new Date(),
      });

      return {
        ...savedRfa,
        currentRevision: {
          ...savedRevision,
          correspondenceNumber: docNumber,
        },
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create RFA: ${(err as Error).message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ... (method อื่นๆ findOne, submit, processAction คงเดิม)
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

    if (!currentRevision) {
      throw new NotFoundException('Current revision not found');
    }

    if (!currentRevision.correspondence) {
      throw new InternalServerErrorException('Correspondence relation missing');
    }

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
    if (!statusForApprove) {
      throw new InternalServerErrorException('Status FAP not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      currentRevision.rfaStatusCodeId = statusForApprove.id;
      currentRevision.issuedDate = new Date();
      await queryRunner.manager.save(currentRevision);

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
          Date.now() + (firstStep.expectedDays || 7) * 24 * 60 * 60 * 1000,
        ),
        processedByUserId: user.user_id,
        processedAt: new Date(),
      });
      await queryRunner.manager.save(routing);

      const recipientUserId = await this.userService.findDocControlIdByOrg(
        firstStep.toOrganizationId,
      );

      if (recipientUserId) {
        const docNo = currentRevision.correspondence.correspondenceNumber;
        await this.notificationService.send({
          userId: recipientUserId,
          title: `RFA Submitted: ${currentRevision.title}`,
          message: `มีเอกสาร RFA ใหม่รอการตรวจสอบจากคุณ (เลขที่: ${docNo})`,
          type: 'SYSTEM',
          entityType: 'rfa',
          entityId: rfa.id,
          link: `/rfas/${rfa.id}`,
        });
      }

      await queryRunner.commitTransaction();
      return { message: 'RFA Submitted successfully', routing };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to submit RFA: ${(err as Error).message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async processAction(rfaId: number, dto: WorkflowActionDto, user: User) {
    const rfa = await this.findOne(rfaId);
    const currentRevision = rfa.revisions.find((r) => r.isCurrent);
    if (!currentRevision) {
      throw new NotFoundException('Current revision not found');
    }

    const currentRouting = await this.routingRepo.findOne({
      where: {
        correspondenceId: currentRevision.correspondenceId,
        status: 'SENT',
      },
      order: { sequence: 'DESC' },
      relations: ['toOrganization'],
    });

    if (!currentRouting) {
      throw new BadRequestException('No active workflow step found');
    }

    if (currentRouting.toOrganizationId !== user.primaryOrganizationId) {
      throw new ForbiddenException(
        'You are not authorized to process this step',
      );
    }

    const template = await this.templateRepo.findOne({
      where: { id: currentRouting.templateId },
      relations: ['steps'],
    });

    if (!template || !template.steps) {
      throw new InternalServerErrorException('Template or steps not found');
    }

    const result = this.workflowEngine.processAction(
      currentRouting.sequence,
      template.steps.length,
      dto.action,
      dto.returnToSequence,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      currentRouting.status =
        dto.action === WorkflowAction.REJECT ? 'REJECTED' : 'ACTIONED';
      currentRouting.processedByUserId = user.user_id;
      currentRouting.processedAt = new Date();
      currentRouting.comments = dto.comments;
      await queryRunner.manager.save(currentRouting);

      if (result.nextStepSequence && dto.action !== WorkflowAction.REJECT) {
        const nextStepConfig = template.steps.find(
          (s) => s.sequence === result.nextStepSequence,
        );

        if (nextStepConfig) {
          const nextRouting = queryRunner.manager.create(
            CorrespondenceRouting,
            {
              correspondenceId: currentRevision.correspondenceId,
              templateId: template.id,
              sequence: result.nextStepSequence,
              fromOrganizationId: user.primaryOrganizationId,
              toOrganizationId: nextStepConfig.toOrganizationId,
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
      } else if (
        result.nextStepSequence === null &&
        dto.action !== WorkflowAction.REJECT
      ) {
        const approveCodeStr =
          dto.action === WorkflowAction.APPROVE ? '1A' : '4X';
        const approveCode = await this.rfaApproveRepo.findOne({
          where: { approveCode: approveCodeStr },
        });

        if (approveCode) {
          currentRevision.rfaApproveCodeId = approveCode.id;
          currentRevision.approvedDate = new Date();
        }
        await queryRunner.manager.save(currentRevision);
      } else if (dto.action === WorkflowAction.REJECT) {
        const rejectCode = await this.rfaApproveRepo.findOne({
          where: { approveCode: '4X' },
        });
        if (rejectCode) {
          currentRevision.rfaApproveCodeId = rejectCode.id;
        }
        await queryRunner.manager.save(currentRevision);
      }

      await queryRunner.commitTransaction();
      return { message: 'Action processed successfully', result };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to process RFA action: ${(err as Error).message}`,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}