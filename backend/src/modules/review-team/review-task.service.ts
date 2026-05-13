// File: src/modules/review-team/review-task.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewTask } from './entities/review-task.entity';
import { ResponseCode } from '../response-code/entities/response-code.entity';
import {
  CompleteReviewTaskDto,
  SearchReviewTaskDto,
} from './dto/shared/review-team.dto';
import { ReviewTaskStatus } from '../common/enums/review.enums';
import { validateTaskCompletionRequirements } from '../../common/validators/review-validators';

@Injectable()
export class ReviewTaskService {
  private readonly logger = new Logger(ReviewTaskService.name);

  constructor(
    @InjectRepository(ReviewTask)
    private readonly reviewTaskRepo: Repository<ReviewTask>,
    @InjectRepository(ResponseCode)
    private readonly responseCodeRepo: Repository<ResponseCode>
  ) {}

  /**
   * ดึง Tasks ทั้งหมดของ RFA Revision (internal use)
   */
  async findByRevisionId(rfaRevisionId: number): Promise<ReviewTask[]> {
    return this.reviewTaskRepo.find({ where: { rfaRevisionId } });
  }

  /**
   * ค้นหา Review Tasks ตาม filter (FR-004)
   */
  async findAll(dto: SearchReviewTaskDto): Promise<ReviewTask[]> {
    const qb = this.reviewTaskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.discipline', 'discipline')
      .leftJoinAndSelect('task.assignedToUser', 'user')
      .leftJoinAndSelect('task.responseCode', 'responseCode')
      .leftJoinAndSelect('task.team', 'team');

    if (dto.rfaRevisionPublicId) {
      qb.innerJoin(
        'rfa_revisions',
        'rev',
        'rev.id = task.rfa_revision_id'
      ).where('rev.uuid = :uuid', { uuid: dto.rfaRevisionPublicId });
    }

    if (dto.status) {
      qb.andWhere('task.status = :status', { status: dto.status });
    }

    if (dto.assignedToUserPublicId) {
      qb.andWhere('user.uuid = :userUuid', {
        userUuid: dto.assignedToUserPublicId,
      });
    }

    if (dto.dueDateFrom) {
      qb.andWhere('task.due_date >= :from', { from: dto.dueDateFrom });
    }

    if (dto.dueDateTo) {
      qb.andWhere('task.due_date <= :to', { to: dto.dueDateTo });
    }

    return qb.orderBy('task.created_at', 'ASC').getMany();
  }

  /**
   * ดึง Review Task ตาม publicId (ADR-019)
   */
  async findByPublicId(publicId: string): Promise<ReviewTask> {
    const task = await this.reviewTaskRepo.findOne({
      where: { publicId },
      relations: ['discipline', 'assignedToUser', 'responseCode', 'team'],
    });

    if (!task) {
      throw new NotFoundException(`Review Task not found: ${publicId}`);
    }

    return task;
  }

  /**
   * ดึง Tasks รวมทั้งหมดของ RFA Revision พร้อม Aggregate Status (FR-004)
   */
  async getAggregateStatus(rfaRevisionId: number): Promise<{
    total: number;
    completed: number;
    pending: number;
    summary: string;
  }> {
    const tasks = await this.reviewTaskRepo.find({ where: { rfaRevisionId } });

    const total = tasks.length;
    const completed = tasks.filter(
      (t: ReviewTask) =>
        t.status === ReviewTaskStatus.COMPLETED ||
        t.status === ReviewTaskStatus.CANCELLED
    ).length;
    const pending = total - completed;

    return {
      total,
      completed,
      pending,
      summary: `${completed} of ${total} Disciplines Reviewed`,
    };
  }

  /**
   * เริ่มตรวจสอบ Review Task (เปลี่ยน status จาก PENDING → IN_PROGRESS)
   */
  async startReview(publicId: string): Promise<ReviewTask> {
    const task = await this.findByPublicId(publicId);

    if (task.status !== ReviewTaskStatus.PENDING) {
      throw new BadRequestException(
        `Cannot start review: task is already ${task.status}`
      );
    }

    task.status = ReviewTaskStatus.IN_PROGRESS;
    return this.reviewTaskRepo.save(task);
  }

  /**
   * บันทึกผลการตรวจสอบ (FR-009, T069)
   * ใช้ Optimistic Locking (@VersionColumn) ป้องกัน race condition (ADR-002)
   */
  async completeReview(
    publicId: string,
    dto: CompleteReviewTaskDto
  ): Promise<ReviewTask> {
    const task = await this.findByPublicId(publicId);

    if (
      task.status === ReviewTaskStatus.COMPLETED ||
      task.status === ReviewTaskStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot complete review: task is already ${task.status}`
      );
    }

    // ตรวจสอบ Response Code (ADR-019)
    const responseCode = await this.responseCodeRepo.findOne({
      where: { publicId: dto.responseCodePublicId },
    });

    if (!responseCode) {
      throw new NotFoundException(
        `Response Code not found: ${dto.responseCodePublicId}`
      );
    }

    // Validate completion requirements (T073)
    validateTaskCompletionRequirements(
      ReviewTaskStatus.COMPLETED,
      responseCode.id,
      false, // requiresComments checked at controller level via ResponseCodeRule
      dto.comments
    );

    task.status = ReviewTaskStatus.COMPLETED;
    task.responseCodeId = responseCode.id;
    task.comments = dto.comments;
    task.attachments = dto.attachmentPublicIds;
    task.completedAt = new Date();

    try {
      // TypeORM จะ throw OptimisticLockVersionMismatchError ถ้า version ไม่ตรง (ADR-002)
      return await this.reviewTaskRepo.save(task);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes('OptimisticLock') ||
        errorMessage.includes('version')
      ) {
        throw new ConflictException(
          'Review task was modified concurrently. Please refresh and try again.'
        );
      }
      throw err;
    }
  }
}
