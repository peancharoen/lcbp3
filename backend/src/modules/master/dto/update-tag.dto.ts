// File: src/modules/master/dto/update-tag.dto.ts

import { PartialType } from '@nestjs/swagger';
import { CreateTagDto } from './create-tag.dto';

export class UpdateTagDto extends PartialType(CreateTagDto) {}
