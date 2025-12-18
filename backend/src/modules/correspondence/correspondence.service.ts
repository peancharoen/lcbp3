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
import { User } from '../user/entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';

// DTOs
import { CreateCorrespondenceDto } from './dto/create-correspondence.dto';
import { UpdateCorrespondenceDto } from './dto/update-correspondence.dto';
import { AddReferenceDto } from './dto/add-reference.dto';
import { SearchCorrespondenceDto } from './dto/search-correspondence.dto';
import { DeepPartial } from 'typeorm';

// Services
import { DocumentNumberingService } from '../document-numbering/services/document-numbering.service';
import { JsonSchemaService } from '../json-schema/json-schema.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { UserService } from '../user/user.service';
import { SearchService } from '../search/search.service';

/**
 * CorrespondenceService - Document management (CRUD)
 *
 * NOTE: Workflow operations (submit, processAction) have been moved to
 * CorrespondenceWorkflowService which uses the Unified Workflow Engine.
 */
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
    @InjectRepository(CorrespondenceReference)
    private referenceRepo: Repository<CorrespondenceReference>,
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,

    private numberingService: DocumentNumberingService,
    private jsonSchemaService: JsonSchemaService,
    private workflowEngine: WorkflowEngineService,
    private userService: UserService,
    private dataSource: DataSource,
    private searchService: SearchService
  ) {}

  async create(createDto: CreateCorrespondenceDto, user: User) {
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
    if (createDto.originatorId && createDto.originatorId !== userOrgId) {
      const permissions = await this.userService.getUserPermissions(
        user.user_id
      );
      if (!permissions.includes('system.manage_all')) {
        throw new ForbiddenException(
          'You do not have permission to create documents on behalf of other organizations.'
        );
      }
      userOrgId = createDto.originatorId;
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
      const orgCode = 'ORG'; // TODO: Fetch real ORG Code from Organization Entity

      // [v1.5.1] Extract recipient organization from recipients array (Primary TO)
      const toRecipient = createDto.recipients?.find((r) => r.type === 'TO');
      const recipientOrganizationId = toRecipient?.organizationId;

      let recipientCode = '';
      if (recipientOrganizationId) {
        const recOrg = await this.orgRepo.findOne({
          where: { id: recipientOrganizationId },
        });
        if (recOrg) recipientCode = recOrg.organizationCode;
      }

      const docNumber = await this.numberingService.generateNextNumber({
        projectId: createDto.projectId,
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
        projectId: createDto.projectId,
        originatorId: userOrgId,
        isInternal: createDto.isInternal || false,
        createdBy: user.user_id,
      });
      const savedCorr = await queryRunner.manager.save(correspondence);

      const revision = queryRunner.manager.create(CorrespondenceRevision, {
        correspondenceId: savedCorr.id,
        revisionNumber: 0,
        revisionLabel: 'A',
        isCurrent: true,
        statusId: statusDraft.id,
        subject: createDto.subject,
        body: createDto.body,
        remarks: createDto.remarks,
        dueDate: createDto.dueDate ? new Date(createDto.dueDate) : undefined,
        description: createDto.description,
        details: createDto.details,
        createdBy: user.user_id,
        schemaVersion: 1,
      });
      await queryRunner.manager.save(revision);

      // Save Recipients
      if (createDto.recipients && createDto.recipients.length > 0) {
        const recipients = createDto.recipients.map((r) =>
          queryRunner.manager.create(CorrespondenceRecipient, {
            correspondenceId: savedCorr.id,
            recipientOrganizationId: r.organizationId,
            recipientType: r.type,
          })
        );
        await queryRunner.manager.save(recipients);
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
            projectId: createDto.projectId,
            originatorId: userOrgId,
            disciplineId: createDto.disciplineId,
            initiatorId: user.user_id,
          }
        );
      } catch (error) {
        this.logger.warn(
          `Workflow not started for ${docNumber.number} (Code: CORRESPONDENCE_${type.typeCode}): ${(error as Error).message}`
        );
      }

      this.searchService.indexDocument({
        id: savedCorr.id,
        type: 'correspondence',
        docNumber: docNumber.number,
        title: createDto.subject,
        description: createDto.description,
        status: 'DRAFT',
        projectId: createDto.projectId,
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
      ],
    });

    if (!correspondence) {
      throw new NotFoundException(`Correspondence with ID ${id} not found`);
    }
    return correspondence;
  }

  async addReference(id: number, dto: AddReferenceDto) {
    const source = await this.correspondenceRepo.findOne({ where: { id } });
    const target = await this.correspondenceRepo.findOne({
      where: { id: dto.targetId },
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
        targetId: dto.targetId,
      },
    });

    if (exists) {
      return exists;
    }

    const ref = this.referenceRepo.create({
      sourceId: id,
      targetId: dto.targetId,
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
        throw new BadRequestException('Only DRAFT documents can be updated');
      }
    }

    // 3. Update Correspondence Entity if needed
    const correspondenceUpdate: DeepPartial<Correspondence> = {};
    if (updateDto.disciplineId)
      correspondenceUpdate.disciplineId = updateDto.disciplineId;
    if (updateDto.projectId)
      correspondenceUpdate.projectId = updateDto.projectId;
    if (updateDto.originatorId)
      correspondenceUpdate.originatorId = updateDto.originatorId;

    if (Object.keys(correspondenceUpdate).length > 0) {
      await this.correspondenceRepo.update(id, correspondenceUpdate);
    }

    // 4. Update Revision Entity
    const revisionUpdate: DeepPartial<CorrespondenceRevision> = {};
    if (updateDto.subject) revisionUpdate.subject = updateDto.subject;
    if (updateDto.body) revisionUpdate.body = updateDto.body;
    if (updateDto.remarks) revisionUpdate.remarks = updateDto.remarks;
    // Format Date correctly if string
    if (updateDto.dueDate) revisionUpdate.dueDate = new Date(updateDto.dueDate);
    if (updateDto.description)
      revisionUpdate.description = updateDto.description;
    if (updateDto.details) revisionUpdate.details = updateDto.details;

    if (Object.keys(revisionUpdate).length > 0) {
      await this.revisionRepo.update(revision.id, revisionUpdate);
    }

    // 5. Update Recipients if provided
    if (updateDto.recipients) {
      const recipientRepo = this.dataSource.getRepository(
        CorrespondenceRecipient
      );
      await recipientRepo.delete({ correspondenceId: id });

      const newRecipients = updateDto.recipients.map((r) =>
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
        updateDto.projectId !== undefined &&
        updateDto.projectId !== currentCorr.projectId;
      const isOriginatorChanged =
        updateDto.originatorId !== undefined &&
        updateDto.originatorId !== currentCorr.originatorId;
      const isDisciplineChanged =
        updateDto.disciplineId !== undefined &&
        updateDto.disciplineId !== currentCorr.disciplineId;
      const isTypeChanged =
        updateDto.typeId !== undefined &&
        updateDto.typeId !== currentCorr.correspondenceTypeId;

      let isRecipientChanged = false;
      let newRecipientId: number | undefined;

      if (updateDto.recipients) {
        // Safe check for 'type' or 'recipientType' (mismatch safeguard)
        const newToRecipient = updateDto.recipients.find(
          (r: any) => r.type === 'TO' || r.recipientType === 'TO'
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
          const recOrg = await this.orgRepo.findOne({
            where: { id: targetRecipientId },
          });
          if (recOrg) recipientCode = recOrg.organizationCode;
        }

        const orgCode = 'ORG'; // Placeholder - should be fetched from Originator if needed in future

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
          projectId: updateDto.projectId ?? currentCorr.projectId,
          originatorOrganizationId:
            updateDto.originatorId ?? currentCorr.originatorId ?? 0,
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

    return this.findOne(id);
  }

  async previewDocumentNumber(createDto: CreateCorrespondenceDto, user: User) {
    const type = await this.typeRepo.findOne({
      where: { id: createDto.typeId },
    });
    if (!type) throw new NotFoundException('Document Type not found');

    let userOrgId = user.primaryOrganizationId;
    if (!userOrgId) {
      const fullUser = await this.userService.findOne(user.user_id);
      if (fullUser) userOrgId = fullUser.primaryOrganizationId;
    }

    if (createDto.originatorId && createDto.originatorId !== userOrgId) {
      // Allow impersonation for preview
      userOrgId = createDto.originatorId;
    }

    // Extract recipient from recipients array
    const toRecipient = createDto.recipients?.find((r) => r.type === 'TO');
    const recipientOrganizationId = toRecipient?.organizationId;

    let recipientCode = '';
    if (recipientOrganizationId) {
      const recOrg = await this.orgRepo.findOne({
        where: { id: recipientOrganizationId },
      });
      if (recOrg) recipientCode = recOrg.organizationCode;
    }

    return this.numberingService.previewNumber({
      projectId: createDto.projectId,
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
}
