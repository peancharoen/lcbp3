import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../common/entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>
  ) {}

  async findAll(query: any) {
    const { page = 1, limit = 20, entityName, action, userId } = query;
    const skip = (page - 1) * limit;

    const queryBuilder =
      this.auditLogRepository.createQueryBuilder('audit_logs'); // Aliased as 'audit_logs' matching table name usually, or just 'log'

    if (entityName) {
      queryBuilder.andWhere('audit_logs.entityName LIKE :entityName', {
        entityName: `%${entityName}%`,
      });
    }

    if (action) {
      queryBuilder.andWhere('audit_logs.action = :action', { action });
    }

    if (userId) {
      queryBuilder.andWhere('audit_logs.userId = :userId', { userId });
    }

    queryBuilder.orderBy('audit_logs.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
