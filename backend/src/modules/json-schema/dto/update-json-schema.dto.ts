import { PartialType } from '@nestjs/swagger';
import { CreateJsonSchemaDto } from './create-json-schema.dto';

export class UpdateJsonSchemaDto extends PartialType(CreateJsonSchemaDto) {}
