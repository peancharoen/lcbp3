// File: src/modules/rfa/rfa.service.ts
// Change Log:
// - 2026-05-13: Invoke TaskCreationService during submit when a review team is selected.

import { Injectable, Logger } from '@nestjs/common';
import {
  BusinessException,
  NotFoundException,
  PermissionException,
  SystemException,
  ValidationException,
  WorkflowException,
} from '../../common/exceptions';
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
import { Organization } from '../organization/entities/organization.entity';
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
import { UpdateRfaDto } from './dto/update-rfa.dto';

// ------- Local type helpers (no-any ADR-019) -------
/** CorrespondenceRevision with the rfaRevision relation loaded at runtime */
type CorrRevWithRfa = CorrespondenceRevision & { rfaRevision?: RfaRevision };

/** RFA entity + a flat `revisions` convenience array for the frontend */
export interface RfaMapped extends Rfa {
  publicId?: string; // ADR-019: top-level publicId from correspondence
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
import { TaskCreationService } from '../review-team/services/task-creation.service';

@Injectable()
export class RfaService {
  private readonly logger = new Logger(RfaService.name);

  private async hasSystemManageAllPermission(userId: number): Promise<boolean> {
    const permissions = await this.userService.getUserPermissions(userId);
    return permissions.includes('system.manage_all');
  }

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
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,

    private numberingService: DocumentNumberingService,
    private userService: UserService,
    private workflowEngine: WorkflowEngineService,
    private notificationService: NotificationService,
    private taskCreationService: TaskCreationService,
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
    if (!rfaType)
      throw new NotFoundException('RFA Type', String(createDto.rfaTypeId));

    const rfaTypeCode = rfaType.typeCode.toUpperCase();
    const rawShopDrawingRefs = createDto.shopDrawingRevisionIds ?? [];
    const rawAsBuiltDrawingRefs = createDto.asBuiltDrawingRevisionIds ?? [];

    if (['DDW', 'SDW'].includes(rfaTypeCode)) {
      if (rawShopDrawingRefs.length === 0) {
        throw new ValidationException(
          'Selected RFA Type requires at least one Shop Drawing Revision'
        );
      }

      if (rawAsBuiltDrawingRefs.length > 0) {
        throw new ValidationException(
          'Selected RFA Type cannot reference As-Built Drawing Revisions'
        );
      }
    } else if (rfaTypeCode === 'ADW') {
      if (rawAsBuiltDrawingRefs.length === 0) {
        throw new ValidationException(
          'Selected RFA Type requires at least one As-Built Drawing Revision'
        );
      }

      if (rawShopDrawingRefs.length > 0) {
        throw new ValidationException(
          'Selected RFA Type cannot reference Shop Drawing Revisions'
        );
      }
    } else if (
      rawShopDrawingRefs.length > 0 ||
      rawAsBuiltDrawingRefs.length > 0
    ) {
      throw new ValidationException(
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
      throw new SystemException(
        'Correspondence Type RFA not found in Master Data'
      );
    }

    const internalContractId = createDto.contractId
      ? await this.uuidResolver.resolveContractId(createDto.contractId)
      : rfaType.contractId;

    if (rfaType.contractId !== internalContractId) {
      throw new BusinessException(
        'RFA_TYPE_CONTRACT_MISMATCH',
        'Selected RFA Type does not belong to the selected contract',
        'ประเภท RFA ที่เลือกไม่ตรงกับสัญญาที่ระบุ',
        ['เลือกประเภท RFA ที่ตรงกับสัญญา']
      );
    }

    if (createDto.disciplineId) {
      const discipline = await this.disciplineRepo.findOne({
        where: { id: createDto.disciplineId },
      });

      if (!discipline) {
        throw new NotFoundException(
          'Discipline',
          String(createDto.disciplineId)
        );
      }

      if (discipline.contractId !== internalContractId) {
        throw new BusinessException(
          'DISCIPLINE_CONTRACT_MISMATCH',
          'Selected Discipline does not belong to the selected contract',
          'Discipline ที่เลือกไม่ตรงกับสัญญาที่ระบุ',
          ['เลือก Discipline ที่ตรงกับสัญญา']
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
      throw new SystemException('Status DFT (Draft) not found in Master Data');
    }

    const resolvedOriginatorId = createDto.originatorId
      ? await this.uuidResolver.resolveOrganizationId(createDto.originatorId)
      : undefined;

    // Determine User Organization
    let userOrgId = user.primaryOrganizationId;
    if (!userOrgId) {
      const fullUser = await this.userService.findOne(user.user_id);
      if (fullUser) userOrgId = fullUser.primaryOrganizationId;
    }

    if (resolvedOriginatorId && resolvedOriginatorId !== userOrgId) {
      const canManageAll = await this.hasSystemManageAllPermission(
        user.user_id
      );
      if (!canManageAll) {
        throw new PermissionException(
          'rfa',
          'create on behalf of other organization'
        );
      }
      userOrgId = resolvedOriginatorId;
    }

    if (!userOrgId) {
      throw new ValidationException(
        'User must belong to an organization to create RFA'
      );
    }

    // EC-RFA-001: Check for existing active RFA per Shop Drawing Revision
    if (shopDrawingRevisionIds.length > 0) {
      const conflictingItems = await this.rfaItemRepo
        .createQueryBuilder('item')
        .innerJoin('item.rfaRevision', 'rfaRev')
        .innerJoin('rfaRev.statusCode', 'status')
        .where('item.shopDrawingRevisionId IN (:...ids)', {
          ids: shopDrawingRevisionIds,
        })
        .andWhere('status.statusCode NOT IN (:...codes)', {
          codes: ['CC', 'OBS'],
        })
        .getMany();

      if (conflictingItems.length > 0) {
        throw new BusinessException(
          'EC_RFA_001_ACTIVE_RFA_EXISTS',
          '[EC-RFA-001] One or more selected Shop Drawing Revisions already have an active RFA.',
          'Shop Drawing Revision ที่เลือกมี RFA ที่ยังใช้งานอยู่แล้ว',
          ['ตรวจสอบ RFA ที่มีอยู่', 'เลือก Shop Drawing Revision อื่น']
        );
      }
    }

    // Fetch real Organization Code for document numbering
    const userOrg = await this.orgRepo.findOne({
      where: { id: userOrgId },
      select: ['organizationCode'],
    });
    const orgCode = userOrg?.organizationCode ?? 'ORG';

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
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
        throw new SystemException(
          'Correspondence Status DRAFT not found in Master Data'
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
          throw new NotFoundException('Shop Drawing Revision');
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
          throw new NotFoundException('As-Built Drawing Revision');
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
      // [C2 FIX] Drawing types (DDW/SDW/ADW) are RFA subtypes — all use RFA_APPROVAL
      try {
        await this.workflowEngine.createInstance(
          'RFA_APPROVAL',
          'rfa',
          savedRfa.id.toString(),
          {
            projectId: internalProjectId,
            contractId: internalContractId,
            originatorId: userOrgId,
            disciplineId: createDto.disciplineId,
            initiatorId: user.user_id,
          }
        );
      } catch (error: unknown) {
        this.logger.warn(
          `Workflow not started for ${docNumber.number}: ${(error as Error).message}`
        );
      }

      // Indexing for Search
      this.searchService
        .indexDocument({
          id: savedCorr.id,
          publicId: savedCorr.publicId, // ADR-019: index publicId for search
          type: 'rfa',
          docNumber: docNumber.number,
          title: createDto.subject,
          description: createDto.description ?? '',
          status: 'DRAFT',
          projectId: internalProjectId,
          createdAt: new Date(),
        })
        .catch((err: unknown) =>
          this.logger.error(`Indexing failed: ${(err as Error).message}`)
        );

      return {
        ...savedRfa,
        correspondenceNumber: docNumber,
        currentRevision: savedRevision,
      };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create RFA: ${(err as Error).message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ... (ส่วน findOne, submit, processAction คงเดิมจากไฟล์ที่แนบมา แค่ปรับปรุงเล็กน้อยตาม Context) ...

  async findAll(query: SearchRfaDto, _user?: User) {
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

    // RBAC: DFT documents are visible only to the originator org (spec §3.3.10)
    if (_user?.primaryOrganizationId) {
      queryBuilder.andWhere(
        '(rfaRev.id IS NULL OR status.statusCode != :dftCode OR corr.originatorId = :userOrgId)',
        { dftCode: 'DFT', userOrgId: _user.primaryOrganizationId }
      );
    }

    const [items, total] = await queryBuilder
      .orderBy('corr.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    this.logger.debug(
      `RFA findAll: Found ${total} items. Query: ${JSON.stringify(query)}`
    );

    // Map `revisions` property back to the expected payload for the frontend
    const mappedItems: RfaMapped[] = items.map((rfa: Rfa) => {
      const revisions =
        (rfa.correspondence?.revisions as CorrRevWithRfa[] | undefined) ?? [];
      return {
        ...rfa,
        publicId: rfa.correspondence?.publicId, // ADR-019: expose publicId at top level
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
   * ADR-019: Find RFA by the parent Correspondence publicId (public identifier).
   * Resolves correspondence.publicId → internal rfa.id
   */
  async findOneByUuid(publicId: string) {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { publicId },
      select: ['id'],
    });
    if (!correspondence) {
      throw new NotFoundException('RFA', publicId);
    }
    return this.findOne(correspondence.id);
  }

  async findOneByUuidRaw(publicId: string) {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { publicId },
      select: ['id'],
    });
    if (!correspondence) {
      throw new NotFoundException('RFA', publicId);
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
      throw new NotFoundException('RFA', String(id));
    }

    if (rawEntities) {
      return rfa;
    }

    // Map to structure expected by frontend DTO
    const revisions =
      (rfa.correspondence?.revisions as CorrRevWithRfa[] | undefined) ?? [];
    const mappedRfa: RfaMapped = {
      ...rfa,
      publicId: rfa.correspondence?.publicId, // ADR-019: expose publicId at top level
      revisions: revisions.map((cr) => ({
        ...cr,
        ...(cr.rfaRevision ?? {}),
        id: cr.rfaRevision?.id ?? cr.id,
      })) as CorrRevWithRfa[],
    };

    return mappedRfa;
  }

  async submit(
    rfaId: number,
    templateId: number,
    user: User,
    reviewTeamPublicId?: string
  ) {
    const rfa = await this.findOne(rfaId, true);
    const corrRevisions =
      (rfa.correspondence?.revisions as CorrRevWithRfa[] | undefined) ?? [];
    const currentCorrRev = corrRevisions.find((r) => r.isCurrent);
    if (!currentCorrRev || !currentCorrRev.rfaRevision)
      throw new NotFoundException('Current revision');

    const currentRfaRev = currentCorrRev.rfaRevision;

    if (currentRfaRev.statusCode.statusCode !== 'DFT') {
      throw new WorkflowException(
        'RFA_INVALID_SUBMIT_STATUS',
        'Only DRAFT documents can be submitted',
        'สามารถส่งได้เฉพาะเอกสารสถานะ DRAFT เท่านั้น',
        ['ตรวจสอบสถานะเอกสารปัจจุบัน']
      );
    }

    const template = await this.templateRepo.findOne({
      where: { id: templateId },
      // relations: ['steps'], // Deprecated relation removed
    });

    if (!template) {
      throw new BusinessException(
        'ROUTING_TEMPLATE_NOT_FOUND',
        'Invalid routing template',
        'ไม่พบ Routing Template ที่กำหนด',
        ['ตรวจสอบ Routing Template ที่ตั้งค่าไว้']
      );
    }

    // Manual fetch of steps
    const steps = await this.templateStepRepo.find({
      where: { templateId: template.id },
      order: { sequence: 'ASC' },
    });

    if (steps.length === 0) {
      throw new BusinessException(
        'ROUTING_TEMPLATE_EMPTY',
        'Routing template has no steps',
        'Routing Template ไม่มีขั้นตอนกำหนดไว้',
        ['เพิ่ม Step ใน Routing Template']
      );
    }

    const statusForApprove = await this.rfaStatusRepo.findOne({
      where: { statusCode: 'FAP' },
    });
    if (!statusForApprove)
      throw new SystemException('Status FAP not found in Master Data');

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

      if (reviewTeamPublicId) {
        await this.taskCreationService.createParallelTasks(
          currentRfaRev.id,
          currentCorrRev.publicId, // ADR-019: Pass UUID
          reviewTeamPublicId,
          routing.dueDate ?? new Date(),
          queryRunner.manager,
          rfa.correspondence.projectId,
          rfa.rfaType.typeCode
        );
      }

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
      throw new WorkflowException(
        'NO_ACTIVE_WORKFLOW_STEP',
        'No active workflow step found',
        'ไม่พบขั้นตอน Workflow ที่ยังเปิดอยู่',
        ['ตรวจสอบสถานะ Workflow ของเอกสาร']
      );
    if (currentRouting.toOrganizationId !== user.primaryOrganizationId) {
      throw new PermissionException('rfa workflow step', 'process');
    }

    const template = await this.templateRepo.findOne({
      where: { id: currentRouting.templateId },
      // relations: ['steps'],
    });

    if (!template)
      throw new SystemException(
        'Routing Template not found for workflow processing'
      );

    // Manual fetch steps
    const steps = await this.templateStepRepo.find({
      where: { templateId: template.id },
      order: { sequence: 'ASC' },
    });

    if (steps.length === 0)
      throw new SystemException('Routing Template steps not found');

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

  /**
   * Update a Draft RFA's revision fields (subject, body, remarks, description, dueDate).
   * EC-RFA-002: Only allowed when current revision is in DFT status.
   */
  async update(publicId: string, dto: UpdateRfaDto, _user: User) {
    const rfa = await this.findOneByUuidRaw(publicId);
    const corrRevisions =
      (rfa.correspondence?.revisions as CorrRevWithRfa[] | undefined) ?? [];
    const currentCorrRev = corrRevisions.find((r) => r.isCurrent);
    if (!currentCorrRev || !currentCorrRev.rfaRevision)
      throw new NotFoundException('Current revision');

    const currentRfaRev = currentCorrRev.rfaRevision;

    if (currentRfaRev.statusCode.statusCode !== 'DFT') {
      throw new WorkflowException(
        'RFA_EDIT_NON_DRAFT',
        'Only DRAFT documents can be edited',
        'สามารถแก้ไขได้เฉพาะเอกสารสถานะ DRAFT เท่านั้น',
        ['ส่งเอกสารเพื่อสร้าง Revision ใหม่สำหรับเอกสารที่ไม่ใช่ DRAFT']
      );
    }

    const updatedFields: Partial<CorrespondenceRevision> = {};
    if (dto.subject !== undefined) updatedFields.subject = dto.subject;
    if (dto.body !== undefined) updatedFields.body = dto.body;
    if (dto.remarks !== undefined) updatedFields.remarks = dto.remarks;
    if (dto.description !== undefined)
      updatedFields.description = dto.description;
    if (dto.dueDate !== undefined)
      updatedFields.dueDate = new Date(dto.dueDate);

    Object.assign(currentCorrRev, updatedFields);

    await this.corrRevRepo.save(currentCorrRev);

    if (dto.details !== undefined) {
      currentRfaRev.details = dto.details;
      await this.rfaRevisionRepo.save(currentRfaRev);
    }

    return this.findOneByUuid(publicId);
  }

  /**
   * Cancel (soft-delete) a Draft RFA by setting its status to CC.
   * EC-RFA-002: Only allowed when current revision is in DFT status.
   */
  async cancel(publicId: string, user: User) {
    const rfa = await this.findOneByUuidRaw(publicId);
    const corrRevisions =
      (rfa.correspondence?.revisions as CorrRevWithRfa[] | undefined) ?? [];
    const currentCorrRev = corrRevisions.find((r) => r.isCurrent);
    if (!currentCorrRev || !currentCorrRev.rfaRevision)
      throw new NotFoundException('Current revision');

    const currentRfaRev = currentCorrRev.rfaRevision;

    if (currentRfaRev.statusCode.statusCode !== 'DFT') {
      throw new WorkflowException(
        'RFA_CANCEL_NON_DRAFT',
        'Only DRAFT documents can be cancelled',
        'สามารถยกเลิกได้เฉพาะเอกสารสถานะ DRAFT เท่านั้น',
        ['ติดต่อ Org Admin เพื่อยกเลิกเอกสารที่ส่งแล้ว']
      );
    }

    const statusCC = await this.rfaStatusRepo.findOne({
      where: { statusCode: 'CC' },
    });
    if (!statusCC)
      throw new SystemException(
        'Status CC (Cancelled) not found in Master Data'
      );

    currentRfaRev.rfaStatusCodeId = statusCC.id;
    await this.rfaRevisionRepo.save(currentRfaRev);

    this.logger.log(
      `RFA ${rfa.correspondence?.correspondenceNumber} cancelled by user ${user.user_id}`
    );

    return { message: 'RFA cancelled successfully' };
  }
}
