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
import { CorrespondenceRecipient } from '../correspondence/entities/correspondence-recipient.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { RoutingTemplate } from '../correspondence/entities/routing-template.entity';
import { RoutingTemplateStep } from '../correspondence/entities/routing-template-step.entity';
import { AsBuiltDrawingRevision } from '../drawing/entities/asbuilt-drawing-revision.entity';
import { ShopDrawingRevision } from '../drawing/entities/shop-drawing-revision.entity';
import { Discipline } from '../master/entities/discipline.entity';
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
import { SearchRfaDto } from './dto/search-rfa.dto';

// ------- Local type helpers (no-any ADR-019) -------
/** CorrespondenceRevision with the rfaRevision relation loaded at runtime */
type CorrRevWithRfa = CorrespondenceRevision & { rfaRevision?: RfaRevision };

/** RFA entity + a flat `revisions` convenience array for the frontend */
export interface RfaMapped extends Rfa {
  uuid?: string; // ADR-019: top-level UUID from correspondence
  revisions: CorrRevWithRfa[];
}

// Interfaces & Enums
import { WorkflowAction } from '../workflow-engine/interfaces/workflow.interface';

// Services
import { DocumentNumberingService } from '../document-numbering/services/document-numbering.service';
import { NotificationService } from '../notification/notification.service';
import { SearchService } from '../search/search.service';
import { UserService } from '../user/user.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';

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
    @InjectRepository(CorrespondenceRevision)
    private corrRevRepo: Repository<CorrespondenceRevision>,
    @InjectRepository(CorrespondenceStatus)
    private corrStatusRepo: Repository<CorrespondenceStatus>,
    @InjectRepository(CorrespondenceType)
    private correspondenceTypeRepo: Repository<CorrespondenceType>,
    @InjectRepository(Discipline)
    private disciplineRepo: Repository<Discipline>,
    @InjectRepository(RfaStatusCode)
    private rfaStatusRepo: Repository<RfaStatusCode>,
    @InjectRepository(RfaApproveCode)
    private rfaApproveRepo: Repository<RfaApproveCode>,
    @InjectRepository(AsBuiltDrawingRevision)
    private asBuiltDrawingRevRepo: Repository<AsBuiltDrawingRevision>,
    @InjectRepository(ShopDrawingRevision)
    private shopDrawingRevRepo: Repository<ShopDrawingRevision>,
    @InjectRepository(CorrespondenceRouting)
    private routingRepo: Repository<CorrespondenceRouting>,
    @InjectRepository(RoutingTemplate)
    private templateRepo: Repository<RoutingTemplate>,
    @InjectRepository(RoutingTemplateStep)
    private templateStepRepo: Repository<RoutingTemplateStep>,

    private numberingService: DocumentNumberingService,
    private userService: UserService,
    private workflowEngine: WorkflowEngineService,
    private notificationService: NotificationService,
    private dataSource: DataSource,
    private searchService: SearchService,
    private uuidResolver: UuidResolverService
  ) {}

  async create(createDto: CreateRfaDto, user: User) {
    // ADR-019: Resolve UUID→INT for projectId
    const internalProjectId = await this.uuidResolver.resolveProjectId(
      createDto.projectId
    );

    const rfaType = await this.rfaTypeRepo.findOne({
      where: { id: createDto.rfaTypeId },
    });
    if (!rfaType) throw new NotFoundException('RFA Type not found');

    const rfaTypeCode = rfaType.typeCode.toUpperCase();
    const rawShopDrawingRefs = createDto.shopDrawingRevisionIds ?? [];
    const rawAsBuiltDrawingRefs = createDto.asBuiltDrawingRevisionIds ?? [];

    if (['DDW', 'SDW'].includes(rfaTypeCode)) {
      if (rawShopDrawingRefs.length === 0) {
        throw new BadRequestException(
          'Selected RFA Type requires at least one Shop Drawing Revision'
        );
      }

      if (rawAsBuiltDrawingRefs.length > 0) {
        throw new BadRequestException(
          'Selected RFA Type cannot reference As-Built Drawing Revisions'
        );
      }
    } else if (rfaTypeCode === 'ADW') {
      if (rawAsBuiltDrawingRefs.length === 0) {
        throw new BadRequestException(
          'Selected RFA Type requires at least one As-Built Drawing Revision'
        );
      }

      if (rawShopDrawingRefs.length > 0) {
        throw new BadRequestException(
          'Selected RFA Type cannot reference Shop Drawing Revisions'
        );
      }
    } else if (
      rawShopDrawingRefs.length > 0 ||
      rawAsBuiltDrawingRefs.length > 0
    ) {
      throw new BadRequestException(
        'Selected RFA Type does not support drawing revision items'
      );
    }

    const shopDrawingRevisionIds = Array.from(
      new Set(
        await Promise.all(
          rawShopDrawingRefs.map((ref) =>
            this.uuidResolver.resolveShopDrawingRevisionId(ref)
          )
        )
      )
    );

    const asBuiltDrawingRevisionIds = Array.from(
      new Set(
        await Promise.all(
          rawAsBuiltDrawingRefs.map((ref) =>
            this.uuidResolver.resolveAsBuiltDrawingRevisionId(ref)
          )
        )
      )
    );

    const correspondenceType = await this.correspondenceTypeRepo.findOne({
      where: { typeCode: 'RFA', isActive: true },
    });
    if (!correspondenceType) {
      throw new InternalServerErrorException(
        'Correspondence Type RFA not found in Master Data'
      );
    }

    const internalContractId = createDto.contractId
      ? await this.uuidResolver.resolveContractId(createDto.contractId)
      : rfaType.contractId;

    if (rfaType.contractId !== internalContractId) {
      throw new BadRequestException(
        'Selected RFA Type does not belong to the selected contract'
      );
    }

    if (createDto.disciplineId) {
      const discipline = await this.disciplineRepo.findOne({
        where: { id: createDto.disciplineId },
      });

      if (!discipline) {
        throw new NotFoundException('Discipline not found');
      }

      if (discipline.contractId !== internalContractId) {
        throw new BadRequestException(
          'Selected Discipline does not belong to the selected contract'
        );
      }
    }

    const internalRecipientOrgId = createDto.toOrganizationId
      ? await this.uuidResolver.resolveOrganizationId(
          createDto.toOrganizationId
        )
      : undefined;

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
        projectId: internalProjectId,
        originatorOrganizationId: userOrgId,
        recipientOrganizationId: internalRecipientOrgId,
        typeId: correspondenceType.id,
        rfaTypeId: createDto.rfaTypeId,
        disciplineId: createDto.disciplineId ?? 0, // ✅ ส่ง disciplineId ไปด้วย (0 ถ้าไม่มี)
        year: new Date().getFullYear(),
        customTokens: {
          TYPE_CODE: rfaType.typeCode,
          ORG_CODE: orgCode,
        },
      });

      // Get Generic Draft Status for Correspondence
      const corrStatusDraft = await queryRunner.manager.findOne(
        CorrespondenceStatus,
        {
          where: { statusCode: 'DRAFT' },
        }
      );
      if (!corrStatusDraft)
        throw new InternalServerErrorException(
          'Correspondence Status DRAFT not found'
        );

      // 1. Create Correspondence Record
      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber.number,
        correspondenceTypeId: correspondenceType.id,
        projectId: internalProjectId,
        originatorId: userOrgId,
        isInternal: false,
        createdBy: user.user_id,
        disciplineId: createDto.disciplineId, // ✅ Add disciplineId
      });
      const savedCorr = await queryRunner.manager.save(correspondence);

      if (internalRecipientOrgId) {
        const recipient = queryRunner.manager.create(CorrespondenceRecipient, {
          correspondenceId: savedCorr.id,
          recipientOrganizationId: internalRecipientOrgId,
          recipientType: 'TO',
        });
        await queryRunner.manager.save(recipient);
      }

      // 2. Create Rfa Master Record
      const rfa = queryRunner.manager.create(Rfa, {
        id: savedCorr.id, // ✅ CTI Key share
        rfaTypeId: createDto.rfaTypeId,
        createdBy: user.user_id,
      });
      const savedRfa = await queryRunner.manager.save(rfa);

      // 3. Create First Correspondence Revision
      const corrRevision = queryRunner.manager.create(CorrespondenceRevision, {
        correspondenceId: savedCorr.id,
        revisionNumber: 0,
        revisionLabel: '0',
        isCurrent: true,
        statusId: corrStatusDraft.id,
        subject: createDto.subject,
        body: createDto.body,
        remarks: createDto.remarks,
        description: createDto.description,
        documentDate: createDto.documentDate
          ? new Date(createDto.documentDate)
          : new Date(),
        dueDate: createDto.dueDate ? new Date(createDto.dueDate) : undefined,
        createdBy: user.user_id,
        schemaVersion: 1,
      });
      const savedCorrRev = await queryRunner.manager.save(corrRevision);

      // 4. Create First RFA Revision (CTI Extends CorrespondenceRevision)
      const rfaRevision = queryRunner.manager.create(RfaRevision, {
        id: savedCorrRev.id, // ✅ Matches correspondence revision id
        rfaStatusCodeId: statusDraft.id,
        details: createDto.details,
        schemaVersion: 1,
      });
      const savedRevision = await queryRunner.manager.save(rfaRevision);

      const rfaItems: RfaItem[] = [];

      if (shopDrawingRevisionIds.length > 0) {
        const shopDrawings = await this.shopDrawingRevRepo.findBy({
          id: In(shopDrawingRevisionIds),
        });

        if (shopDrawings.length !== shopDrawingRevisionIds.length) {
          throw new NotFoundException('Some Shop Drawing Revisions not found');
        }

        rfaItems.push(
          ...shopDrawings.map((sd) =>
            queryRunner.manager.create(RfaItem, {
              rfaRevisionId: savedRevision.id,
              itemType: 'SHOP',
              shopDrawingRevisionId: sd.id,
            })
          )
        );
      }

      if (asBuiltDrawingRevisionIds.length > 0) {
        const asBuiltDrawings = await this.asBuiltDrawingRevRepo.findBy({
          id: In(asBuiltDrawingRevisionIds),
        });

        if (asBuiltDrawings.length !== asBuiltDrawingRevisionIds.length) {
          throw new NotFoundException(
            'Some As-Built Drawing Revisions not found'
          );
        }

        rfaItems.push(
          ...asBuiltDrawings.map((ad) =>
            queryRunner.manager.create(RfaItem, {
              rfaRevisionId: savedRevision.id,
              itemType: 'AS_BUILT',
              asBuiltDrawingRevisionId: ad.id,
            })
          )
        );
      }

      if (rfaItems.length > 0) {
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
            projectId: internalProjectId,
            originatorId: userOrgId,
            disciplineId: createDto.disciplineId,
            initiatorId: user.user_id,
          }
        );
      } catch (error) {
        this.logger.warn(
          `Workflow not started for ${docNumber.number}: ${(error as Error).message}`
        );
      }

      // Indexing for Search
      this.searchService
        .indexDocument({
          id: savedCorr.id,
          uuid: savedCorr.uuid, // ADR-019: index UUID for search
          type: 'rfa',
          docNumber: docNumber.number,
          title: createDto.subject,
          description: createDto.description,
          status: 'DRAFT',
          projectId: internalProjectId,
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

  async findAll(query: SearchRfaDto) {
    const {
      page = 1,
      limit = 20,
      projectId,
      search,
      revisionStatus = 'CURRENT',
      statusCode,
    } = query;
    const skip = (page - 1) * limit;

    // Fix: Start query from Rfa entity instead of Correspondence,
    // because Correspondence has no 'rfas' relation.
    const queryBuilder = this.rfaRepo
      .createQueryBuilder('rfa')
      .leftJoinAndSelect('rfa.correspondence', 'corr')
      .leftJoinAndSelect('corr.revisions', 'corrRev')
      .leftJoinAndSelect('corrRev.rfaRevision', 'rfaRev')
      .leftJoinAndSelect('corr.project', 'project')
      .leftJoinAndSelect('corr.discipline', 'discipline')
      .leftJoinAndSelect('rfaRev.statusCode', 'status')
      .leftJoinAndSelect('rfaRev.items', 'items')
      .leftJoinAndSelect('items.shopDrawingRevision', 'sdRev')
      .leftJoinAndSelect('sdRev.shopDrawing', 'shopDrawing')
      .leftJoinAndSelect('sdRev.attachments', 'shopAttachments')
      .leftJoinAndSelect('items.asBuiltDrawingRevision', 'adRev')
      .leftJoinAndSelect('adRev.asBuiltDrawing', 'asBuiltDrawing')
      .leftJoinAndSelect('adRev.attachments', 'asBuiltAttachments');

    // Filter by Revision Status (from query param 'revisionStatus')
    if (revisionStatus === 'CURRENT') {
      queryBuilder.where('corrRev.isCurrent = :isCurrent', { isCurrent: true });
    } else if (revisionStatus === 'OLD') {
      queryBuilder.where('corrRev.isCurrent = :isCurrent', {
        isCurrent: false,
      });
    }
    // If 'ALL', no filter

    if (projectId) {
      queryBuilder.andWhere('corr.projectId = :projectId', { projectId });
    }

    if (statusCode) {
      queryBuilder.andWhere('status.statusCode = :statusCode', { statusCode });
    }

    if (search) {
      queryBuilder.andWhere(
        '(corr.correspondenceNumber LIKE :search OR corrRev.subject LIKE :search)',
        { search: `%${search}%` }
      );
    }

    const [items, total] = await queryBuilder
      .orderBy('corr.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    this.logger.log(
      `[DEBUG] RFA findAll: Found ${total} items. Query: ${JSON.stringify(query)}`
    );

    // Map `revisions` property back to the expected payload for the frontend
    const mappedItems: RfaMapped[] = items.map((rfa) => {
      const revisions =
        (rfa.correspondence?.revisions as CorrRevWithRfa[] | undefined) ?? [];
      return {
        ...rfa,
        uuid: rfa.correspondence?.uuid, // ADR-019: expose UUID at top level
        revisions: revisions.map((cr) => ({
          ...cr,
          ...(cr.rfaRevision ?? {}),
          id: cr.rfaRevision?.id ?? cr.id,
        })) as CorrRevWithRfa[],
      };
    });

    return {
      data: mappedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ADR-019: Find RFA by the parent Correspondence UUID (public identifier).
   * Resolves correspondence.uuid → internal rfa.id
   */
  async findOneByUuid(uuid: string) {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { uuid },
      select: ['id'],
    });
    if (!correspondence) {
      throw new NotFoundException(`RFA with UUID ${uuid} not found`);
    }
    return this.findOne(correspondence.id);
  }

  async findOneByUuidRaw(uuid: string) {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { uuid },
      select: ['id'],
    });
    if (!correspondence) {
      throw new NotFoundException(`RFA with UUID ${uuid} not found`);
    }
    return this.findOne(correspondence.id, true);
  }

  async findOne(id: number, rawEntities = false) {
    const rfa = await this.rfaRepo.findOne({
      where: { id },
      relations: [
        'correspondence',
        'rfaType',
        'correspondence.revisions',
        'correspondence.revisions.rfaRevision',
        'correspondence.revisions.rfaRevision.statusCode',
        'correspondence.revisions.rfaRevision.approveCode',
        'correspondence.revisions.rfaRevision.items',
        'correspondence.revisions.rfaRevision.items.shopDrawingRevision',
        'correspondence.revisions.rfaRevision.items.shopDrawingRevision.shopDrawing',
        'correspondence.revisions.rfaRevision.items.shopDrawingRevision.attachments',
        'correspondence.revisions.rfaRevision.items.asBuiltDrawingRevision',
        'correspondence.revisions.rfaRevision.items.asBuiltDrawingRevision.asBuiltDrawing',
        'correspondence.revisions.rfaRevision.items.asBuiltDrawingRevision.attachments',
      ],
      order: {
        correspondence: { revisions: { revisionNumber: 'DESC' } },
      },
    });

    if (!rfa) {
      throw new NotFoundException(`RFA ID ${id} not found`);
    }

    if (rawEntities) {
      return rfa;
    }

    // Map to structure expected by frontend DTO
    const revisions =
      (rfa.correspondence?.revisions as CorrRevWithRfa[] | undefined) ?? [];
    const mappedRfa: RfaMapped = {
      ...rfa,
      uuid: rfa.correspondence?.uuid, // ADR-019: expose UUID at top level
      revisions: revisions.map((cr) => ({
        ...cr,
        ...(cr.rfaRevision ?? {}),
        id: cr.rfaRevision?.id ?? cr.id,
      })) as CorrRevWithRfa[],
    };

    return mappedRfa;
  }

  async submit(rfaId: number, templateId: number, user: User) {
    const rfa = await this.findOne(rfaId, true);
    const corrRevisions =
      (rfa.correspondence?.revisions as CorrRevWithRfa[] | undefined) ?? [];
    const currentCorrRev = corrRevisions.find((r) => r.isCurrent);
    if (!currentCorrRev || !currentCorrRev.rfaRevision)
      throw new NotFoundException('Current revision not found');

    const currentRfaRev = currentCorrRev.rfaRevision;

    if (currentRfaRev.statusCode.statusCode !== 'DFT') {
      throw new BadRequestException('Only DRAFT documents can be submitted');
    }

    const template = await this.templateRepo.findOne({
      where: { id: templateId },
      // relations: ['steps'], // Deprecated relation removed
    });

    if (!template) {
      throw new BadRequestException('Invalid routing template');
    }

    // Manual fetch of steps
    const steps = await this.templateStepRepo.find({
      where: { templateId: template.id },
      order: { sequence: 'ASC' },
    });

    if (steps.length === 0) {
      throw new BadRequestException('Routing template has no steps');
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
      currentRfaRev.rfaStatusCodeId = statusForApprove.id;
      currentCorrRev.issuedDate = new Date();
      await queryRunner.manager.save(currentRfaRev);
      await queryRunner.manager.save(currentCorrRev);

      // Create First Routing Step
      const firstStep = steps[0];
      const routing = queryRunner.manager.create(CorrespondenceRouting, {
        correspondenceId: rfa.correspondence.id, // ✅ Use master correspondence id
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
          title: `RFA Submitted: ${currentCorrRev.subject}`,
          message: `RFA ${rfa.correspondence.correspondenceNumber} submitted for approval.`,
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
    const rfa = await this.findOne(rfaId, true);
    const corrRevisions =
      (rfa.correspondence?.revisions as CorrRevWithRfa[] | undefined) ?? [];
    const currentCorrRev = corrRevisions.find((r) => r.isCurrent);
    if (!currentCorrRev || !currentCorrRev.rfaRevision)
      throw new NotFoundException('Current revision not found');

    const currentRfaRev = currentCorrRev.rfaRevision;

    const currentRouting = await this.routingRepo.findOne({
      where: {
        correspondenceId: rfa.correspondence.id, // ✅ Use master correspondence id
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
      // relations: ['steps'],
    });

    if (!template) throw new InternalServerErrorException('Template not found');

    // Manual fetch steps
    const steps = await this.templateStepRepo.find({
      where: { templateId: template.id },
      order: { sequence: 'ASC' },
    });

    if (steps.length === 0)
      throw new InternalServerErrorException('Template steps not found');

    // Call Engine to calculate next step
    const result = this.workflowEngine.processAction(
      currentRouting.sequence,
      steps.length,
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
        const nextStep = steps.find(
          (s) => s.sequence === result.nextStepSequence
        );
        if (nextStep) {
          const nextRouting = queryRunner.manager.create(
            CorrespondenceRouting,
            {
              correspondenceId: rfa.correspondence.id, // ✅ Use master correspondence id
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
            currentRfaRev.rfaApproveCodeId = approveCode.id;
            currentRfaRev.approvedDate = new Date();
          }
        } else {
          const rejectCode = await this.rfaApproveRepo.findOne({
            where: { approveCode: '4X' },
          });
          if (rejectCode) currentRfaRev.rfaApproveCodeId = rejectCode.id;
        }
        await queryRunner.manager.save(currentRfaRev);
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
