import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm'; // เพิ่ม Not

import { Circulation } from './entities/circulation.entity';
import { CirculationRouting } from './entities/circulation-routing.entity';
import { User } from '../user/entities/user.entity';
import { CreateCirculationDto } from './dto/create-circulation.dto';
import { UpdateCirculationRoutingDto } from './dto/update-circulation-routing.dto'; // Import ใหม่
import { SearchCirculationDto } from './dto/search-circulation.dto'; // Import ใหม่

@Injectable()
export class CirculationService {
  constructor(
    @InjectRepository(Circulation)
    private circulationRepo: Repository<Circulation>,
    @InjectRepository(CirculationRouting)
    private routingRepo: Repository<CirculationRouting>,
    private dataSource: DataSource,
  ) {}

  async create(createDto: CreateCirculationDto, user: User) {
    if (!user.primaryOrganizationId) {
      throw new BadRequestException('User must belong to an organization');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate No. (Mock Logic) -> ควรใช้ NumberingService จริงในอนาคต
      const circulationNo = `CIR-${Date.now()}`;

      const circulation = queryRunner.manager.create(Circulation, {
        organizationId: user.primaryOrganizationId,
        correspondenceId: createDto.correspondenceId,
        circulationNo: circulationNo,
        subject: createDto.subject,
        statusCode: 'OPEN',
        createdByUserId: user.user_id,
      });
      const savedCirculation = await queryRunner.manager.save(circulation);

      if (createDto.assigneeIds && createDto.assigneeIds.length > 0) {
        const routings = createDto.assigneeIds.map((userId, index) =>
          queryRunner.manager.create(CirculationRouting, {
            circulationId: savedCirculation.id,
            stepNumber: index + 1,
            organizationId: user.primaryOrganizationId,
            assignedTo: userId,
            status: 'PENDING',
          }),
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
    const { search, status, page = 1, limit = 20 } = searchDto;
    const query = this.circulationRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.creator', 'creator')
      .where('c.organizationId = :orgId', {
        orgId: user.primaryOrganizationId,
      });

    if (status) {
      query.andWhere('c.statusCode = :status', { status });
    }

    if (search) {
      query.andWhere(
        '(c.circulationNo LIKE :search OR c.subject LIKE :search)',
        { search: `%${search}%` },
      );
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

  // ✅ Logic อัปเดตสถานะและปิดงาน
  async updateRoutingStatus(
    routingId: number,
    dto: UpdateCirculationRoutingDto,
    user: User,
  ) {
    const routing = await this.routingRepo.findOne({
      where: { id: routingId },
      relations: ['circulation'],
    });

    if (!routing) throw new NotFoundException('Routing task not found');

    // Check Permission: คนทำต้องเป็นเจ้าของ Task
    if (routing.assignedTo !== user.user_id) {
      throw new ForbiddenException('You are not assigned to this task');
    }

    // Update Routing
    routing.status = dto.status;
    routing.comments = dto.comments;
    routing.completedAt = new Date();
    await this.routingRepo.save(routing);

    // Check: ถ้าทุกคนทำเสร็จแล้ว ให้ปิดใบเวียน (Master)
    const pendingCount = await this.routingRepo.count({
      where: {
        circulationId: routing.circulationId,
        status: 'PENDING', // หรือ status ที่ยังไม่เสร็จ
      },
    });

    if (pendingCount === 0) {
      await this.circulationRepo.update(routing.circulationId, {
        statusCode: 'COMPLETED',
        closedAt: new Date(),
      });
    }

    return routing;
  }
}
