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
import { User } from '../user/entities/user.entity';

// DTOs
import { CreateCorrespondenceDto } from './dto/create-correspondence.dto';
import { AddReferenceDto } from './dto/add-reference.dto';
import { SearchCorrespondenceDto } from './dto/search-correspondence.dto';

// Services
import { DocumentNumberingService } from '../document-numbering/document-numbering.service';
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

      // Extract recipient organization from details
      const recipientOrganizationId = createDto.details?.to_organization_id as
        | number
        | undefined;

      const docNumber = await this.numberingService.generateNextNumber({
        projectId: createDto.projectId,
        originatorId: userOrgId,
        typeId: createDto.typeId,
        disciplineId: createDto.disciplineId,
        subTypeId: createDto.subTypeId,
        recipientOrganizationId, // [v1.5.1] Pass recipient for document number format
        year: new Date().getFullYear(),
        customTokens: {
          TYPE_CODE: type.typeCode,
          ORG_CODE: orgCode,
        },
      });

      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber,
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
        title: createDto.title,
        description: createDto.description,
        details: createDto.details,
        createdBy: user.user_id,
      });
      await queryRunner.manager.save(revision);

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
          `Workflow not started for ${docNumber} (Code: CORRESPONDENCE_${type.typeCode}): ${(error as Error).message}`
        );
      }

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
        '(corr.correspondenceNumber LIKE :search OR rev.title LIKE :search)',
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
}
