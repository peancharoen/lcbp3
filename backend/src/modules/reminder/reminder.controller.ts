// File: src/modules/reminder/reminder.controller.ts
// Admin endpoints สำหรับจัดการ Reminder Rules (T048)
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReminderService } from './reminder.service';
import { CreateReminderRuleDto } from './dto/create-reminder-rule.dto';

@Controller('admin/reminder-rules')
@UseGuards(JwtAuthGuard)
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.reminderService.findAll(projectId ? parseInt(projectId, 10) : undefined);
  }

  @Get(':publicId')
  findOne(@Param('publicId') publicId: string) {
    return this.reminderService.findOne(publicId);
  }

  @Post()
  create(@Body() dto: CreateReminderRuleDto): Promise<unknown> {
    return this.reminderService.create(dto);
  }

  @Patch(':publicId')
  update(@Param('publicId') publicId: string, @Body() dto: Partial<CreateReminderRuleDto>): Promise<unknown> {
    return this.reminderService.update(publicId, dto);
  }

  @Delete(':publicId')
  remove(@Param('publicId') publicId: string) {
    return this.reminderService.remove(publicId);
  }
}
