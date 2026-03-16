import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { ShopDrawingService } from './shop-drawing.service';
import { CreateShopDrawingDto } from './dto/create-shop-drawing.dto';
import { SearchShopDrawingDto } from './dto/search-shop-drawing.dto';
import { CreateShopDrawingRevisionDto } from './dto/create-shop-drawing-revision.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { Audit } from '../../common/decorators/audit.decorator'; // Import

@ApiTags('Shop Drawings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('drawings/shop')
export class ShopDrawingController {
  constructor(private readonly shopDrawingService: ShopDrawingService) {}

  @Post()
  @ApiOperation({ summary: 'Create new Shop Drawing with initial revision' })
  @RequirePermission('drawing.create') // อ้างอิง Permission จาก Seed
  @Audit('drawing.create', 'shop_drawing') // ✅ แปะตรงนี้
  create(@Body() createDto: CreateShopDrawingDto, @CurrentUser() user: User) {
    return this.shopDrawingService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Search Shop Drawings' })
  @RequirePermission('drawing.view')
  findAll(@Query() searchDto: SearchShopDrawingDto) {
    return this.shopDrawingService.findAll(searchDto);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get Shop Drawing details with revisions' })
  @RequirePermission('drawing.view')
  findOne(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.shopDrawingService.findOneByUuid(uuid);
  }

  @Post(':uuid/revisions')
  @ApiOperation({ summary: 'Add new revision to existing Shop Drawing' })
  @RequirePermission('drawing.create') // หรือ drawing.edit ตาม Logic องค์กร
  @Audit('drawing.create', 'shop_drawing') // ✅ แปะตรงนี้
  async createRevision(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() createRevisionDto: CreateShopDrawingRevisionDto
  ) {
    const sd = await this.shopDrawingService.findOneByUuid(uuid);
    return this.shopDrawingService.createRevision(sd.id, createRevisionDto);
  }
}
