// File: src/modules/ai/guards/service-account.guard.ts
// Change Log
// - 2026-05-14: เพิ่ม Guard ตรวจสอบ n8n Service Account Token ตาม ADR-023.
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

interface ServiceAccountRequest extends Request {
  headers: Request['headers'] & {
    authorization?: string;
  };
}

/** ตรวจสอบ Bearer token ของ n8n service account โดยไม่ใช้ user JWT */
@Injectable()
export class ServiceAccountGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ServiceAccountRequest>();
    const authorization = request.headers.authorization;
    const expectedToken =
      this.configService.get<string>('AI_N8N_SERVICE_TOKEN') ??
      this.configService.get<string>('AI_N8N_AUTH_TOKEN') ??
      '';

    if (!expectedToken || !authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid service account token');
    }

    const actualToken = authorization.slice('Bearer '.length);
    if (!this.isEqual(actualToken, expectedToken)) {
      throw new UnauthorizedException('Invalid service account token');
    }

    return true;
  }

  private isEqual(actual: string, expected: string): boolean {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }
}
