// File: src/modules/rfa/rfa.service.ts
// Change Log:
// - 2026-05-13: Invoke TaskCreationService during submit when a review team is selected.
// - 2026-06-14: ADR-001/021 migration — submit()/processAction() เดินผ่าน Unified Workflow Engine
//   (เลิกใช้ RoutingTemplate/CorrespondenceRouting), ตัด templateId, ย้าย notification ออกนอก transaction,
//   ทำ EC-RFA-001 ให้ race-safe (lock FOR UPDATE), เลิก hardcode approve code.
// - 2026-06-17: Refactor: extract constants, getCurrentRevision() helper, narrow UpdateRfaDto,
//   break up create(), fix cancel() workflow termination, add CorrespondenceRecipient repo injection.

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
import { CorrespondenceRecipient } from '../correspondence/entities/correspondence-recipient.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
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

// Constants
import * as RFA from './constants/rfa.constants';

// ------- Local type helpers (no-any ADR-019) -------
/** CorrespondenceRevision with the rfaRevision relation loaded at runtime */
type CorrRevWithRfa = CorrespondenceRevision & { rfaRevision?: RfaRevision };

/** RFA entity + a flat `revisions` convenience array for the frontend */
export interface RfaMapped extends Rfa {
  publicId?: string; // ADR-019: top-level publicId from correspondence
  revisions: CorrRevWithRfa[];
  // ADR-021: expose Unified Workflow Engine state for IntegratedBanner/WorkflowLifecycle
  workflowInstanceId?: string;
  workflowState?: string;
  availableActions?: string[];
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

  /** ADR-001: รหัส Workflow ที่ลงทะเบียนใน seed DSL */
  static readonly WORKFLOW_CODE = RFA.RFA_WORKFLOW_CODE;

  /** แมป Workflow State → RFA Status Code ตาม seed data */
  static readonly STATE_TO_STATUS: Record<string, string> =
    RFA.STATE_TO_STATUS_MAP;

  /** รหัสอนุมัติเริ่มต้นเมื่อถึงสถานะ Terminal */
  static readonly DEFAULT_APPROVED_CODE = RFA.DEFAULT_APPROVED_CODE;

  private async hasSystemManageAllPermission(userId: number): Promise<boolean> {
    const permissions = await this.userService.getUserPermissions(userId);
    return permissions.includes('system.manage_all');
  }

  /**
   * ดึง Revision ปัจจุบันจาก RFA entity (DRY helper)
   * คืนค่า { currentCorrRev, currentRfaRev } หรือ throw NotFoundException
   */
  private getCurrentRevision(rfa: Rfa): {
    currentCorrRev: CorrespondenceRevision;
    currentRfaRev: RfaRevision;
  } {
    const corrRevisions =
      (rfa.correspondence?.revisions as CorrRevWithRfa[] | undefined) ?? [];
    const currentCorrRev = corrRevisions.find((r) => r.isCurrent);
    if (!currentCorrRev?.rfaRevision)
      throw new NotFoundException('Current revision');
    return {
      currentCorrRev,
      currentRfaRev: currentCorrRev.rfaRevision,
    };
  }

  /**
   * ตรวจสอบข้อจำกัดประเภท RFA กับ Drawing Revisions ที่เลือก
   * - DDW/SDW: ต้องมี Shop Drawing, ห้ามมี As-Built
   * - ADW: ต้องมี As-Built, ห้ามมี Shop Drawing
   * - ประเภทอื่น: ห้ามมี Drawing Reference ใดๆ
   */
  private validateRfaTypeDrawingConstraints(
    rfaTypeCode: string,
    shopDrawingRefs: Array<number | string>,
    asBuiltDrawingRefs: Array<number | string>
  ): void {
    if (
      RFA.DRAWING_RFA_TYPES.includes(
        rfaTypeCode as (typeof RFA.DRAWING_RFA_TYPES)[number]
      )
    ) {
      if (shopDrawingRefs.length === 0) {
        throw new ValidationException(
          'Selected RFA Type requires at least one Shop Drawing Revision'
        );
      }

      if (asBuiltDrawingRefs.length > 0) {
        throw new ValidationException(
          'Selected RFA Type cannot reference As-Built Drawing Revisions'
        );
      }
    } else if (rfaTypeCode === RFA.RFA_TYPE_CODE_ADW) {
      if (asBuiltDrawingRefs.length === 0) {
        throw new ValidationException(
          'Selected RFA Type requires at least one As-Built Drawing Revision'
        );
      }

      if (shopDrawingRefs.length > 0) {
        throw new ValidationException(
          'Selected RFA Type cannot reference Shop Drawing Revisions'
        );
      }
    } else if (shopDrawingRefs.length > 0 || asBuiltDrawingRefs.length > 0) {
      throw new ValidationException(
        'Selected RFA Type does not support drawing revision items'
      );
    }
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
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
    @InjectRepository(CorrespondenceRecipient)
    private corrRecipientRepo: Repository<CorrespondenceRecipient>,

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

    this.validateRfaTypeDrawingConstraints(
      rfaTypeCode,
      rawShopDrawingRefs,
      rawAsBuiltDrawingRefs
    );

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
        RFA.ERROR_RFA_TYPE_CONTRACT_MISMATCH,
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
          RFA.ERROR_DISCIPLINE_CONTRACT_MISMATCH,
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
      where: { statusCode: RFA.RFA_STATUS_DRAFT },
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
          RFA.ENTITY_TYPE_RFA,
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
      // EC-RFA-001 (race-safe): ล็อกแถว shop_drawing_revisions ที่เลือกด้วย FOR UPDATE
      // ภายใน transaction เพื่อ serialize การสร้าง RFA พร้อมกันบน drawing เดียวกัน
      // จากนั้นค่อยตรวจว่ามี RFA ที่ยัง active อยู่หรือไม่ (กัน TOCTOU)
      if (shopDrawingRevisionIds.length > 0) {
        await queryRunner.manager.query(
          `SELECT id FROM shop_drawing_revisions WHERE id IN (${shopDrawingRevisionIds
            .map(() => '?')
            .join(',')}) FOR UPDATE`,
          shopDrawingRevisionIds
        );

        const conflictingItems = await queryRunner.manager
          .createQueryBuilder(RfaItem, 'item')
          .innerJoin('item.rfaRevision', 'rfaRev')
          .innerJoin('rfaRev.statusCode', 'status')
          .where('item.shopDrawingRevisionId IN (:...ids)', {
            ids: shopDrawingRevisionIds,
          })
          .andWhere('status.statusCode NOT IN (:...codes)', {
            codes: [RFA.RFA_STATUS_CANCELLED, RFA.RFA_STATUS_OBSOLETE],
          })
          .getMany();

        if (conflictingItems.length > 0) {
          throw new BusinessException(
            RFA.ERROR_EC_RFA_001,
            '[EC-RFA-001] One or more selected Shop Drawing Revisions already have an active RFA.',
            'Shop Drawing Revision ที่เลือกมี RFA ที่ยังใช้งานอยู่แล้ว',
            ['ตรวจสอบ RFA ที่มีอยู่', 'เลือก Shop Drawing Revision อื่น']
          );
        }
      }

      // [UPDATED] Generate Document Number with Discipline
      // ADR-002: generateNextNumber ใช้ transaction ของตัวเอง (Redlock + optimistic counter)
      // จึงรับประกัน "ไม่ซ้ำ" แต่ "อาจมี gap" ได้หาก transaction นี้ rollback — ยอมรับได้ตาม ADR-002
      const docNumber = await this.numberingService.generateNextNumber({
        projectId: internalProjectId,
        originatorOrganizationId: userOrgId,
        recipientOrganizationId: internalRecipientOrgId,
        typeId: correspondenceType.id,
        rfaTypeId: createDto.rfaTypeId,
        disciplineId: createDto.disciplineId,
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
          where: { statusCode: RFA.CORR_STATUS_DRAFT },
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
          recipientType: RFA.RECIPIENT_TYPE_TO,
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

      // [NEW V1.5.1] Start Unified Workflow Instance (ADR-001)
      // [C2 FIX] Drawing types (DDW/SDW/ADW) are RFA subtypes — all use RFA_APPROVAL
      // Instance ถูกสร้างใน state DRAFT; submit() จะ transition 'SUBMIT' ต่อ
      // หาก createInstance ล้มเหลว → log error (ไม่ fatal); submit() จะ self-heal สร้าง instance ให้
      try {
        await this.workflowEngine.createInstance(
          RfaService.WORKFLOW_CODE,
          RFA.ENTITY_TYPE_RFA,
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
        this.logger.error(
          `Workflow instance not started for ${docNumber.number} (will self-heal on submit): ${(error as Error).message}`
        );
      }

      // Indexing for Search
      this.searchService
        .indexDocument({
          id: savedCorr.id,
          publicId: savedCorr.publicId, // ADR-019: index publicId for search
          type: RFA.SEARCH_TYPE_RFA,
          docNumber: docNumber.number,
          title: createDto.subject,
          description: createDto.description ?? '',
          status: RFA.SEARCH_STATUS_DRAFT,
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
    // ผู้มีสิทธิ์ system.manage_all เห็นทุก DFT; ผู้อื่นเห็นเฉพาะของ org ตน
    // ผู้ที่ไม่มี org และไม่มีสิทธิ์ manage_all → ไม่เห็น DFT เลย (กัน data leak)
    if (_user) {
      const canViewAllDft = await this.hasSystemManageAllPermission(
        _user.user_id
      );
      if (!canViewAllDft) {
        if (_user.primaryOrganizationId) {
          queryBuilder.andWhere(
            '(rfaRev.id IS NULL OR status.statusCode != :dftCode OR corr.originatorId = :userOrgId)',
            {
              dftCode: RFA.RFA_STATUS_DRAFT,
              userOrgId: _user.primaryOrganizationId,
            }
          );
        } else {
          queryBuilder.andWhere(
            '(rfaRev.id IS NULL OR status.statusCode != :dftCode)',
            { dftCode: RFA.RFA_STATUS_DRAFT }
          );
        }
      }
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
  async findOneByUuid(publicId: string): Promise<RfaMapped> {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { publicId },
      select: ['id'],
    });
    if (!correspondence) {
      throw new NotFoundException('RFA', publicId);
    }
    const mapped = (await this.findOne(correspondence.id)) as RfaMapped;

    // ADR-021: ดึง Workflow Instance (nullable — DRAFT ที่ยังไม่เริ่ม submit ก็มี instance DRAFT)
    const wfInstance = await this.workflowEngine.getInstanceByEntity(
      RFA.ENTITY_TYPE_RFA,
      correspondence.id.toString()
    );
    mapped.workflowInstanceId = wfInstance?.id;
    mapped.workflowState = wfInstance?.currentState;
    mapped.availableActions = wfInstance?.availableActions ?? [];
    return mapped;
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

  /**
   * Submit RFA เข้า Unified Workflow Engine (ADR-001)
   * - ใช้ Workflow Instance ที่สร้างไว้ตอน create() (state DRAFT); ถ้าไม่มีจะ self-heal
   * - Engine จัดการ Redlock + pessimistic lock + version CAS ป้องกัน double-submit
   */
  async submit(
    rfaId: number,
    user: User,
    reviewTeamPublicId?: string,
    roles: string[] = []
  ) {
    const rfa = await this.findOne(rfaId, true);
    const { currentCorrRev, currentRfaRev } = this.getCurrentRevision(rfa);

    if (currentRfaRev.statusCode.statusCode !== RFA.RFA_STATUS_DRAFT) {
      throw new WorkflowException(
        RFA.ERROR_RFA_INVALID_SUBMIT_STATUS,
        'Only DRAFT documents can be submitted',
        'สามารถส่งได้เฉพาะเอกสารสถานะ DRAFT เท่านั้น',
        ['ตรวจสอบสถานะเอกสารปัจจุบัน']
      );
    }

    // ADR-001: หา Workflow Instance ที่สร้างไว้ตอน create() — ถ้าไม่มีให้ self-heal
    let instance = await this.workflowEngine.getInstanceByEntity(
      RFA.ENTITY_TYPE_RFA,
      rfaId.toString()
    );
    if (instance && instance.currentState !== RFA.RFA_WORKFLOW_STATE_DRAFT) {
      throw new WorkflowException(
        RFA.ERROR_RFA_ALREADY_SUBMITTED,
        `RFA already submitted (state: ${instance.currentState})`,
        'RFA นี้ถูกส่งเข้า Workflow ไปแล้ว',
        ['รีเฟรชหน้าเพื่อดูสถานะล่าสุด']
      );
    }
    if (!instance) {
      const created = await this.workflowEngine.createInstance(
        RfaService.WORKFLOW_CODE,
        RFA.ENTITY_TYPE_RFA,
        rfaId.toString(),
        {
          projectId: rfa.correspondence.projectId,
          originatorId: rfa.correspondence.originatorId,
          disciplineId: rfa.correspondence.disciplineId,
          initiatorId: user.user_id,
        }
      );
      instance = {
        id: created.id,
        currentState: created.currentState,
        availableActions: [],
      };
    }

    // ADR-001: transition 'SUBMIT' (DSL ต้องการ role CONTRACTOR ผ่าน context.roles)
    const result = await this.workflowEngine.processTransition(
      instance.id,
      'SUBMIT',
      user.user_id,
      'RFA Submitted',
      { roles },
      undefined,
      user.publicId
    );

    // Sync สถานะ RFA Revision ตาม state ใหม่ (เช่น CONSULTANT_REVIEW → FRE)
    await this.syncRevisionStatus(currentRfaRev, result.nextState);
    currentCorrRev.issuedDate = new Date();
    await this.corrRevRepo.save(currentCorrRev);

    // FR-003: สร้าง Parallel Review Tasks (ถ้าเลือก Review Team) — transaction ของตัวเอง
    if (reviewTeamPublicId) {
      await this.dataSource.transaction(async (manager) => {
        await this.taskCreationService.createParallelTasks(
          currentRfaRev.id,
          currentCorrRev.publicId, // ADR-019: Pass UUID
          reviewTeamPublicId,
          currentCorrRev.dueDate ?? new Date(),
          manager,
          rfa.correspondence.projectId,
          rfa.rfaType.typeCode
        );
      });
    }

    // ADR-008: แจ้งเตือนแบบ fire-and-forget หลังทุกอย่างสำเร็จ (ไม่ค้างใน transaction)
    void this.notifyRecipients(
      rfa.correspondence.id,
      rfa.correspondence.correspondenceNumber,
      currentCorrRev.subject
    ).catch((err: unknown) =>
      this.logger.warn(
        `RFA submit notification failed: ${err instanceof Error ? err.message : String(err)}`
      )
    );

    return { instanceId: instance.id, currentState: result.nextState };
  }

  /**
   * ดำเนินการ Workflow Action (APPROVE/REJECT) ผ่าน Unified Workflow Engine (ADR-001)
   * Engine จัดการ pessimistic lock + version CAS ป้องกัน double-approval / TOCTOU
   */
  async processAction(
    rfaId: number,
    dto: WorkflowActionDto,
    user: User,
    roles: string[] = []
  ) {
    const rfa = await this.findOne(rfaId, true);
    const { currentRfaRev } = this.getCurrentRevision(rfa);

    const instance = await this.workflowEngine.getInstanceByEntity(
      RFA.ENTITY_TYPE_RFA,
      rfaId.toString()
    );
    if (!instance) {
      throw new WorkflowException(
        RFA.ERROR_NO_ACTIVE_WORKFLOW,
        'No active workflow instance found',
        'ไม่พบ Workflow ที่ยังเปิดอยู่',
        ['ตรวจสอบสถานะ Workflow ของเอกสาร']
      );
    }

    const approveCodeStr =
      typeof dto.payload?.approveCode === 'string'
        ? dto.payload.approveCode
        : undefined;

    const result = await this.workflowEngine.processTransition(
      instance.id,
      dto.action,
      user.user_id,
      dto.comment ?? dto.comments,
      { roles, approveCode: approveCodeStr },
      undefined,
      user.publicId
    );

    // Sync RFA Revision status + approve code ตาม state ใหม่
    await this.syncRevisionStatus(
      currentRfaRev,
      result.nextState,
      dto.action === WorkflowAction.REJECT ? undefined : approveCodeStr,
      result.isCompleted
    );

    return { message: 'Action processed', result };
  }

  /**
   * Helper: Map Workflow State → RFA Status Code (+ Approve Code เมื่อถึง Terminal) แล้วบันทึก
   * เลิก hardcode magic string — ใช้ STATE_TO_STATUS map + payload override
   */
  private async syncRevisionStatus(
    revision: RfaRevision,
    workflowState: string,
    approveCodeStr?: string,
    isTerminalApproved = false
  ): Promise<void> {
    const targetStatusCode =
      RfaService.STATE_TO_STATUS[workflowState] ?? RFA.RFA_STATUS_DRAFT;
    const status = await this.rfaStatusRepo.findOne({
      where: { statusCode: targetStatusCode },
    });
    if (status) {
      revision.rfaStatusCodeId = status.id;
    }

    if (isTerminalApproved) {
      const codeToUse = approveCodeStr ?? RfaService.DEFAULT_APPROVED_CODE;
      const approveCode = await this.rfaApproveRepo.findOne({
        where: { approveCode: codeToUse },
      });
      if (approveCode) {
        revision.rfaApproveCodeId = approveCode.id;
        revision.approvedDate = new Date();
      }
    }

    await this.rfaRevisionRepo.save(revision);
    this.logger.log(
      `Synced RFA Revision ${revision.id}: state=${workflowState} → status=${targetStatusCode}`
    );
  }

  /**
   * ADR-008: แจ้งเตือน Document Controller ของ org ผู้รับ (TO) แบบ async
   * เรียกหลัง transaction สำเร็จเท่านั้น (ห้ามค้างใน request transaction)
   */
  private async notifyRecipients(
    correspondenceId: number,
    correspondenceNumber: string,
    subject?: string
  ): Promise<void> {
    const recipients = await this.corrRecipientRepo.find({
      where: { correspondenceId, recipientType: RFA.RECIPIENT_TYPE_TO },
    });
    for (const r of recipients) {
      const targetUserId = await this.userService.findDocControlIdByOrg(
        r.recipientOrganizationId
      );
      if (targetUserId) {
        await this.notificationService.send({
          userId: targetUserId,
          title: `RFA Submitted: ${subject ?? correspondenceNumber}`,
          message: `RFA ${correspondenceNumber} submitted for approval.`,
          type: 'SYSTEM',
          entityType: RFA.ENTITY_TYPE_RFA,
          entityId: correspondenceId,
        });
      }
    }
  }

  /**
   * Update a Draft RFA's revision fields (subject, body, remarks, description, dueDate).
   * EC-RFA-002: Only allowed when current revision is in DFT status.
   */
  async update(publicId: string, dto: UpdateRfaDto, _user: User) {
    const rfa = await this.findOneByUuidRaw(publicId);
    const { currentCorrRev, currentRfaRev } = this.getCurrentRevision(rfa);

    if (currentRfaRev.statusCode.statusCode !== RFA.RFA_STATUS_DRAFT) {
      throw new WorkflowException(
        RFA.ERROR_RFA_EDIT_NON_DRAFT,
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
    const { currentRfaRev } = this.getCurrentRevision(rfa);

    if (currentRfaRev.statusCode.statusCode !== RFA.RFA_STATUS_DRAFT) {
      throw new WorkflowException(
        RFA.ERROR_RFA_CANCEL_NON_DRAFT,
        'Only DRAFT documents can be cancelled',
        'สามารถยกเลิกได้เฉพาะเอกสารสถานะ DRAFT เท่านั้น',
        ['ติดต่อ Org Admin เพื่อยกเลิกเอกสารที่ส่งแล้ว']
      );
    }

    const statusCC = await this.rfaStatusRepo.findOne({
      where: { statusCode: RFA.RFA_STATUS_CANCELLED },
    });
    if (!statusCC)
      throw new SystemException(
        'Status CC (Cancelled) not found in Master Data'
      );

    currentRfaRev.rfaStatusCodeId = statusCC.id;
    await this.rfaRevisionRepo.save(currentRfaRev);

    // Terminate workflow instance ถ้ามี
    const instance = await this.workflowEngine.getInstanceByEntity(
      RFA.ENTITY_TYPE_RFA,
      rfa.id.toString()
    );
    if (instance) {
      await this.workflowEngine.terminateInstance(
        instance.id,
        `RFA cancelled by user ${user.user_id}`
      );
    }

    this.logger.log(
      `RFA ${rfa.correspondence?.correspondenceNumber} cancelled by user ${user.user_id}`
    );

    return { message: 'RFA cancelled successfully' };
  }
}
