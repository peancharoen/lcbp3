// File: src/modules/review-team/review-team.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReviewTeamService } from './review-team.service';
import {
  CreateReviewTeamDto,
  UpdateReviewTeamDto,
  AddTeamMemberDto,
  SearchReviewTeamDto,
} from './dto/shared/review-team.dto';

@Controller('review-teams')
@UseGuards(JwtAuthGuard)
export class ReviewTeamController {
  constructor(private readonly reviewTeamService: ReviewTeamService) {}

  /**
   * GET /review-teams
   * ดึงรายการ Review Teams ตาม project
   */
  @Get()
  findAll(@Query() dto: SearchReviewTeamDto) {
    return this.reviewTeamService.findAll(dto);
  }

  /**
   * GET /review-teams/:publicId
   * ดึง Review Team เดียว (ADR-019)
   */
  @Get(':publicId')
  findOne(@Param('publicId') publicId: string) {
    return this.reviewTeamService.findByPublicId(publicId);
  }

  /**
   * POST /review-teams
   * สร้าง Review Team ใหม่
   */
  @Post()
  create(@Body() dto: CreateReviewTeamDto) {
    return this.reviewTeamService.create(dto);
  }

  /**
   * PATCH /review-teams/:publicId
   * อัปเดต Review Team
   */
  @Patch(':publicId')
  update(@Param('publicId') publicId: string, @Body() dto: UpdateReviewTeamDto) {
    return this.reviewTeamService.update(publicId, dto);
  }

  /**
   * POST /review-teams/:publicId/members
   * เพิ่มสมาชิก
   */
  @Post(':publicId/members')
  addMember(@Param('publicId') teamPublicId: string, @Body() dto: AddTeamMemberDto) {
    return this.reviewTeamService.addMember(teamPublicId, dto);
  }

  /**
   * DELETE /review-teams/:publicId/members/:memberPublicId
   * ลบสมาชิก
   */
  @Delete(':publicId/members/:memberPublicId')
  removeMember(
    @Param('publicId') teamPublicId: string,
    @Param('memberPublicId') memberPublicId: string,
  ) {
    return this.reviewTeamService.removeMember(teamPublicId, memberPublicId);
  }

  /**
   * DELETE /review-teams/:publicId
   * Deactivate Review Team (soft delete)
   */
  @Delete(':publicId')
  deactivate(@Param('publicId') publicId: string) {
    return this.reviewTeamService.deactivate(publicId);
  }
}
