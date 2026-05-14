// File: src/modules/delegation/delegation.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delegation } from './entities/delegation.entity';
import { User } from '../user/entities/user.entity';
import { CircularDetectionService } from './services/circular-detection.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { DelegationScope } from '../common/enums/review.enums';

@Injectable()
export class DelegationService {
  private readonly logger = new Logger(DelegationService.name);

  constructor(
    @InjectRepository(Delegation)
    private readonly delegationRepo: Repository<Delegation>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly circularDetectionService: CircularDetectionService
  ) {}

  /**
   * สร้าง Delegation ใหม่ พร้อมตรวจสอบ Circular (FR-011, FR-012)
   */
  async create(
    delegatorPublicId: string,
    dto: CreateDelegationDto
  ): Promise<Delegation> {
    const delegator = await this.userRepo.findOne({
      where: { publicId: delegatorPublicId },
    });
    if (!delegator)
      throw new NotFoundException(`User not found: ${delegatorPublicId}`);

    const delegate = await this.userRepo.findOne({
      where: { publicId: dto.delegateUserPublicId },
    });
    if (!delegate)
      throw new NotFoundException(
        `Delegate user not found: ${dto.delegateUserPublicId}`
      );

    // ตรวจสอบ date range
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    // ตรวจสอบ Circular Delegation (ADR requirement)
    const isCircular = await this.circularDetectionService.wouldCreateCircle(
      delegator.user_id,
      delegate.user_id,
      dto.startDate
    );

    if (isCircular) {
      throw new BadRequestException(
        'Circular delegation detected — this would create a delegation loop'
      );
    }

    const delegateOnward = await this.findActiveDelegate(
      delegate.user_id,
      dto.startDate,
      [
        DelegationScope.ALL,
        DelegationScope.RFA_ONLY,
        DelegationScope.CORRESPONDENCE_ONLY,
        DelegationScope.SPECIFIC_TYPES,
      ]
    );

    if (delegateOnward) {
      throw new BadRequestException(
        'Nested delegation is not allowed — delegatee already delegates onward'
      );
    }

    const delegation = this.delegationRepo.create({
      delegatorUserId: delegator.user_id,
      delegateUserId: delegate.user_id,
      scope: dto.scope,
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason,
      isActive: true,
    });

    return this.delegationRepo.save(delegation);
  }

  /**
   * ดึง Delegations ของ User ทั้งหมด (ในฐานะผู้มอบหมาย)
   */
  async findByDelegator(delegatorPublicId: string): Promise<Delegation[]> {
    const user = await this.userRepo.findOne({
      where: { publicId: delegatorPublicId },
    });
    if (!user) throw new NotFoundException(delegatorPublicId);

    return this.delegationRepo.find({
      where: { delegatorUserId: user.user_id },
      relations: ['delegate'],
      order: { startDate: 'DESC' },
    });
  }

  /**
   * ดึง Active Delegations สำหรับ User ณ วันที่กำหนด (FR-013)
   * ใช้ใน ReviewTaskService ก่อน assign task
   */
  async findActiveDelegate(
    userId: number,
    date: Date = new Date(),
    scopes: DelegationScope[] = [DelegationScope.ALL]
  ): Promise<User | null> {
    const delegation = await this.delegationRepo
      .createQueryBuilder('d')
      .innerJoinAndSelect('d.delegate', 'delegate')
      .where('d.delegator_user_id = :userId', { userId })
      .andWhere('d.is_active = 1')
      .andWhere('d.start_date <= :date', { date })
      .andWhere('d.end_date >= :date', { date })
      .andWhere('d.scope IN (:...scopes)', { scopes })
      .orderBy('d.created_at', 'DESC')
      .getOne();

    return delegation?.delegate ?? null;
  }

  /**
   * Revoke delegation ก่อนกำหนด
   */
  async revoke(publicId: string, delegatorPublicId: string): Promise<void> {
    const delegation = await this.delegationRepo.findOne({
      where: { publicId },
    });

    if (!delegation)
      throw new NotFoundException(`Delegation not found: ${publicId}`);

    // ตรวจสอบ ownership
    const delegator = await this.userRepo.findOne({
      where: { publicId: delegatorPublicId },
    });
    if (!delegator || delegation.delegatorUserId !== delegator.user_id) {
      throw new BadRequestException('You can only revoke your own delegations');
    }

    delegation.isActive = false;
    delegation.endDate = new Date(); // หยุดทันที
    await this.delegationRepo.save(delegation);
  }
}
