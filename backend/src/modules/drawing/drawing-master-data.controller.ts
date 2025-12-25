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
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { DrawingMasterDataService } from './drawing-master-data.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Drawing Master Data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('drawings/master-data')
export class DrawingMasterDataController {
  constructor(private readonly masterDataService: DrawingMasterDataService) {}

  // =====================================================
  // Contract Drawing Volumes
  // =====================================================

  @Get('contract/volumes')
  @ApiOperation({ summary: 'List Contract Drawing Volumes' })
  @ApiQuery({ name: 'projectId', required: true, type: Number })
  @RequirePermission('document.view')
  getVolumes(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.masterDataService.findAllVolumes(projectId);
  }

  @Post('contract/volumes')
  @ApiOperation({ summary: 'Create Volume' })
  @RequirePermission('master_data.drawing_category.manage')
  createVolume(
    @Body()
    body: {
      projectId: number;
      volumeCode: string;
      volumeName: string;
      description?: string;
      sortOrder: number;
    }
  ) {
    return this.masterDataService.createVolume(body);
  }

  @Patch('contract/volumes/:id')
  @ApiOperation({ summary: 'Update Volume' })
  @RequirePermission('master_data.drawing_category.manage')
  updateVolume(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      volumeCode?: string;
      volumeName?: string;
      description?: string;
      sortOrder?: number;
    }
  ) {
    return this.masterDataService.updateVolume(id, body);
  }

  @Delete('contract/volumes/:id')
  @ApiOperation({ summary: 'Delete Volume' })
  @RequirePermission('master_data.drawing_category.manage')
  deleteVolume(@Param('id', ParseIntPipe) id: number) {
    return this.masterDataService.deleteVolume(id);
  }

  // =====================================================
  // Contract Drawing Categories
  // =====================================================

  @Get('contract/categories')
  @ApiOperation({ summary: 'List Contract Drawing Categories' })
  @ApiQuery({ name: 'projectId', required: true, type: Number })
  @RequirePermission('document.view')
  getCategories(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.masterDataService.findAllCategories(projectId);
  }

  @Post('contract/categories')
  @ApiOperation({ summary: 'Create Category' })
  @RequirePermission('master_data.drawing_category.manage')
  createCategory(
    @Body()
    body: {
      projectId: number;
      catCode: string;
      catName: string;
      description?: string;
      sortOrder: number;
    }
  ) {
    return this.masterDataService.createCategory(body);
  }

  @Patch('contract/categories/:id')
  @ApiOperation({ summary: 'Update Category' })
  @RequirePermission('master_data.drawing_category.manage')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      catCode?: string;
      catName?: string;
      description?: string;
      sortOrder?: number;
    }
  ) {
    return this.masterDataService.updateCategory(id, body);
  }

  @Delete('contract/categories/:id')
  @ApiOperation({ summary: 'Delete Category' })
  @RequirePermission('master_data.drawing_category.manage')
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.masterDataService.deleteCategory(id);
  }

  // =====================================================
  // Contract Drawing Sub-Categories
  // =====================================================

  @Get('contract/sub-categories')
  @ApiOperation({ summary: 'List Contract Drawing Sub-Categories' })
  @ApiQuery({ name: 'projectId', required: true, type: Number })
  @RequirePermission('document.view')
  getContractSubCats(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.masterDataService.findAllContractSubCats(projectId);
  }

  @Post('contract/sub-categories')
  @ApiOperation({ summary: 'Create Contract Sub-Category' })
  @RequirePermission('master_data.drawing_category.manage')
  createContractSubCat(
    @Body()
    body: {
      projectId: number;
      subCatCode: string;
      subCatName: string;
      description?: string;
      sortOrder: number;
    }
  ) {
    return this.masterDataService.createContractSubCat(body);
  }

  @Patch('contract/sub-categories/:id')
  @ApiOperation({ summary: 'Update Contract Sub-Category' })
  @RequirePermission('master_data.drawing_category.manage')
  updateContractSubCat(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      subCatCode?: string;
      subCatName?: string;
      description?: string;
      sortOrder?: number;
    }
  ) {
    return this.masterDataService.updateContractSubCat(id, body);
  }

  async deleteContractSubCat(@Param('id', ParseIntPipe) id: number) {
    return this.masterDataService.deleteContractSubCat(id);
  }

  // =====================================================
  // Contract Drawing Mappings
  // =====================================================

  @Get('contract/mappings')
  @ApiOperation({ summary: 'List Contract Drawing Mappings' })
  @ApiQuery({ name: 'projectId', required: true, type: Number })
  @ApiQuery({ name: 'categoryId', required: false, type: Number })
  @RequirePermission('document.view')
  getContractMappings(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query('categoryId') categoryId?: number
  ) {
    return this.masterDataService.findContractMappings(
      projectId,
      categoryId ? Number(categoryId) : undefined
    );
  }

  @Post('contract/mappings')
  @ApiOperation({ summary: 'Create Contract Drawing Mapping' })
  @RequirePermission('master_data.drawing_category.manage')
  createContractMapping(
    @Body()
    body: {
      projectId: number;
      categoryId: number;
      subCategoryId: number;
    }
  ) {
    return this.masterDataService.createContractMapping(body);
  }

  @Delete('contract/mappings/:id')
  @ApiOperation({ summary: 'Delete Contract Drawing Mapping' })
  @RequirePermission('master_data.drawing_category.manage')
  deleteContractMapping(@Param('id', ParseIntPipe) id: number) {
    return this.masterDataService.deleteContractMapping(id);
  }

  // =====================================================
  // Shop Drawing Main Categories
  // =====================================================

  @Get('shop/main-categories')
  @ApiOperation({ summary: 'List Shop Drawing Main Categories' })
  @ApiQuery({ name: 'projectId', required: true, type: Number })
  @RequirePermission('document.view')
  getShopMainCats(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.masterDataService.findAllShopMainCats(projectId);
  }

  @Post('shop/main-categories')
  @ApiOperation({ summary: 'Create Shop Main Category' })
  @RequirePermission('master_data.drawing_category.manage')
  createShopMainCat(
    @Body()
    body: {
      projectId: number;
      mainCategoryCode: string;
      mainCategoryName: string;
      description?: string;
      isActive?: boolean;
      sortOrder: number;
    }
  ) {
    return this.masterDataService.createShopMainCat(body);
  }

  @Patch('shop/main-categories/:id')
  @ApiOperation({ summary: 'Update Shop Main Category' })
  @RequirePermission('master_data.drawing_category.manage')
  updateShopMainCat(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      mainCategoryCode?: string;
      mainCategoryName?: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ) {
    return this.masterDataService.updateShopMainCat(id, body);
  }

  @Delete('shop/main-categories/:id')
  @ApiOperation({ summary: 'Delete Shop Main Category' })
  @RequirePermission('master_data.drawing_category.manage')
  deleteShopMainCat(@Param('id', ParseIntPipe) id: number) {
    return this.masterDataService.deleteShopMainCat(id);
  }

  // =====================================================
  // Shop Drawing Sub-Categories
  // =====================================================

  @Get('shop/sub-categories')
  @ApiOperation({ summary: 'List Shop Drawing Sub-Categories' })
  @ApiQuery({ name: 'projectId', required: true, type: Number })
  @ApiQuery({ name: 'mainCategoryId', required: false, type: Number })
  @RequirePermission('document.view')
  getShopSubCats(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query('mainCategoryId') mainCategoryId?: number
  ) {
    return this.masterDataService.findAllShopSubCats(
      projectId,
      mainCategoryId ? Number(mainCategoryId) : undefined
    );
  }

  @Post('shop/sub-categories')
  @ApiOperation({ summary: 'Create Shop Sub-Category' })
  @RequirePermission('master_data.drawing_category.manage')
  createShopSubCat(
    @Body()
    body: {
      projectId: number;
      subCategoryCode: string;
      subCategoryName: string;
      description?: string;
      isActive?: boolean;
      sortOrder: number;
    }
  ) {
    return this.masterDataService.createShopSubCat(body);
  }

  @Patch('shop/sub-categories/:id')
  @ApiOperation({ summary: 'Update Shop Sub-Category' })
  @RequirePermission('master_data.drawing_category.manage')
  updateShopSubCat(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      subCategoryCode?: string;
      subCategoryName?: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ) {
    return this.masterDataService.updateShopSubCat(id, body);
  }

  @Delete('shop/sub-categories/:id')
  @ApiOperation({ summary: 'Delete Shop Sub-Category' })
  @RequirePermission('master_data.drawing_category.manage')
  deleteShopSubCat(@Param('id', ParseIntPipe) id: number) {
    return this.masterDataService.deleteShopSubCat(id);
  }
}
