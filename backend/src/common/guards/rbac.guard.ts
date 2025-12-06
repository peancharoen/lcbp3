import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { UserService } from '../../modules/user/user.service';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. ดูว่า Controller นี้ต้องการสิทธิ์อะไร?
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    // ถ้าไม่ต้องการสิทธิ์อะไรเลย ก็ปล่อยผ่าน
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 2. ดึง User จาก Request (ที่ JwtAuthGuard แปะไว้ให้)
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    // 3. (สำคัญ) ดึงสิทธิ์ทั้งหมดของ User คนนี้จาก Database
    // เราต้องเขียนฟังก์ชัน getUserPermissions ใน UserService เพิ่ม (เดี๋ยวพาทำ)
    const userPermissions = await this.userService.getUserPermissions(
      user.userId
    );

    // 4. ตรวจสอบว่ามีสิทธิ์ที่ต้องการไหม? (User ต้องมีครบทุกสิทธิ์)
    const hasPermission = requiredPermissions.every((req) =>
      userPermissions.some(
        (p) => p === req || p === 'system.manage_all' // Superadmin ทะลุทุกสิทธิ์
      )
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `You do not have permission: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }
}
