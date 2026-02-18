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

@ApiTags('Authentication')
@Controller('auth/sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @ApiOperation({ summary: 'List all active sessions (Admin/DC Only)' })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  async getActiveSessions(@Req() req: any) {
    this.checkAdminRole(req.user);
    return this.authService.getActiveSessions();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a session by ID (Admin/DC Only)' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  async revokeSession(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    this.checkAdminRole(req.user);
    await this.authService.revokeSession(id);
    return { message: 'Session revoked successfully' };
  }

  private checkAdminRole(user: User) {
    // Check if user has ADMIN or DC role via assignments
    const hasPermission = user.assignments?.some(
      (assignment) =>
        assignment.role.roleName === 'ADMIN' ||
        assignment.role.roleName === 'DC'
    );

    if (!hasPermission) {
      throw new UnauthorizedException(
        'Insufficient permissions: ADMIN or DC role required'
      );
    }
  }
}
