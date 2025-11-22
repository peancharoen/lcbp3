import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { DrawingMasterDataService } from './drawing-master-data.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Drawing Master Data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('drawings/master')
export class DrawingMasterDataController {
  // ✅ ต้องมี export ตรงนี้
  constructor(private readonly masterDataService: DrawingMasterDataService) {}

  // --- Contract Drawing Endpoints ---

  @Get('contract/volumes')
  @ApiOperation({ summary: 'List Contract Drawing Volumes' })
  @RequirePermission('document.view')
  getVolumes(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.masterDataService.findAllVolumes(projectId);
  }

  @Post('contract/volumes')
  @ApiOperation({ summary: 'Create Volume (Admin/PM)' })
  @RequirePermission('master_data.drawing_category.manage') // สิทธิ์ ID 16
  createVolume(@Body() body: any) {
    // ควรใช้ DTO จริงในการผลิต
    return this.masterDataService.createVolume(body);
  }

  @Get('contract/sub-categories')
  @ApiOperation({ summary: 'List Contract Drawing Sub-Categories' })
  @RequirePermission('document.view')
  getContractSubCats(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.masterDataService.findAllContractSubCats(projectId);
  }

  @Post('contract/sub-categories')
  @ApiOperation({ summary: 'Create Contract Sub-Category (Admin/PM)' })
  @RequirePermission('master_data.drawing_category.manage')
  createContractSubCat(@Body() body: any) {
    return this.masterDataService.createContractSubCat(body);
  }

  // --- Shop Drawing Endpoints ---

  @Get('shop/main-categories')
  @ApiOperation({ summary: 'List Shop Drawing Main Categories' })
  @RequirePermission('document.view')
  getShopMainCats() {
    return this.masterDataService.findAllShopMainCats();
  }

  @Get('shop/sub-categories')
  @ApiOperation({ summary: 'List Shop Drawing Sub-Categories' })
  @RequirePermission('document.view')
  getShopSubCats(@Query('mainCategoryId') mainCategoryId?: number) {
    return this.masterDataService.findAllShopSubCats(mainCategoryId);
  }
}
