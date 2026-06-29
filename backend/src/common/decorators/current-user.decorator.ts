import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../modules/user/entities/user.entity';

/**
 * Decorator สำหรับดึงข้อมูล User ปัจจุบันจาก Request Object
 * ใช้คู่กับ JwtAuthGuard
 *
 * ตัวอย่างการใช้:
 * @Get()
 * findAll(@CurrentUser() user: User) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: User }>();
    // request.user ถูก set โดย Passport/JwtStrategy
    return request.user;
  }
);
