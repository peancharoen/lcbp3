import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { TransmittalService } from './transmittal.service';
import { CreateTransmittalDto } from './dto/create-transmittal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../user/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Transmittals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transmittals')
export class TransmittalController {
  constructor(private readonly transmittalService: TransmittalService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Transmittal' })
  create(@Body() createDto: CreateTransmittalDto, @CurrentUser() user: User) {
    return this.transmittalService.create(createDto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Transmittal details' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.transmittalService.findOne(id);
  }
}
