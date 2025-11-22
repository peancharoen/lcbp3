import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Circulation } from './entities/circulation.entity';
import { CirculationRouting } from './entities/circulation-routing.entity';
import { User } from '../user/entities/user.entity';
import { CreateCirculationDto } from './dto/create-circulation.dto'; // ต้องสร้าง DTO นี้

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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Master Circulation
      // TODO: Generate Circulation No. logic here (Simple format)
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

      // 2. Create Routings (Assignees)
      if (createDto.assigneeIds && createDto.assigneeIds.length > 0) {
        const routings = createDto.assigneeIds.map((userId, index) =>
          queryRunner.manager.create(CirculationRouting, {
            circulationId: savedCirculation.id,
            stepNumber: index + 1,
            organizationId: user.primaryOrganizationId, // Internal routing
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

  async findOne(id: number) {
    const circulation = await this.circulationRepo.findOne({
      where: { id },
      relations: ['routings', 'routings.assignee', 'correspondence'],
    });
    if (!circulation) throw new NotFoundException('Circulation not found');
    return circulation;
  }

  // Method update status (Complete task)
  async updateRoutingStatus(
    routingId: number,
    status: string,
    comments: string,
    user: User,
  ) {
    // Logic to update routing status
    // and Check if all routings are completed -> Close Circulation
  }
}
