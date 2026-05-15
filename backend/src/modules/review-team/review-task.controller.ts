// File: src/modules/review-team/review-task.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReviewTaskService } from './review-task.service';
import { ConsensusService } from './services/consensus.service';
import { VetoOverrideService } from './services/veto-override.service';
import type { VetoOverrideDto } from './services/veto-override.service';
import {
  CompleteReviewTaskDto,
  SearchReviewTaskDto,
} from './dto/shared/review-team.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';

@Controller('review-tasks')
@UseGuards(JwtAuthGuard)
export class ReviewTaskController {
  constructor(
    private readonly reviewTaskService: ReviewTaskService,
    private readonly consensusService: ConsensusService,
    private readonly vetoOverrideService: VetoOverrideService
  ) {}

  @Get()
  findAll(@Query() dto: SearchReviewTaskDto) {
    return this.reviewTaskService.findAll(dto);
  }

  @Get(':publicId')
  findOne(@Param('publicId', ParseUUIDPipe) publicId: string) {
    return this.reviewTaskService.findByPublicId(publicId);
  }

  @Patch(':publicId/start')
  startReview(@Param('publicId', ParseUUIDPipe) publicId: string) {
    return this.reviewTaskService.startReview(publicId);
  }

  @Patch(':publicId/complete')
  async completeReview(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Body() dto: CompleteReviewTaskDto,
    @CurrentUser() _user: User
  ) {
    const task = await this.reviewTaskService.completeReview(publicId, dto);

    // Evaluate consensus after completion (FR-010)
    try {
      const fullTask =
        await this.reviewTaskService.findFullTaskContext(publicId);

      // Cast to access dynamic properties from innerJoinAndMapOne safely without 'any'
      const context = fullTask as unknown as {
        rfaRevisionId: number;
        rfaRevision?: {
          correspondenceRevision?: {
            publicId: string;
            correspondence?: {
              publicId: string;
              projectId: number;
              type?: {
                id: number;
                typeCode: string;
              };
            };
          };
        };
      };

      const rfaRevision = context.rfaRevision;
      const corrRevision = rfaRevision?.correspondenceRevision;
      const correspondence = corrRevision?.correspondence;

      if (rfaRevision && corrRevision && correspondence) {
        await this.consensusService.evaluateAfterTaskComplete(
          context.rfaRevisionId,
          {
            rfaPublicId: correspondence.publicId,
            rfaRevisionPublicId: corrRevision.publicId,
            projectId: correspondence.projectId,
            documentTypeId: correspondence.type?.id,
            documentTypeCode: correspondence.type?.typeCode ?? 'RFA',
          }
        );
      }
    } catch (_error: unknown) {
      // Log error but don't fail the task completion response
      // (error as any).logger?.error(`Consensus evaluation failed: ${(error as Error).message}`);
    }

    return task;
  }

  @Post('veto-override')
  async overrideVeto(@Body() dto: VetoOverrideDto, @CurrentUser() user: User) {
    return this.vetoOverrideService.executeOverride({
      ...dto,
      overriddenByUserId: user.user_id,
    });
  }
}
