import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Advanced Search across all documents' })
  @RequirePermission('search.advanced') // สิทธิ์ ID 48
  search(@Query() queryDto: SearchQueryDto) {
    return this.searchService.search(queryDto);
  }
}
