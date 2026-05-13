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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { DelegationService } from './delegation.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';

@Controller('delegations')
@UseGuards(JwtAuthGuard)
export class DelegationController {
  constructor(private readonly delegationService: DelegationService) {}

  /**
   * GET /delegations
   * ดึง Delegations ของ User ที่ login อยู่
   */
  @Get()
  findMyDelegations(@CurrentUser() user: User) {
    return this.delegationService.findByDelegator(user.publicId);
  }

  /**
   * POST /delegations
   * สร้าง Delegation ใหม่ (FR-011)
   */
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateDelegationDto) {
    return this.delegationService.create(user.publicId, dto);
  }

  /**
   * DELETE /delegations/:publicId
   * Revoke delegation
   */
  @Delete(':publicId')
  revoke(@Param('publicId') publicId: string, @CurrentUser() user: User) {
    return this.delegationService.revoke(publicId, user.publicId);
  }
}
