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
import { Repository, DataSource } from 'typeorm';

// Entities
import { Correspondence } from './entities/correspondence.entity';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { CorrespondenceType } from './entities/correspondence-type.entity';
import { CorrespondenceStatus } from './entities/correspondence-status.entity';
import { CorrespondenceReference } from './entities/correspondence-reference.entity';
import { CorrespondenceRecipient } from './entities/correspondence-recipient.entity';
import { CorrespondenceTag } from './entities/correspondence-tag.entity';
import { Tag } from '../master/entities/tag.entity';
import { User } from '../user/entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';
import { CorrespondenceRevisionAttachment } from './entities/correspondence-revision-attachment.entity';

// DTOs
import { CreateCorrespondenceDto } from './dto/create-correspondence.dto';
import { UpdateCorrespondenceDto } from './dto/update-correspondence.dto';
import { AddReferenceDto } from './dto/add-reference.dto';
import { SearchCorrespondenceDto } from './dto/search-correspondence.dto';

// Services
import { DocumentNumberingService } from '../document-numbering/services/document-numbering.service';
import { JsonSchemaService } from '../json-schema/json-schema.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { UserService } from '../user/user.service';
import { SearchService } from '../search/search.service';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { NotificationService } from '../notification/notification.service';

/**
 * CorrespondenceService - Document management (CRUD)
 */
interface ResolvedRecipient {
  organizationId: number;
  type: 'TO' | 'CC';
}
@Injectable()
export class CorrespondenceService {
  private readonly logger = new Logger(CorrespondenceService.name);

  private async hasSystemManageAllPermission(userId: number): Promise<boolean> {
    const permissions = await this.userService.getUserPermissions(userId);
    return permissions.includes('system.manage_all');
  }

  /**
   * Business Rule: Revision Label Strategy
   * - RFA, RFI: Use alphabet starting with 'A' (A, B, C...)
   * - Other types (LETTER, MEMO, etc.): Use numeric (null for first, then 1, 2, 3...)
   */
  private getInitialRevisionLabel(typeCode: string): string | undefined {
    const alphabetTypes = ['RFA', 'RFI'];
    if (alphabetTypes.includes(typeCode.toUpperCase())) {
      return 'A'; // Alphabet for RFA, RFI
    }
    return undefined; // Numeric (no label for revision 0)
  }

  constructor(
    @InjectRepository(Correspondence)
    private correspondenceRepo: Repository<Correspondence>,
    @InjectRepository(CorrespondenceRevision)
    private revisionRepo: Repository<CorrespondenceRevision>,
    @InjectRepository(CorrespondenceType)
    private typeRepo: Repository<CorrespondenceType>,
    @InjectRepository(CorrespondenceStatus)
    private statusRepo: Repository<CorrespondenceStatus>,
    @InjectRepository(CorrespondenceReference)
    private referenceRepo: Repository<CorrespondenceReference>,
    @InjectRepository(CorrespondenceTag)
    private tagRepo: Repository<CorrespondenceTag>,
    private numberingService: DocumentNumberingService,
    private jsonSchemaService: JsonSchemaService,
    private workflowEngine: WorkflowEngineService,
    private userService: UserService,
    private dataSource: DataSource,
    private searchService: SearchService,
    private fileStorageService: FileStorageService,
    private uuidResolver: UuidResolverService,
    private notificationService: NotificationService,
    @InjectRepository(CorrespondenceRevisionAttachment)
    private revAttachRepo: Repository<CorrespondenceRevisionAttachment>
  ) {}

  /**
   * Business Rule Validation: EC-CORR-003 - Correspondence to Self
   * Prevent external correspondence to same organization
   */
  private async validateCorrespondenceRecipients(
    createDto: CreateCorrespondenceDto,
    user: User
  ): Promise<void> {
    // Get user's organization
    let userOrgId = user.primaryOrganizationId;
    if (!userOrgId) {
      const fullUser = await this.userService.findOne(user.user_id);
      if (fullUser) {
        userOrgId = fullUser.primaryOrganizationId;
      }
    }

    if (!userOrgId) {
      if (createDto.originatorId) {
        const canManageAll = await this.hasSystemManageAllPermission(
          user.user_id
        );
        if (canManageAll) {
          userOrgId = await this.uuidResolver.resolveOrganizationId(
            createDto.originatorId
          );
        }
      }

      if (!userOrgId) {
        throw new BadRequestException(
          'User must belong to an organization to create documents'
        );
      }
    }

    // For impersonation, use the specified originator
    const originatorOrgId = createDto.originatorId
      ? await this.uuidResolver.resolveOrganizationId(createDto.originatorId)
      : userOrgId;

    // Check if it's internal communication
    if (createDto.isInternal) {
      // Internal communications should use Circulation instead
      throw new BadRequestException(
        'Internal communications should use Circulation Sheet instead of Correspondence'
      );
    }

    // Validate recipients
    if (!createDto.recipients || createDto.recipients.length === 0) {
      throw new BadRequestException(
        'At least one recipient (TO or CC) is required'
      );
    }

    const toRecipients = createDto.recipients.filter((r) => r.type === 'TO');
    const ccRecipients = createDto.recipients.filter((r) => r.type === 'CC');

    if (toRecipients.length === 0 && ccRecipients.length === 0) {
      throw new BadRequestException(
        'At least one TO or CC recipient is required'
      );
    }

    // Check for same organization correspondence
    for (const recipient of createDto.recipients) {
      const recipientOrgId = await this.uuidResolver.resolveOrganizationId(
        recipient.organizationId
      );

      if (recipientOrgId === originatorOrgId) {
        throw new BadRequestException(
          'Cannot send correspondence to your own organization. Use Circulation Sheet for internal communication.'
        );
      }
    }
  }

  async create(createDto: CreateCorrespondenceDto, user: User) {
    // Business Rule Validation: EC-CORR-003 - Correspondence to Self
    await this.validateCorrespondenceRecipients(createDto, user);
    // ADR-019: Resolve UUID references to internal INT IDs
    const resolvedProjectId = await this.uuidResolver.resolveProjectId(
      createDto.projectId
    );
    const resolvedOriginatorId = createDto.originatorId
      ? await this.uuidResolver.resolveOrganizationId(createDto.originatorId)
      : undefined;
    const resolvedRecipients = createDto.recipients
      ? await Promise.all(
          createDto.recipients.map(
            async (r): Promise<ResolvedRecipient> => ({
              organizationId: await this.uuidResolver.resolveOrganizationId(
                r.organizationId
              ),
              type: r.type,
            })
          )
        )
      : undefined;
    const type = await this.typeRepo.findOne({
      where: { id: createDto.typeId },
    });
    if (!type) throw new NotFoundException('Document Type not found');

    const statusDraft = await this.statusRepo.findOne({
      where: { statusCode: 'DRAFT' },
    });
    if (!statusDraft) {
      throw new InternalServerErrorException(
        'Status DRAFT not found in Master Data'
      );
    }

    let userOrgId = user.primaryOrganizationId;

    if (!userOrgId) {
      const fullUser = await this.userService.findOne(user.user_id);
      if (fullUser) {
        userOrgId = fullUser.primaryOrganizationId;
      }
    }

    // Impersonation Logic
    if (resolvedOriginatorId && resolvedOriginatorId !== userOrgId) {
      const canManageAll = await this.hasSystemManageAllPermission(
        user.user_id
      );
      if (!canManageAll) {
        throw new ForbiddenException(
          'You do not have permission to create documents on behalf of other organizations.'
        );
      }
      userOrgId = resolvedOriginatorId;
    }

    if (!userOrgId) {
      throw new BadRequestException(
        'User must belong to an organization to create documents'
      );
    }

    if (createDto.details) {
      try {
        await this.jsonSchemaService.validate(type.typeCode, createDto.details);
      } catch (error: unknown) {
        this.logger.warn(
          `Schema validation warning for ${type.typeCode}: ${(error as Error).message}`
        );
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // [Fix #6] Fetch real ORG Code from Organization entity
      const originatorOrg = await this.dataSource.manager.findOne(
        Organization,
        {
          where: { id: userOrgId },
        }
      );
      const orgCode = originatorOrg?.organizationCode ?? 'UNK';

      // [v1.5.1] Extract recipient organization from recipients array (Primary TO)
      const toRecipient = resolvedRecipients?.find((r) => r.type === 'TO');
      const recipientOrganizationId = toRecipient?.organizationId;

      let recipientCode = '';
      if (recipientOrganizationId) {
        const recOrg = await this.dataSource.manager.findOne(Organization, {
          where: { id: recipientOrganizationId },
        });
        if (recOrg) recipientCode = recOrg.organizationCode;
      }

      const docNumber = await this.numberingService.generateNextNumber({
        projectId: resolvedProjectId,
        originatorOrganizationId: userOrgId,
        typeId: createDto.typeId,
        disciplineId: createDto.disciplineId,
        subTypeId: createDto.subTypeId,
        recipientOrganizationId, // [v1.5.1] Pass recipient for document number format
        year: new Date().getFullYear(),
        customTokens: {
          TYPE_CODE: type.typeCode,
          ORG_CODE: orgCode,
          RECIPIENT_CODE: recipientCode,
          REC_CODE: recipientCode,
        },
      });

      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber.number,
        correspondenceTypeId: createDto.typeId,
        disciplineId: createDto.disciplineId,
        projectId: resolvedProjectId,
        originatorId: userOrgId,
        isInternal: createDto.isInternal || false,
        createdBy: user.user_id,
      });
      const savedCorr = await queryRunner.manager.save(correspondence);

      const revision = queryRunner.manager.create(CorrespondenceRevision, {
        correspondenceId: savedCorr.id,
        revisionNumber: 0,
        revisionLabel: this.getInitialRevisionLabel(type.typeCode),
        isCurrent: true,
        statusId: statusDraft.id,
        subject: createDto.subject,
        body: createDto.body,
        remarks: createDto.remarks,
        dueDate: createDto.dueDate ? new Date(createDto.dueDate) : undefined,
        documentDate: createDto.documentDate
          ? new Date(createDto.documentDate)
          : undefined,
        issuedDate: createDto.issuedDate
          ? new Date(createDto.issuedDate)
          : undefined,
        receivedDate: createDto.receivedDate
          ? new Date(createDto.receivedDate)
          : undefined,
        description: createDto.description,
        details: createDto.details,
        createdBy: user.user_id,
        schemaVersion: 1,
      });
      await queryRunner.manager.save(revision);

      // Save Recipients (using resolved INT IDs)
      if (resolvedRecipients && resolvedRecipients.length > 0) {
        const recipients = resolvedRecipients.map((r) =>
          queryRunner.manager.create(CorrespondenceRecipient, {
            correspondenceId: savedCorr.id,
            recipientOrganizationId: r.organizationId,
            recipientType: r.type,
          })
        );
        await queryRunner.manager.save(recipients);
      }

      // Commit attachments from Temp → Permanent (Two-Phase Storage)
      if (createDto.attachmentTempIds?.length) {
        const issueDate = createDto.issuedDate
          ? new Date(createDto.issuedDate)
          : createDto.documentDate
            ? new Date(createDto.documentDate)
            : undefined;

        // [FIX v1.8.1] commit ได้ Attachment records กลับมา → บันทึก junction
        const committed = await this.fileStorageService.commit(
          createDto.attachmentTempIds,
          { issueDate, documentType: 'Correspondence' }
        );

        if (committed.length > 0) {
          const links = committed.map((att, idx) =>
            queryRunner.manager.create(CorrespondenceRevisionAttachment, {
              correspondenceRevisionId: revision.id,
              attachmentId: att.id,
              isMainDocument: idx === 0, // ไฟล์แรกเป็น main document
            })
          );
          await queryRunner.manager.save(
            CorrespondenceRevisionAttachment,
            links
          );
        }
      }

      await queryRunner.commitTransaction();

      // Start Workflow Instance (non-blocking)
      try {
        const workflowCode = `CORRESPONDENCE_${type.typeCode}`;
        await this.workflowEngine.createInstance(
          workflowCode,
          'correspondence',
          savedCorr.id.toString(),
          {
            projectId: resolvedProjectId,
            originatorId: userOrgId,
            disciplineId: createDto.disciplineId,
            initiatorId: user.user_id,
          } as Record<string, unknown>
        );
      } catch (error: unknown) {
        this.logger.warn(
          `Workflow not started for ${docNumber.number} (Code: CORRESPONDENCE_${type.typeCode}): ${(error as Error).message}`
        );
      }

      // Fire-and-forget search indexing (non-blocking, void intentional)
      void this.searchService.indexDocument({
        id: savedCorr.id,
        publicId: savedCorr.publicId,
        type: 'correspondence',
        docNumber: docNumber.number,
        title: createDto.subject,
        description: createDto.description,
        status: 'DRAFT',
        projectId: resolvedProjectId,
        createdAt: new Date(),
      });

      return {
        ...savedCorr,
        currentRevision: revision,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create correspondence: ${(err as Error).message}`
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(searchDto: SearchCorrespondenceDto = {}) {
    const {
      search,
      typeId,
      projectId,
      statusId,
      status,
      page = 1,
      limit = 10,
    } = searchDto;
    const skip = (page - 1) * limit;

    // Change: Query from Revision Repo
    const query = this.revisionRepo
      .createQueryBuilder('rev')
      .leftJoinAndSelect('rev.correspondence', 'corr')
      .leftJoinAndSelect('corr.type', 'type')
      .leftJoinAndSelect('corr.project', 'project')
      .leftJoinAndSelect('corr.originator', 'org')
      .leftJoinAndSelect('rev.status', 'status');

    // Filter by Revision Status
    const revStatus = searchDto.revisionStatus || 'CURRENT';

    if (revStatus === 'CURRENT') {
      query.where('rev.isCurrent = :isCurrent', { isCurrent: true });
    } else if (revStatus === 'OLD') {
      query.where('rev.isCurrent = :isCurrent', { isCurrent: false });
    }
    // If 'ALL', no filter needed on isCurrent

    if (projectId) {
      query.andWhere('corr.projectId = :projectId', { projectId });
    }

    if (typeId) {
      query.andWhere('corr.correspondenceTypeId = :typeId', { typeId });
    }

    if (statusId) {
      query.andWhere('rev.statusId = :statusId', { statusId });
    }

    if (status) {
      query.andWhere('status.statusCode = :status', { status });
    }

    if (search) {
      query.andWhere(
        '(corr.correspondenceNumber LIKE :search OR rev.subject LIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Default Sort: Latest Created
    query.orderBy('rev.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await query.getManyAndCount();

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

  async findOne(id: number) {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { id },
      relations: [
        'revisions',
        'revisions.status',
        'type',
        'project',
        'originator',
        'recipients',
        'recipients.recipientOrganization', // [v1.5.1] Fixed relation name
        'discipline',
        'discipline.contract',
      ],
    });

    if (!correspondence) {
      throw new NotFoundException(`Correspondence with ID ${id} not found`);
    }
    return correspondence;
  }

  async findOneByUuid(publicId: string) {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { publicId },
      relations: [
        'revisions',
        'revisions.status',
        'revisions.attachmentLinks', // [FIX v1.8.1] โหลด junction
        'revisions.attachmentLinks.attachment', // [FIX v1.8.1] โหลด attachment จริง
        'type',
        'project',
        'originator',
        'recipients',
        'recipients.recipientOrganization',
        'discipline',
        'discipline.contract',
      ],
    });

    if (!correspondence) {
      throw new NotFoundException(
        `Correspondence with UUID ${publicId} not found`
      );
    }
    return correspondence;
  }

  async addReference(id: number, dto: AddReferenceDto) {
    const source = await this.correspondenceRepo.findOne({ where: { id } });
    // ADR-019: Resolve target publicId → internal INT id
    const target = await this.correspondenceRepo.findOne({
      where: { publicId: dto.targetUuid },
    });

    if (!source || !target) {
      throw new NotFoundException('Source or Target correspondence not found');
    }

    if (source.id === target.id) {
      throw new BadRequestException('Cannot reference self');
    }

    const exists = await this.referenceRepo.findOne({
      where: {
        sourceId: id,
        targetId: target.id,
      },
    });

    if (exists) {
      return exists;
    }

    const ref = this.referenceRepo.create({
      sourceId: id,
      targetId: target.id,
    });

    return this.referenceRepo.save(ref);
  }

  async removeReference(id: number, targetId: number) {
    const result = await this.referenceRepo.delete({
      sourceId: id,
      targetId: targetId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Reference not found');
    }
  }

  async getTags(id: number) {
    const rows = await this.tagRepo.find({
      where: { correspondenceId: id },
      relations: ['tag'],
    });
    return rows.map((r) => r.tag).filter(Boolean);
  }

  async addTag(id: number, tagId: number) {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { id },
    });
    if (!correspondence) {
      throw new NotFoundException(`Correspondence ${id} not found`);
    }

    const tag = await this.dataSource.manager.findOne(Tag, {
      where: { id: tagId },
    });
    if (!tag) {
      throw new NotFoundException(`Tag ${tagId} not found`);
    }

    const exists = await this.tagRepo.findOne({
      where: { correspondenceId: id, tagId },
    });
    if (exists) return exists;

    const row = this.tagRepo.create({ correspondenceId: id, tagId });
    return this.tagRepo.save(row);
  }

  async removeTag(id: number, tagId: number) {
    const result = await this.tagRepo.delete({ correspondenceId: id, tagId });
    if (result.affected === 0) {
      throw new NotFoundException('Tag assignment not found');
    }
  }

  async getReferences(id: number) {
    const outgoing = await this.referenceRepo.find({
      where: { sourceId: id },
      relations: ['target', 'target.type'],
    });

    const incoming = await this.referenceRepo.find({
      where: { targetId: id },
      relations: ['source', 'source.type'],
    });

    return { outgoing, incoming };
  }

  async update(id: number, updateDto: UpdateCorrespondenceDto, user: User) {
    // 1. Find Current Revision
    const revision = await this.revisionRepo.findOne({
      where: {
        correspondenceId: id,
        isCurrent: true,
      },
      relations: ['correspondence'],
    });

    if (!revision) {
      throw new NotFoundException(
        `Current revision for correspondence ${id} not found`
      );
    }

    // 2. Check Permission
    if (revision.statusId) {
      const status = await this.statusRepo.findOne({
        where: { id: revision.statusId },
      });

      if (status && status.statusCode !== 'DRAFT') {
        const permissions = await this.userService.getUserPermissions(
          user.user_id
        );
        const canEditSubmittedOrLater =
          permissions.includes('correspondence.cancel') ||
          permissions.includes('system.manage_all');

        if (!canEditSubmittedOrLater) {
          throw new ForbiddenException(
            'Only Org Admin or Superadmin can edit non-draft correspondences'
          );
        }
      }
    }

    // ADR-019: Resolve UUID references in update DTO
    const updResolvedProjectId = updateDto.projectId
      ? await this.uuidResolver.resolveProjectId(updateDto.projectId)
      : undefined;
    const updResolvedOriginatorId = updateDto.originatorId
      ? await this.uuidResolver.resolveOrganizationId(updateDto.originatorId)
      : undefined;
    const updResolvedRecipients = updateDto.recipients
      ? await Promise.all(
          updateDto.recipients.map(
            async (r): Promise<ResolvedRecipient> => ({
              organizationId: await this.uuidResolver.resolveOrganizationId(
                r.organizationId
              ),
              type: r.type,
            })
          )
        )
      : undefined;

    // 3. Update Correspondence Entity if needed
    const correspondenceUpdate: Record<string, unknown> = {};
    if (updateDto.disciplineId)
      correspondenceUpdate.disciplineId = updateDto.disciplineId;
    if (updResolvedProjectId)
      correspondenceUpdate.projectId = updResolvedProjectId;
    if (updResolvedOriginatorId)
      correspondenceUpdate.originatorId = updResolvedOriginatorId;

    if (Object.keys(correspondenceUpdate).length > 0) {
      await this.correspondenceRepo.update(id, correspondenceUpdate);
    }

    // 4. Update Revision Entity
    const revisionUpdate: Record<string, unknown> = {};
    if (updateDto.subject) revisionUpdate.subject = updateDto.subject;
    if (updateDto.body) revisionUpdate.body = updateDto.body;
    if (updateDto.remarks) revisionUpdate.remarks = updateDto.remarks;
    // Format Date correctly if string
    if (updateDto.dueDate) revisionUpdate.dueDate = new Date(updateDto.dueDate);
    if (updateDto.documentDate)
      revisionUpdate.documentDate = new Date(updateDto.documentDate);
    if (updateDto.issuedDate)
      revisionUpdate.issuedDate = new Date(updateDto.issuedDate);
    if (updateDto.receivedDate)
      revisionUpdate.receivedDate = new Date(updateDto.receivedDate);
    if (updateDto.description)
      revisionUpdate.description = updateDto.description;
    if (updateDto.details) revisionUpdate.details = updateDto.details;

    if (Object.keys(revisionUpdate).length > 0) {
      await this.revisionRepo.update(revision.id, revisionUpdate);
    }

    // 4.5 Commit new attachments from Temp → Permanent (Two-Phase Storage)
    if (updateDto.attachmentTempIds?.length) {
      const issueDate = updateDto.issuedDate
        ? new Date(updateDto.issuedDate)
        : updateDto.documentDate
          ? new Date(updateDto.documentDate)
          : revision.issuedDate || revision.documentDate || undefined;

      // [FIX v1.8.1] commit ได้ Attachment records กลับมา → บันทึก junction
      const committed = await this.fileStorageService.commit(
        updateDto.attachmentTempIds,
        {
          issueDate: issueDate ? new Date(issueDate) : undefined,
          documentType: 'Correspondence',
        }
      );

      if (committed.length > 0) {
        const links = committed.map((att) =>
          this.revAttachRepo.create({
            correspondenceRevisionId: revision.id,
            attachmentId: att.id,
            isMainDocument: false, // ไฟล์ที่ upload เพิ่มเติมไม่ใช่ main
          })
        );
        await this.revAttachRepo.save(links);
      }
    }

    // 5. Update Recipients if provided
    if (updResolvedRecipients) {
      const recipientRepo = this.dataSource.getRepository(
        CorrespondenceRecipient
      );
      await recipientRepo.delete({ correspondenceId: id });

      const newRecipients = updResolvedRecipients.map((r) =>
        recipientRepo.create({
          correspondenceId: id,
          recipientOrganizationId: r.organizationId,
          recipientType: r.type,
        })
      );
      await recipientRepo.save(newRecipients);
    }

    // 6. Regenerate Document Number if structural fields changed (Recipient, Discipline, Type, Project)
    // AND it is a DRAFT.

    // Fetch fresh data for context and comparison
    const currentCorr = await this.correspondenceRepo.findOne({
      where: { id },
      relations: ['type', 'recipients', 'recipients.recipientOrganization'],
    });

    if (currentCorr) {
      const currentToRecipient = currentCorr.recipients?.find(
        (r) => r.recipientType === 'TO'
      );
      const currentRecipientId = currentToRecipient?.recipientOrganizationId;

      // Check for ACTUAL value changes
      const isProjectChanged =
        updResolvedProjectId !== undefined &&
        updResolvedProjectId !== currentCorr.projectId;
      const isOriginatorChanged =
        updResolvedOriginatorId !== undefined &&
        updResolvedOriginatorId !== currentCorr.originatorId;
      const isDisciplineChanged =
        updateDto.disciplineId !== undefined &&
        updateDto.disciplineId !== currentCorr.disciplineId;
      const isTypeChanged =
        updateDto.typeId !== undefined &&
        updateDto.typeId !== currentCorr.correspondenceTypeId;

      let isRecipientChanged = false;
      let newRecipientId: number | undefined;

      if (updResolvedRecipients) {
        const newToRecipient = updResolvedRecipients.find(
          (r) => r.type === 'TO'
        );
        newRecipientId = newToRecipient?.organizationId;

        if (newRecipientId !== currentRecipientId) {
          isRecipientChanged = true;
        }
      }

      if (
        isProjectChanged ||
        isDisciplineChanged ||
        isTypeChanged ||
        isRecipientChanged ||
        isOriginatorChanged
      ) {
        const targetRecipientId = isRecipientChanged
          ? newRecipientId
          : currentRecipientId;

        // Resolve Recipient Code for the NEW context
        let recipientCode = '';
        if (targetRecipientId) {
          const recOrg = await this.dataSource.manager.findOne(Organization, {
            where: { id: targetRecipientId },
          });
          if (recOrg) recipientCode = recOrg.organizationCode;
        }

        // [Fix #6] Fetch real ORG Code from originator organization
        const originatorOrgForUpdate = await this.dataSource.manager.findOne(
          Organization,
          {
            where: {
              id: updResolvedOriginatorId ?? currentCorr.originatorId ?? 0,
            },
          }
        );
        const orgCode = originatorOrgForUpdate?.organizationCode ?? 'UNK';

        // Prepare Contexts
        const oldCtx = {
          projectId: currentCorr.projectId,
          originatorOrganizationId: currentCorr.originatorId ?? 0,
          typeId: currentCorr.correspondenceTypeId,
          disciplineId: currentCorr.disciplineId,
          recipientOrganizationId: currentRecipientId,
          year: new Date().getFullYear(),
        };

        const newCtx = {
          projectId: updResolvedProjectId ?? currentCorr.projectId,
          originatorOrganizationId:
            updResolvedOriginatorId ?? currentCorr.originatorId ?? 0,
          typeId: updateDto.typeId ?? currentCorr.correspondenceTypeId,
          disciplineId: updateDto.disciplineId ?? currentCorr.disciplineId,
          recipientOrganizationId: targetRecipientId,
          year: new Date().getFullYear(),
          userId: user.user_id, // Pass User ID for Audit
          customTokens: {
            TYPE_CODE: currentCorr.type?.typeCode || '',
            ORG_CODE: orgCode,
            RECIPIENT_CODE: recipientCode,
            REC_CODE: recipientCode,
          },
        };

        // If Type Changed, need NEW Type Code
        if (isTypeChanged) {
          const newType = await this.typeRepo.findOne({
            where: { id: newCtx.typeId },
          });
          if (newType) newCtx.customTokens.TYPE_CODE = newType.typeCode;
        }

        const newDocNumber = await this.numberingService.updateNumberForDraft(
          currentCorr.correspondenceNumber,
          oldCtx,
          newCtx
        );

        await this.correspondenceRepo.update(id, {
          correspondenceNumber: newDocNumber,
        });
      }
    }

    const updated = await this.findOne(id);

    // Re-index updated document in Elasticsearch (fire-and-forget)
    void this.searchService.indexDocument({
      id: updated.id,
      publicId: updated.publicId,
      type: 'correspondence',
      docNumber: updated.correspondenceNumber,
      title: updateDto.subject ?? updated.revisions?.[0]?.subject,
      description: updateDto.description ?? updated.revisions?.[0]?.description,
      status: 'DRAFT',
      projectId: updated.projectId,
      createdAt: updated.createdAt,
    });

    return updated;
  }

  async previewDocumentNumber(createDto: CreateCorrespondenceDto, user: User) {
    // ADR-019: Resolve UUID references
    const previewProjectId = await this.uuidResolver.resolveProjectId(
      createDto.projectId
    );
    const previewOriginatorId = createDto.originatorId
      ? await this.uuidResolver.resolveOrganizationId(createDto.originatorId)
      : undefined;
    const previewRecipients = createDto.recipients
      ? await Promise.all(
          createDto.recipients.map(
            async (r): Promise<ResolvedRecipient> => ({
              organizationId: await this.uuidResolver.resolveOrganizationId(
                r.organizationId
              ),
              type: r.type,
            })
          )
        )
      : undefined;

    const type = await this.typeRepo.findOne({
      where: { id: createDto.typeId },
    });
    if (!type) throw new NotFoundException('Document Type not found');

    let userOrgId = user.primaryOrganizationId;
    if (!userOrgId) {
      const fullUser = await this.userService.findOne(user.user_id);
      if (fullUser) userOrgId = fullUser.primaryOrganizationId;
    }

    if (previewOriginatorId && previewOriginatorId !== userOrgId) {
      // Allow impersonation for preview
      userOrgId = previewOriginatorId;
    }

    // Extract recipient from recipients array
    const toRecipient = previewRecipients?.find((r) => r.type === 'TO');
    const recipientOrganizationId = toRecipient?.organizationId;

    let recipientCode = '';
    if (recipientOrganizationId) {
      const recOrg = await this.dataSource.manager.findOne(Organization, {
        where: { id: recipientOrganizationId },
      });
      if (recOrg) recipientCode = recOrg.organizationCode;
    }

    return this.numberingService.previewNumber({
      projectId: previewProjectId,
      originatorOrganizationId: userOrgId!,
      typeId: createDto.typeId,
      disciplineId: createDto.disciplineId,
      subTypeId: createDto.subTypeId,
      recipientOrganizationId,
      year: new Date().getFullYear(),
      customTokens: {
        TYPE_CODE: type.typeCode,
        RECIPIENT_CODE: recipientCode,
        REC_CODE: recipientCode,
      },
    });
  }

  /**
   * Business Rule Implementation: EC-CORR-001 - Cancel Correspondence with Downstream Circulation
   * Cancel correspondence and handle related circulations
   */
  async cancel(publicId: string, reason: string, user: User) {
    const correspondence = await this.findOneByUuid(publicId);

    // Check if user has permission to cancel (Org Admin or Superadmin only)
    const permissions = await this.userService.getUserPermissions(user.user_id);
    const canCancel =
      permissions.includes('correspondence.cancel') ||
      permissions.includes('system.manage_all');

    if (!canCancel) {
      throw new ForbiddenException(
        'Only administrators can cancel correspondences'
      );
    }

    // Check if there are any active circulations
    const circulationRepo = this.dataSource.getRepository('Circulation');
    const activeCirculations = await circulationRepo.find({
      where: {
        correspondenceId: correspondence.id,
        status: 'OPEN',
      },
    });

    const warningMessage =
      activeCirculations.length > 0
        ? `There are ${activeCirculations.length} active circulation(s) for this correspondence. Canceling will force close all related circulations.`
        : '';

    // Get the current revision to update status
    const currentRevision = await this.revisionRepo.findOne({
      where: {
        correspondenceId: correspondence.id,
        isCurrent: true,
      },
    });

    if (!currentRevision) {
      throw new NotFoundException('Current revision not found');
    }

    // Get cancelled status
    const cancelledStatus = await this.statusRepo.findOne({
      where: { statusCode: 'CANCELLED' },
    });

    if (!cancelledStatus) {
      throw new InternalServerErrorException('CANCELLED status not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update correspondence revision status to CANCELLED
      await queryRunner.manager.update(
        CorrespondenceRevision,
        currentRevision.id,
        {
          statusId: cancelledStatus.id,
          remarks: `Cancelled: ${reason}`,
        }
      );

      // Force close all active circulations
      if (activeCirculations.length > 0) {
        await queryRunner.manager.update(
          'Circulation',
          {
            correspondenceId: correspondence.id,
            status: 'OPEN',
          },
          {
            status: 'FORCE_CLOSED',
            closedAt: new Date(),
            closedBy: user.user_id,
            closeReason: `Correspondence cancelled: ${reason}`,
          }
        );
      }

      await queryRunner.commitTransaction();

      // Re-index cancelled status in Elasticsearch (fire-and-forget)
      void this.searchService.indexDocument({
        id: correspondence.id,
        publicId: correspondence.publicId,
        type: 'correspondence',
        docNumber: correspondence.correspondenceNumber,
        title: currentRevision.subject,
        status: 'CANCELLED',
        projectId: correspondence.projectId,
        createdAt: correspondence.createdAt,
      });

      // Notify originator's doc-control user about cancellation (fire-and-forget)
      if (correspondence.originatorId) {
        void this.userService
          .findDocControlIdByOrg(correspondence.originatorId)
          .then((targetUserId) => {
            if (targetUserId) {
              void this.notificationService.send({
                userId: targetUserId,
                title: 'Correspondence Cancelled',
                message: `${correspondence.correspondenceNumber} — ${currentRevision.subject} has been cancelled. Reason: ${reason}`,
                type: 'EMAIL',
                entityType: 'correspondence',
                entityId: correspondence.id,
                link: `/correspondences/${correspondence.publicId}`,
              });
            }
          })
          .catch((err: Error) =>
            this.logger.warn(`Cancel notification failed: ${err.message}`)
          );
      }

      return {
        success: true,
        message: warningMessage || 'Correspondence cancelled successfully',
        activeCirculationsCount: activeCirculations.length,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to cancel correspondence: ${(error as Error).message}`
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async bulkCancel(
    publicIds: string[],
    reason: string,
    user: User
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const publicId of publicIds) {
      try {
        await this.cancel(publicId, reason, user);
        succeeded.push(publicId);
      } catch {
        failed.push(publicId);
      }
    }

    return { succeeded, failed };
  }

  async exportCsv(searchDto: SearchCorrespondenceDto): Promise<string> {
    const { data } = await this.findAll(searchDto);

    const header = [
      'Document No.',
      'Rev',
      'Subject',
      'Type',
      'Status',
      'Project',
      'From',
      'Due Date',
      'Created At',
    ];
    const rows = data.map((rev) => {
      const corr = rev.correspondence ?? (rev as unknown as Correspondence);
      return [
        this.escapeCsv(corr.correspondenceNumber ?? ''),
        this.escapeCsv(rev.revisionLabel ?? String(rev.revisionNumber ?? 0)),
        this.escapeCsv(rev.subject ?? ''),
        this.escapeCsv(corr.type?.typeCode ?? ''),
        this.escapeCsv(rev.status?.statusCode ?? ''),
        this.escapeCsv(corr.project?.projectCode ?? ''),
        this.escapeCsv(corr.originator?.organizationCode ?? ''),
        rev.dueDate ? new Date(rev.dueDate).toISOString().split('T')[0] : '',
        new Date(rev.createdAt).toISOString().split('T')[0],
      ].join(',');
    });

    return [header.join(','), ...rows].join('\n');
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
