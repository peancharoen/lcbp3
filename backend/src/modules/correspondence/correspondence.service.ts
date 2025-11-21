import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

// Entities
import { Correspondence } from './entities/correspondence.entity.js';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity.js';
import { CorrespondenceType } from './entities/correspondence-type.entity.js';
import { CorrespondenceStatus } from './entities/correspondence-status.entity.js';
import { RoutingTemplate } from './entities/routing-template.entity.js';
import { CorrespondenceRouting } from './entities/correspondence-routing.entity.js';
import { User } from '../user/entities/user.entity.js';

// DTOs
import { CreateCorrespondenceDto } from './dto/create-correspondence.dto.js';
import { WorkflowActionDto } from './dto/workflow-action.dto.js';

// Interfaces
import { WorkflowAction } from '../workflow-engine/interfaces/workflow.interface.js';

// Services
import { DocumentNumberingService } from '../document-numbering/document-numbering.service.js';
import { JsonSchemaService } from '../json-schema/json-schema.service.js';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service.js';

@Injectable()
export class CorrespondenceService {
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

    private numberingService: DocumentNumberingService,
    private jsonSchemaService: JsonSchemaService,
    private workflowEngine: WorkflowEngineService,
    private dataSource: DataSource,
  ) {}

  // --- 1. CREATE DOCUMENT ---
  async create(createDto: CreateCorrespondenceDto, user: User) {
    // 1.1 Validate Basic Info
    const type = await this.typeRepo.findOne({
      where: { id: createDto.typeId },
    });
    if (!type) throw new NotFoundException('Document Type not found');

    const statusDraft = await this.statusRepo.findOne({
      where: { statusCode: 'DRAFT' },
    });
    if (!statusDraft) {
      throw new InternalServerErrorException('Status DRAFT not found');
    }

    const userOrgId = user.primaryOrganizationId;
    if (!userOrgId) {
      throw new BadRequestException('User must belong to an organization');
    }

    // 1.2 Validate JSON Details
    if (createDto.details) {
      try {
        await this.jsonSchemaService.validate(type.typeCode, createDto.details);
      } catch (error: any) {
        console.warn(`Schema validation warning: ${error.message}`);
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1.3 Generate Document Number (Double-Lock)
      const docNumber = await this.numberingService.generateNextNumber(
        createDto.projectId,
        userOrgId,
        createDto.typeId,
        new Date().getFullYear(),
        {
          TYPE_CODE: type.typeCode,
          ORG_CODE: 'ORG', // In real app, fetch user's org code
        },
      );

      // 1.4 Save Head
      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber,
        correspondenceTypeId: createDto.typeId,
        projectId: createDto.projectId,
        originatorId: userOrgId,
        isInternal: createDto.isInternal || false,
        createdBy: user.user_id,
      });
      const savedCorr = await queryRunner.manager.save(correspondence);

      // 1.5 Save First Revision
      const revision = queryRunner.manager.create(CorrespondenceRevision, {
        correspondenceId: savedCorr.id,
        revisionNumber: 0,
        revisionLabel: 'A',
        isCurrent: true,
        statusId: statusDraft.id,
        title: createDto.title,
        details: createDto.details,
        createdBy: user.user_id,
      });
      await queryRunner.manager.save(revision);

      await queryRunner.commitTransaction();

      return {
        ...savedCorr,
        currentRevision: revision,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // --- READ ---
  async findAll() {
    return this.correspondenceRepo.find({
      relations: ['revisions', 'type', 'project'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { id },
      relations: ['revisions', 'type', 'project'],
    });

    if (!correspondence) {
      throw new NotFoundException(`Correspondence with ID ${id} not found`);
    }
    return correspondence;
  }

  // --- 2. SUBMIT WORKFLOW ---
  async submit(correspondenceId: number, templateId: number, user: User) {
    // 2.1 Get Document & Current Revision
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

    // 2.2 Get Template Config
    const template = await this.templateRepo.findOne({
      where: { id: templateId },
      relations: ['steps'],
      order: { steps: { sequence: 'ASC' } },
    });

    if (!template || !template.steps?.length) {
      throw new BadRequestException('Invalid routing template');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const firstStep = template.steps[0];

      // 2.3 Create First Routing Record
      const routing = queryRunner.manager.create(CorrespondenceRouting, {
        correspondenceId: currentRevision.id,
        templateId: template.id, // ✅ Save templateId for reference
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

      await queryRunner.commitTransaction();
      return routing;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // --- 3. PROCESS ACTION (Approve/Reject/Return) ---
  async processAction(
    correspondenceId: number,
    dto: WorkflowActionDto,
    user: User,
  ) {
    // 3.1 Find Active Routing Step
    // Find correspondence first to ensure it exists
    const correspondence = await this.correspondenceRepo.findOne({
      where: { id: correspondenceId },
      relations: ['revisions'],
    });

    if (!correspondence)
      throw new NotFoundException('Correspondence not found');

    const currentRevision = correspondence.revisions?.find((r) => r.isCurrent);
    if (!currentRevision)
      throw new NotFoundException('Current revision not found');

    // Find the latest routing step
    const currentRouting = await this.routingRepo.findOne({
      where: {
        correspondenceId: currentRevision.id,
        // In real scenario, we might check status 'SENT' or 'RECEIVED'
      },
      order: { sequence: 'DESC' },
      relations: ['toOrganization'],
    });

    if (
      !currentRouting ||
      currentRouting.status === 'ACTIONED' ||
      currentRouting.status === 'REJECTED'
    ) {
      throw new BadRequestException(
        'No active workflow step found or step already processed',
      );
    }

    // 3.2 Check Permissions
    // User must belong to the target organization of the current step
    if (currentRouting.toOrganizationId !== user.primaryOrganizationId) {
      throw new BadRequestException(
        'You are not authorized to process this step',
      );
    }

    // 3.3 Load Template to find Next Step Config
    if (!currentRouting.templateId) {
      throw new InternalServerErrorException(
        'Routing record missing templateId',
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

    // 3.4 Calculate Next State using Workflow Engine
    const result = this.workflowEngine.processAction(
      currentSeq,
      totalSteps,
      dto.action,
      dto.returnToSequence,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 3.5 Update Current Step
      currentRouting.status =
        dto.action === WorkflowAction.REJECT ? 'REJECTED' : 'ACTIONED';
      currentRouting.processedByUserId = user.user_id;
      currentRouting.processedAt = new Date();
      currentRouting.comments = dto.comments;

      await queryRunner.manager.save(currentRouting);

      // 3.6 Create Next Step (If exists and not rejected)
      if (result.nextStepSequence && dto.action !== WorkflowAction.REJECT) {
        // ✅ Find config for next step from Template
        const nextStepConfig = template.steps.find(
          (s) => s.sequence === result.nextStepSequence,
        );

        if (!nextStepConfig) {
          throw new InternalServerErrorException(
            `Configuration for step ${result.nextStepSequence} not found`,
          );
        }

        const nextRouting = queryRunner.manager.create(CorrespondenceRouting, {
          correspondenceId: currentRevision.id,
          templateId: template.id,
          sequence: result.nextStepSequence,
          fromOrganizationId: user.primaryOrganizationId, // Forwarded by current user
          toOrganizationId: nextStepConfig.toOrganizationId, // ✅ Real Target from Template
          stepPurpose: nextStepConfig.stepPurpose, // ✅ Real Purpose from Template
          status: 'SENT',
          dueDate: new Date(
            Date.now() +
              (nextStepConfig.expectedDays || 7) * 24 * 60 * 60 * 1000,
          ),
        });
        await queryRunner.manager.save(nextRouting);
      }

      // 3.7 Update Document Status (Optional - if Engine suggests)
      if (result.shouldUpdateStatus) {
        // Example: Update revision status to APPROVED or REJECTED
        // await this.updateDocumentStatus(currentRevision, result.documentStatus);
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
}
