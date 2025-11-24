import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';

import { AuditLog } from '../entities/audit-log.entity';
import { AUDIT_KEY, AuditMetadata } from '../decorators/audit.decorator';
import { User } from '../../modules/user/entities/user.entity';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private reflector: Reflector,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.getAllAndOverride<AuditMetadata>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user as User;
    const rawIp = request.ip || request.socket.remoteAddress;
    const ip = Array.isArray(rawIp) ? rawIp[0] : rawIp;
    const userAgent = request.get('user-agent');

    return next.handle().pipe(
      tap(async (data) => {
        try {
          let entityId = null;

          if (data && typeof data === 'object') {
            if ('id' in data) entityId = String(data.id);
            else if ('audit_id' in data) entityId = String(data.audit_id);
            else if ('user_id' in data) entityId = String(data.user_id);
          }

          if (!entityId && request.params.id) {
            entityId = String(request.params.id);
          }

          // ✅ FIX: ใช้ user?.user_id || null
          const auditLog = this.auditLogRepo.create({
            userId: user ? user.user_id : null,
            action: auditMetadata.action,
            entityType: auditMetadata.entityType,
            entityId: entityId,
            ipAddress: ip,
            userAgent: userAgent,
            severity: 'INFO',
          } as unknown as AuditLog); // ✨ Trick: Cast ผ่าน unknown เพื่อล้าง Error ถ้า TS ยังไม่อัปเดต

          await this.auditLogRepo.save(auditLog);
        } catch (error) {
          this.logger.error(
            `Failed to create audit log for ${auditMetadata.action}: ${(error as Error).message}`,
          );
        }
      }),
    );
  }
}
