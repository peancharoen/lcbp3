import { Injectable, Logger } from '@nestjs/common';
import {
  NotFoundException,
  PermissionException,
  ValidationException,
} from '../../common/exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Circulation } from './entities/circulation.entity';
import { CirculationRouting } from './entities/circulation-routing.entity';
import { User } from '../user/entities/user.entity';
import { CreateCirculationDto } from './dto/create-circulation.dto';
import { UpdateCirculationRoutingDto } from './dto/update-circulation-routing.dto';
import { SearchCirculationDto } from './dto/search-circulation.dto';
import { DocumentNumberingService } from '../document-numbering/services/document-numbering.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { UserService } from '../user/user.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';

@Injectable()
export class CirculationService {
  private readonly logger = new Logger(CirculationService.name);

  private async hasSystemManageAllPermission(userId: number): Promise<boolean> {
    const permissions = await this.userService.getUserPermissions(userId);
    return permissions.includes('system.manage_all');
  }

  constructor(
    @InjectRepository(Circulation)
    private circulationRepo: Repository<Circulation>,
    @InjectRepository(CirculationRouting)
    private routingRepo: Repository<CirculationRouting>,
    private numberingService: DocumentNumberingService,
    private dataSource: DataSource,
    private uuidResolver: UuidResolverService,
    private userService: UserService,
    private workflowEngine: WorkflowEngineService
  ) {}

  async create(createDto: CreateCirculationDto, user: User) {
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
          'circulation',
          'create on behalf of other organization'
        );
      }
      userOrgId = resolvedOriginatorId;
    }

    if (!userOrgId) {
      throw new ValidationException(
        'User must belong to an organization to create a circulation'
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ADR-019: Resolve UUID references to internal INT IDs
      const resolvedProjectId = createDto.projectId
        ? await this.uuidResolver.resolveProjectId(createDto.projectId)
        : 0;
      const resolvedCorrId = await this.uuidResolver.resolveCorrespondenceId(
        createDto.correspondenceId
      );
      const resolvedAssigneeIds = await Promise.all(
        createDto.assigneeIds.map((id) => this.uuidResolver.resolveUserId(id))
      );

      // Generate No. using DocumentNumberingService (Type 900 - Circulation)
      const result = await this.numberingService.generateNextNumber({
        projectId: resolvedProjectId,
        originatorOrganizationId: userOrgId,
        typeId: 900, // Fixed Type ID for Circulation
        year: new Date().getFullYear(),
        customTokens: {
          TYPE_CODE: 'CIR',
          ORG_CODE: 'ORG',
        },
      });

      const circulation = queryRunner.manager.create(Circulation, {
        organizationId: userOrgId,
        correspondenceId: resolvedCorrId,
        circulationNo: result.number,
        subject: createDto.subject,
        statusCode: 'OPEN',
        createdByUserId: user.user_id,
      });
      const savedCirculation = await queryRunner.manager.save(circulation);

      if (resolvedAssigneeIds.length > 0) {
        const routings = resolvedAssigneeIds.map((assigneeId, index) =>
          queryRunner.manager.create(CirculationRouting, {
            circulationId: savedCirculation.id,
            stepNumber: index + 1,
            organizationId: userOrgId,
            assignedTo: assigneeId,
            status: 'PENDING',
          })
        );
        await queryRunner.manager.save(routings);
      }

      await queryRunner.commitTransaction();
      return savedCirculation;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(searchDto: SearchCirculationDto, user: User) {
    const { status, correspondencePublicId, page = 1, limit = 20 } = searchDto;

    // Handle users without primary organization gracefully
    if (!user.primaryOrganizationId && !correspondencePublicId) {
      return { data: [], meta: { total: 0, page, limit } };
    }

    const query = this.circulationRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.creator', 'creator')
      .leftJoinAndSelect('c.routings', 'routings')
      .leftJoinAndSelect('routings.assignee', 'assignee')
      .leftJoinAndSelect('c.correspondence', 'correspondence');

    if (correspondencePublicId) {
      query.where('correspondence.publicId = :corrPublicId', {
        corrPublicId: correspondencePublicId,
      });
    } else {
      query.where('c.organizationId = :orgId', {
        orgId: user.primaryOrganizationId,
      });
    }

    if (status) {
      query.andWhere('c.statusCode = :status', { status });
    }

    query
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async findOne(id: number) {
    const circulation = await this.circulationRepo.findOne({
      where: { id },
      relations: ['routings', 'routings.assignee', 'correspondence', 'creator'],
      order: { routings: { stepNumber: 'ASC' } },
    });
    if (!circulation) throw new NotFoundException('Circulation not found');
    return circulation;
  }

  async findOneByUuid(publicId: string) {
    const circulation = await this.circulationRepo.findOne({
      where: { publicId },
      relations: ['routings', 'routings.assignee', 'correspondence', 'creator'],
      order: { routings: { stepNumber: 'ASC' } },
    });
    if (!circulation)
      throw new NotFoundException(`Circulation publicId ${publicId} not found`);

    // v1.8.7: ดึง Workflow Instance สำหรับ Circulation นี้ (nullable — ก่อน Submit ไม่มี Instance)
    const wfInstance = await this.workflowEngine.getInstanceByEntity(
      'circulation',
      circulation.id.toString()
    );

    return {
      ...circulation,
      workflowInstanceId: wfInstance?.id,
      workflowState: wfInstance?.currentState,
      availableActions: wfInstance?.availableActions ?? [],
    };
  }

  /**
   * EC-CIRC-001: Re-assign routing เมื่อ Assignee ถูก Deactivate (v1.8.7)
   * ต้องมีสิทธิ์ circulation.manage
   */
  async reassignRouting(
    routingId: number,
    newAssigneePublicId: string,
    user: User
  ) {
    const routing = await this.routingRepo.findOne({
      where: { id: routingId },
      relations: ['circulation'],
    });
    if (!routing)
      throw new NotFoundException('Circulation Routing', String(routingId));

    if (routing.status !== 'PENDING') {
      throw new ValidationException(
        `Routing ID ${routingId} ไม่ได้อยู่ใน PENDING จึงไม่สามารถ Re-assign ได้`
      );
    }

    const newAssigneeId =
      await this.uuidResolver.resolveUserId(newAssigneePublicId);
    routing.assignedTo = newAssigneeId;
    const saved = await this.routingRepo.save(routing);

    this.logger.log(
      `Circulation routing ${routingId} reassigned to user ${newAssigneeId} by ${user.user_id}`
    );
    return saved;
  }

  /**
   * EC-CIRC-002: Force Close Circulation พร้อม reason บังคับ (v1.8.7)
   * ปิด routing ที่ PENDING ทั้งหมด + เปลี่ยน statusCode เป็น CANCELLED
   * ต้องมีสิทธิ์ circulation.manage
   */
  async forceClose(publicId: string, reason: string, user: User) {
    if (!reason || reason.trim().length === 0) {
      throw new ValidationException('กรุณาระบุเหตุผลในการปิดใบเวียนแบบบังคับ');
    }

    const circulation = await this.circulationRepo.findOne({
      where: { publicId },
      relations: ['routings'],
    });
    if (!circulation)
      throw new NotFoundException(`Circulation publicId ${publicId}`);

    if (
      circulation.statusCode === 'COMPLETED' ||
      circulation.statusCode === 'CANCELLED'
    ) {
      throw new ValidationException(
        `ใบเวียน ${circulation.circulationNo} ปิดไปแล้ว (${circulation.statusCode})`
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ปิด routing ที่ยัง PENDING ทั้งหมด
      const pendingRoutings = circulation.routings.filter(
        (r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS'
      );
      for (const routing of pendingRoutings) {
        routing.status = 'REJECTED';
        routing.comments = `Force closed by user ${user.user_id}: ${reason}`;
        routing.completedAt = new Date();
        await queryRunner.manager.save(routing);
      }

      // อัปเดตสถานะ Circulation เป็น CANCELLED
      circulation.statusCode = 'CANCELLED';
      circulation.closedAt = new Date();
      await queryRunner.manager.save(circulation);

      await queryRunner.commitTransaction();
      this.logger.log(
        `Circulation ${publicId} force-closed by user ${user.user_id}. Reason: ${reason}`
      );
      return { success: true, affectedRoutings: pendingRoutings.length };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Force close failed for ${publicId}: ${(err as Error).message}`
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ✅ Logic อัปเดตสถานะและปิดงาน
  async updateRoutingStatus(
    routingId: number,
    dto: UpdateCirculationRoutingDto,
    user: User
  ) {
    const routing = await this.routingRepo.findOne({
      where: { id: routingId },
      relations: ['circulation'],
    });

    if (!routing)
      throw new NotFoundException('Routing task', String(routingId));

    // Check Permission: คนทำต้องเป็นเจ้าของ Task
    if (routing.assignedTo !== user.user_id) {
      throw new PermissionException('circulation routing task', 'process');
    }

    // Update Routing
    routing.status = dto.status;
    routing.comments = dto.comments;
    routing.completedAt = new Date();
    await this.routingRepo.save(routing);

    // Check: ถ้าทุกคนทำเสร็จแล้ว ให้ปิดใบเวียน (Master)
    // Bug 5 fix: นับทั้ง PENDING และ IN_PROGRESS — forceClose() ปิดทั้งสองสถานะ
    const pendingCount = await this.routingRepo
      .createQueryBuilder('r')
      .where('r.circulationId = :cid', { cid: routing.circulationId })
      .andWhere('r.status IN (:...statuses)', {
        statuses: ['PENDING', 'IN_PROGRESS'],
      })
      .getCount();

    if (pendingCount === 0) {
      await this.circulationRepo.update(routing.circulationId, {
        statusCode: 'COMPLETED',
        closedAt: new Date(),
      });
    }

    return routing;
  }
}
