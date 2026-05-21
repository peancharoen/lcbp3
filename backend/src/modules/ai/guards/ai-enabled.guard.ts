// File: src/modules/ai/guards/ai-enabled.guard.ts
// Change Log
// - 2026-05-21: เพิ่ม Guard สำหรับ soft-block AI endpoints เมื่อระบบ AI ถูกปิด.

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ServiceUnavailableException } from '../../../common/exceptions';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';
import { AiSettingsService } from '../ai-settings.service';

const AI_BYPASS_PERMISSIONS = [
  'ai.suggest',
  'ai.rag_query',
  'rag.query',
  'ai.extract',
];

/** Guard สำหรับบล็อก AI endpoints ของผู้ใช้ทั่วไปเมื่อ Superadmin ปิด AI */
@Injectable()
export class AiEnabledGuard implements CanActivate {
  constructor(
    private readonly aiSettingsService: AiSettingsService,
    private readonly userService: UserService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const enabled = await this.aiSettingsService.getAiFeaturesEnabled();
    if (enabled) return true;
    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user;
    const userId = user?.user_id;
    if (userId) {
      const permissions = await this.userService.getUserPermissions(userId);
      const isSuperadmin = permissions.includes('system.manage_all');
      const hasAiPermission = AI_BYPASS_PERMISSIONS.some((permission) =>
        permissions.includes(permission)
      );
      if (isSuperadmin && hasAiPermission) return true;
    }
    throw new ServiceUnavailableException(
      'AI_FEATURES_UNAVAILABLE',
      'AI features are temporarily unavailable',
      'ระบบ AI ไม่พร้อมใช้งานชั่วคราว กรุณากรอกข้อมูลด้วยตนเอง',
      ['กรอกข้อมูลด้วยตนเอง', 'ติดต่อผู้ดูแลระบบหากต้องการความช่วยเหลือ']
    );
  }
}
