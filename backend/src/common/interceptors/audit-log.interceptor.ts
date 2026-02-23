// File: src/common/interceptors/audit-log.interceptor.ts
// Fix #2: Replaced `as unknown as AuditLog` with CreateAuditLogPayload typed interface
// Lint fixes: async-in-tap pattern, null vs undefined entityId, safe any handling

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

/** Typed payload for creating AuditLog, replacing the `as unknown as AuditLog` cast */
interface CreateAuditLogPayload {
  userId: number | null | undefined;
  action: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  severity: string;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private reflector: Reflector,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMetadata = this.reflector.getAllAndOverride<AuditMetadata>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as Request & { user?: User }).user;
    const rawIp: string | string[] | undefined =
      request.ip ?? request.socket.remoteAddress;
    const ip: string | undefined = Array.isArray(rawIp) ? rawIp[0] : rawIp;
    const userAgent = request.get('user-agent');

    return next.handle().pipe(
      // Use void for fire-and-forget: tap() does not support async callbacks
      tap((data: unknown) => {
        void this.saveAuditLog(
          data,
          auditMetadata,
          request,
          user,
          ip,
          userAgent
        );
      })
    );
  }

  /** Extracted async method to aoid "Promise returned in tap" lint warning */
  private async saveAuditLog(
    data: unknown,
    auditMetadata: AuditMetadata,
    request: Request,
    user: User | undefined,
    ip: string | undefined,
    userAgent: string | undefined
  ): Promise<void> {
    try {
      let entityId: string | undefined;

      if (data !== null && typeof data === 'object') {
        const dataRecord = data as Record<string, unknown>;
        if ('id' in dataRecord) {
          entityId = String(dataRecord['id']);
        } else if ('audit_id' in dataRecord) {
          entityId = String(dataRecord['audit_id']);
        } else if ('user_id' in dataRecord) {
          entityId = String(dataRecord['user_id']);
        }
      }

      if (!entityId && request.params['id']) {
        entityId = String(request.params['id']);
      }

      const payload: CreateAuditLogPayload = {
        userId: user?.user_id ?? null,
        action: auditMetadata.action,
        entityType: auditMetadata.entityType,
        entityId,
        ipAddress: ip,
        userAgent,
        severity: 'INFO',
      };

      const auditLog = this.auditLogRepo.create(payload as Partial<AuditLog>);
      await this.auditLogRepo.save(auditLog);
    } catch (error) {
      this.logger.error(
        `Failed to create audit log for ${auditMetadata.action}: ${(error as Error).message}`
      );
    }
  }
}
