import { Injectable, Logger } from '@nestjs/common';
import {
  NotFoundException,
  PermissionException,
  SystemException,
  ValidationException,
} from '../../common/exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transmittal } from './entities/transmittal.entity';
import { TransmittalItem } from './entities/transmittal-item.entity';
import {
  CreateTransmittalDto,
  TransmittalItemDto,
} from './dto/create-transmittal.dto';
import { SearchTransmittalDto } from './dto/search-transmittal.dto';
import { User } from '../user/entities/user.entity';
import { DocumentNumberingService } from '../document-numbering/services/document-numbering.service';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { CorrespondenceRecipient } from '../correspondence/entities/correspondence-recipient.entity';
import { UserService } from '../user/user.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';

@Injectable()
export class TransmittalService {
  private readonly logger = new Logger(TransmittalService.name);

  private async hasSystemManageAllPermission(userId: number): Promise<boolean> {
    const permissions = await this.userService.getUserPermissions(userId);
    return permissions.includes('system.manage_all');
  }

  constructor(
    @InjectRepository(Transmittal)
    private transmittalRepo: Repository<Transmittal>,
    @InjectRepository(TransmittalItem)
    private itemRepo: Repository<TransmittalItem>,
    @InjectRepository(CorrespondenceType)
    private typeRepo: Repository<CorrespondenceType>,
    @InjectRepository(CorrespondenceStatus)
    private statusRepo: Repository<CorrespondenceStatus>,
    @InjectRepository(CorrespondenceRevision)
    private revisionRepo: Repository<CorrespondenceRevision>,
    private numberingService: DocumentNumberingService,
    private dataSource: DataSource,
    private uuidResolver: UuidResolverService,
    private userService: UserService,
    private workflowEngine: WorkflowEngineService
  ) {}

  async create(
    createDto: CreateTransmittalDto,
    user: User
  ): Promise<Transmittal & { correspondence: Correspondence }> {
    // 1. Get Transmittal Type (Assuming Code '901' or 'TRN')
    const type = await this.typeRepo.findOne({
      where: { typeCode: 'TRN' }, // Adjust code as per Master Data
    });
    if (!type) throw new NotFoundException('Transmittal Type (TRN)');

    const statusDraft = await this.statusRepo.findOne({
      where: { statusCode: 'DRAFT' },
    });
    if (!statusDraft)
      throw new SystemException('Status DRAFT not found in Master Data');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let userOrgId = user.primaryOrganizationId;
    if (!userOrgId) {
      const fullUser = await this.userService.findOne(user.user_id);
      if (fullUser) {
        userOrgId = fullUser.primaryOrganizationId;
      }
    }

    const resolvedOriginatorId = createDto.originatorId
      ? await this.uuidResolver.resolveOrganizationId(createDto.originatorId)
      : undefined;

    if (resolvedOriginatorId && resolvedOriginatorId !== userOrgId) {
      const canManageAll = await this.hasSystemManageAllPermission(
        user.user_id
      );
      if (!canManageAll) {
        throw new PermissionException(
          'transmittal',
          'create on behalf of other organization'
        );
      }
      userOrgId = resolvedOriginatorId;
    }

    if (!userOrgId) {
      throw new ValidationException(
        'User must belong to an organization to create a transmittal'
      );
    }

    try {
      // ADR-019: Resolve UUID→INT for projectId
      const internalProjectId = await this.uuidResolver.resolveProjectId(
        createDto.projectId
      );

      // 2. Generate Number
      const docNumber = await this.numberingService.generateNextNumber({
        projectId: internalProjectId,
        originatorOrganizationId: userOrgId,
        typeId: type.id,
        year: new Date().getFullYear(),
        customTokens: {
          TYPE_CODE: type.typeCode,
          ORG_CODE: 'ORG', // TODO: Fetch real ORG Code
        },
      });

      // 3. Create Correspondence (Parent)
      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber.number,
        correspondenceTypeId: type.id,
        projectId: internalProjectId,
        originatorId: userOrgId,
        isInternal: false,
        createdBy: user.user_id,
      });
      const savedCorr = await queryRunner.manager.save(correspondence);

      // 4. Create Revision (Draft)
      const revision = queryRunner.manager.create(CorrespondenceRevision, {
        correspondenceId: savedCorr.id,
        revisionNumber: 0,
        revisionLabel: '0',
        isCurrent: true,
        statusId: statusDraft.id,
        title: createDto.subject,
        createdBy: user.user_id,
      });
      await queryRunner.manager.save(revision);

      // ADR-019: Resolve recipientOrganizationId UUID→INT and create recipient record
      const internalRecipientOrgId =
        await this.uuidResolver.resolveOrganizationId(
          createDto.recipientOrganizationId
        );
      const recipient = queryRunner.manager.create(CorrespondenceRecipient, {
        correspondenceId: savedCorr.id,
        recipientOrganizationId: internalRecipientOrgId,
        recipientType: 'TO',
      });
      await queryRunner.manager.save(recipient);

      // 5. Create Transmittal
      const transmittal = queryRunner.manager.create(Transmittal, {
        correspondenceId: savedCorr.id,
        purpose: createDto.purpose || 'FOR_REVIEW',
        remarks: createDto.remarks,
      });
      const savedTransmittal = await queryRunner.manager.save(transmittal);

      // 6. Create Items
      if (createDto.items && createDto.items.length > 0) {
        const items = createDto.items.map((item: TransmittalItemDto) =>
          queryRunner.manager.create(TransmittalItem, {
            transmittalId: savedCorr.id,
            itemCorrespondenceId: item.itemId, // Direct mapping forced by Schema
            quantity: 1, // Default, not in DTO
            remarks: item.description,
          })
        );
        await queryRunner.manager.save(items);
      }

      await queryRunner.commitTransaction();

      return {
        ...savedTransmittal,
        correspondence: savedCorr,
      };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create transmittal: ${(err as Error).message}`
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * ADR-019: Find Transmittal by parent Correspondence publicId (public identifier).
   * v1.8.7: Exposes workflowInstanceId, workflowState, availableActions via WorkflowEngineService
   */
  async findOneByUuid(publicId: string): Promise<
    Transmittal & {
      workflowInstanceId?: string;
      workflowState?: string;
      availableActions?: string[];
    }
  > {
    const correspondence = await this.dataSource.manager.findOne(
      Correspondence,
      { where: { publicId }, select: ['id'] }
    );
    if (!correspondence) {
      throw new NotFoundException(
        `Transmittal with publicId ${publicId} not found`
      );
    }
    const transmittal = await this.findOne(correspondence.id);

    // v1.8.7: ดึง Workflow Instance สำหรับ Transmittal นี้ (nullable — Draft ไม่มี Instance)
    const wfInstance = await this.workflowEngine.getInstanceByEntity(
      'transmittal',
      correspondence.id.toString()
    );

    return {
      ...transmittal,
      workflowInstanceId: wfInstance?.id,
      workflowState: wfInstance?.currentState,
      availableActions: wfInstance?.availableActions ?? [],
    };
  }

  async findOne(id: number): Promise<Transmittal> {
    const transmittal = await this.transmittalRepo.findOne({
      where: { correspondenceId: id },
      relations: ['correspondence', 'correspondence.revisions', 'items'],
    });
    if (!transmittal)
      throw new NotFoundException(`Transmittal ID ${id} not found`);
    return transmittal;
  }

  /**
   * Submit Transmittal — ตรวจสอบ EC-RFA-004 ก่อนเริ่ม Workflow (v1.8.7)
   * EC-RFA-004: ทุก item ต้องไม่อยู่ใน DRAFT ก่อน Submit
   */
  async submit(
    uuid: string,
    user: User
  ): Promise<{ instanceId: string; currentState: string }> {
    const correspondence = await this.dataSource.manager.findOne(
      Correspondence,
      {
        where: { publicId: uuid },
        select: ['id', 'correspondenceNumber', 'disciplineId', 'originatorId'],
      }
    );
    if (!correspondence)
      throw new NotFoundException(`Transmittal publicId ${uuid}`);

    const transmittal = await this.transmittalRepo.findOne({
      where: { correspondenceId: correspondence.id },
      relations: ['items'],
    });
    if (!transmittal) throw new NotFoundException('Transmittal', uuid);

    // EC-RFA-004: ตรวจสอบว่า item ทุกชิ้นไม่อยู่ใน DRAFT
    if (transmittal.items && transmittal.items.length > 0) {
      const itemCorrIds = transmittal.items.map((i) => i.itemCorrespondenceId);
      const draftRevisions = await this.revisionRepo
        .createQueryBuilder('rev')
        .innerJoin('rev.status', 'status')
        .where('rev.correspondenceId IN (:...ids)', { ids: itemCorrIds })
        .andWhere('rev.isCurrent = :isCurrent', { isCurrent: true })
        .andWhere('status.statusCode = :code', { code: 'DRAFT' })
        .leftJoinAndSelect('rev.correspondence', 'corr')
        .getMany();

      if (draftRevisions.length > 0) {
        const draftDocNo =
          draftRevisions[0]?.correspondence?.correspondenceNumber ?? 'Unknown';
        throw new ValidationException(
          `RFA ${draftDocNo} ยังอยู่ใน Draft กรุณา Submit ก่อน`
        );
      }
    }

    // Bug 1 fix: ป้องกัน duplicate instance — ถ้ามี Active Instance อยู่แล้ว ให้หยุด
    const existingInstance = await this.workflowEngine.getInstanceByEntity(
      'transmittal',
      correspondence.id.toString()
    );
    if (existingInstance) {
      throw new ValidationException(
        `Transmittal นี้ถูก Submit ไปแล้ว (Workflow Instance: ${existingInstance.id})`
      );
    }

    // [C3] Resolve contractId from discipline for contract-scoped workflow
    let contractId: number | null = null;
    if (correspondence.disciplineId) {
      const rows = await this.dataSource.query<[{ contract_id: number }]>(
        'SELECT contract_id FROM disciplines WHERE id = ? LIMIT 1',
        [correspondence.disciplineId]
      );
      contractId = rows[0]?.contract_id ?? null;
    }

    // Bug 2 fix: ใส่ organizationId ใน context เพื่อให้ WorkflowTransitionGuard Level 2 (Org Admin) ทำงานได้
    const instance = await this.workflowEngine.createInstance(
      'TRANSMITTAL_FLOW_V1',
      'transmittal',
      correspondence.id.toString(),
      {
        ownerId: user.user_id,
        contractId,
        organizationId: correspondence.originatorId ?? null,
      }
    );

    const result = await this.workflowEngine.processTransition(
      instance.id,
      'SUBMIT',
      user.user_id,
      'Transmittal Submitted'
    );

    // Sync สถานะกลับที่ Correspondence Revision
    const revision = await this.revisionRepo.findOne({
      where: { correspondenceId: correspondence.id, isCurrent: true },
    });
    if (revision) {
      const submittedStatus = await this.statusRepo.findOne({
        where: { statusCode: 'SUBMITTED' },
      });
      if (submittedStatus) {
        revision.statusId = submittedStatus.id;
        await this.revisionRepo.save(revision);
      }
    }

    this.logger.log(`Transmittal ${uuid} submitted — instance ${instance.id}`);
    return { instanceId: instance.id, currentState: result.nextState };
  }

  async findAll(query: SearchTransmittalDto) {
    const { page = 1, limit = 20, projectId, search } = query;
    const skip = ((page ?? 1) - 1) * (limit ?? 20);

    const queryBuilder = this.transmittalRepo
      .createQueryBuilder('transmittal')
      .innerJoinAndSelect('transmittal.correspondence', 'correspondence')
      .leftJoinAndSelect(
        'correspondence.revisions',
        'revision',
        'revision.isCurrent = :isCurrent',
        { isCurrent: true }
      )
      .leftJoinAndSelect('transmittal.items', 'items')
      .leftJoinAndSelect('items.itemCorrespondence', 'itemCorrespondence');

    if (projectId) {
      queryBuilder.andWhere('correspondence.projectId = :projectId', {
        projectId,
      });
    }

    // B3: purpose filter (EC-RFA-004 aligned)
    if (query.purpose) {
      queryBuilder.andWhere('transmittal.purpose = :purpose', {
        purpose: query.purpose,
      });
    }

    if (search) {
      queryBuilder.andWhere(
        '(correspondence.correspondenceNumber LIKE :search OR revision.title LIKE :search)',
        { search: `%${search}%` }
      );
    }

    const [items, total] = await queryBuilder
      .orderBy('correspondence.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // ADR-019: Map correspondence.publicId to top level for frontend convenience
    const mappedItems = items.map((t) => ({
      ...t,
      publicId: t.correspondence?.publicId,
    }));

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
}
