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

// Entitie
import { Correspondence } from './entities/correspondence.entity';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { CorrespondenceType } from './entities/correspondence-type.entity';
import { CorrespondenceStatus } from './entities/correspondence-status.entity';
import { RoutingTemplate } from './entities/routing-template.entity';
import { CorrespondenceRouting } from './entities/correspondence-routing.entity';
import { CorrespondenceReference } from './entities/correspondence-reference.entity';
import { User } from '../user/entities/user.entity';

// DTOs
import { CreateCorrespondenceDto } from './dto/create-correspondence.dto';
import { WorkflowActionDto } from './dto/workflow-action.dto';
import { AddReferenceDto } from './dto/add-reference.dto';
import { SearchCorrespondenceDto } from './dto/search-correspondence.dto';

// Interfaces & Enums
import { WorkflowAction } from '../workflow-engine/interfaces/workflow.interface';

// Services
import { DocumentNumberingService } from '../document-numbering/document-numbering.service';
import { JsonSchemaService } from '../json-schema/json-schema.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { UserService } from '../user/user.service';
import { SearchService } from '../search/search.service';

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
      } catch (error: any) {
        this.logger.warn(
          `Schema validation warning for ${type.typeCode}: ${error.message}`
        );
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const orgCode = 'ORG'; // TODO: Fetch real ORG Code from Organization Entity

      // [FIXED] เรียกใช้แบบ Object Context ตาม Requirement 6B
      const docNumber = await this.numberingService.generateNextNumber({
        projectId: createDto.projectId,
        originatorId: userOrgId,
        typeId: createDto.typeId,
        disciplineId: createDto.disciplineId, // ส่ง Discipline (ถ้ามี)
        subTypeId: createDto.subTypeId, // ส่ง SubType (ถ้ามี)
        year: new Date().getFullYear(),
        customTokens: {
          TYPE_CODE: type.typeCode,
          ORG_CODE: orgCode,
        },
      });

      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber,
        correspondenceTypeId: createDto.typeId,
        disciplineId: createDto.disciplineId, // บันทึก Discipline ลง DB
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

      // [NEW V1.5.1] Start Workflow Instance (After Commit)
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
        // Non-blocking: Document is created, but workflow might not be active.
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

  // ... (method อื่นๆ คงเดิม)
  async findAll(searchDto: SearchCorrespondenceDto = {}) {
    const { search, typeId, projectId, statusId } = searchDto;

    const query = this.correspondenceRepo
      .createQueryBuilder('corr')
      .leftJoinAndSelect('corr.revisions', 'rev')
      .leftJoinAndSelect('corr.type', 'type')
      .leftJoinAndSelect('corr.project', 'project')
      .leftJoinAndSelect('corr.originator', 'org')
      .where('rev.isCurrent = :isCurrent', { isCurrent: true });

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

    query.orderBy('corr.createdAt', 'DESC');

    return query.getMany();
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

    const template = await this.templateRepo.findOne({
      where: { id: templateId },
      relations: ['steps'],
      order: { steps: { sequence: 'ASC' } },
    });

    if (!template || !template.steps?.length) {
      throw new BadRequestException(
        'Invalid routing template or no steps defined'
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const firstStep = template.steps[0];

      const routing = queryRunner.manager.create(CorrespondenceRouting, {
        correspondenceId: currentRevision.id,
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

      await queryRunner.commitTransaction();
      return routing;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async processAction(
    correspondenceId: number,
    dto: WorkflowActionDto,
    user: User
  ) {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { id: correspondenceId },
      relations: ['revisions'],
    });

    if (!correspondence)
      throw new NotFoundException('Correspondence not found');

    const currentRevision = correspondence.revisions?.find((r) => r.isCurrent);
    if (!currentRevision)
      throw new NotFoundException('Current revision not found');

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
        'No active workflow step found for this document'
      );
    }

    if (currentRouting.toOrganizationId !== user.primaryOrganizationId) {
      throw new BadRequestException(
        'You are not authorized to process this step'
      );
    }

    if (!currentRouting.templateId) {
      throw new InternalServerErrorException(
        'Routing record missing templateId'
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

    const result = this.workflowEngine.processAction(
      currentSeq,
      totalSteps,
      dto.action,
      dto.returnToSequence
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
          (s) => s.sequence === result.nextStepSequence
        );

        if (!nextStepConfig) {
          this.logger.warn(
            `Next step ${result.nextStepSequence} not found in template`
          );
        } else {
          const nextRouting = queryRunner.manager.create(
            CorrespondenceRouting,
            {
              correspondenceId: currentRevision.id,
              templateId: template.id,
              sequence: result.nextStepSequence,
              fromOrganizationId: user.primaryOrganizationId,
              toOrganizationId: nextStepConfig.toOrganizationId,
              stepPurpose: nextStepConfig.stepPurpose,
              status: 'SENT',
              dueDate: new Date(
                Date.now() +
                  (nextStepConfig.expectedDays || 7) * 24 * 60 * 60 * 1000
              ),
            }
          );
          await queryRunner.manager.save(nextRouting);
        }
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
