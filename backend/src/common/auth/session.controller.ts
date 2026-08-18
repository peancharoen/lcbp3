// File: backend/src/common/auth/session.controller.ts
// Change Log:
// - 2026-08-18: แก้ไข role names ให้ตรงกับ DB (Superadmin/Org Admin/Document Control)

import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  ParseIntPipe,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { User } from '../../modules/user/entities/user.entity';
import type { RequestWithUser } from '../interfaces/request-with-user.interface';

@ApiTags('Authentication')
@Controller('auth/sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @ApiOperation({ summary: 'List all active sessions (Admin/DC Only)' })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  async getActiveSessions(@Req() req: RequestWithUser) {
    this.checkAdminRole(req.user);
    return this.authService.getActiveSessions();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a session by ID (Admin/DC Only)' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  async revokeSession(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser
  ) {
    this.checkAdminRole(req.user);
    await this.authService.revokeSession(id);
    return { message: 'Session revoked successfully' };
  }

  private checkAdminRole(user: User) {
    // ตรวจสอบสิทธิ์ Admin/DC ผ่าน assignments (ใช้ role names จริงจาก DB)
    const hasPermission = user.assignments?.some(
      (assignment) =>
        assignment.role.roleName === 'Superadmin' ||
        assignment.role.roleName === 'Org Admin' ||
        assignment.role.roleName === 'Document Control'
    );

    if (!hasPermission) {
      throw new UnauthorizedException(
        'Insufficient permissions: ADMIN or DC role required'
      );
    }
  }
}
