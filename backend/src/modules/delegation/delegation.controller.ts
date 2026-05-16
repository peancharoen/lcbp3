// File: src/modules/delegation/delegation.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { DelegationService } from './delegation.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';

@Controller('delegations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DelegationController {
  constructor(private readonly delegationService: DelegationService) {}

  /**
   * GET /delegations
   * ดึง Delegations ของ User ที่ login อยู่
   */
  @Get()
  @RequirePermission('document.view')
  findMyDelegations(@CurrentUser() user: User) {
    return this.delegationService.findByDelegator(user.publicId);
  }

  /**
   * POST /delegations
   * สร้าง Delegation ใหม่ (FR-011)
   */
  @Post()
  @RequirePermission('document.view')
  @Audit('delegation.create', 'delegation')
  create(@CurrentUser() user: User, @Body() dto: CreateDelegationDto) {
    return this.delegationService.create(user.publicId, dto);
  }

  /**
   * DELETE /delegations/:publicId
   * Revoke delegation
   */
  @Delete(':publicId')
  @RequirePermission('document.view')
  @Audit('delegation.revoke', 'delegation')
  async revoke(@Param('publicId') publicId: string, @CurrentUser() user: User) {
    return this.delegationService.revoke(publicId, user.publicId);
  }
}
