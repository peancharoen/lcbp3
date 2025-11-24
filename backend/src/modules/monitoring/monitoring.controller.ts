import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { SetMaintenanceDto } from './dto/set-maintenance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BypassMaintenance } from '../../common/decorators/bypass-maintenance.decorator';

@ApiTags('System Monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('maintenance')
  @ApiOperation({ summary: 'Check maintenance status (Public)' })
  @BypassMaintenance() // API นี้ต้องเรียกได้แม้ระบบปิดอยู่
  getMaintenanceStatus() {
    return this.monitoringService.getMaintenanceStatus();
  }

  @Post('maintenance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all') // เฉพาะ Superadmin เท่านั้น
  @BypassMaintenance() // Admin ต้องยิงเปิด/ปิดได้แม้ระบบจะปิดอยู่
  @ApiOperation({ summary: 'Toggle Maintenance Mode (Admin Only)' })
  setMaintenanceMode(@Body() dto: SetMaintenanceDto) {
    return this.monitoringService.setMaintenanceMode(dto);
  }
}
