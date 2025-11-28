import { PartialType } from '@nestjs/swagger';
import { CreateRfaRevisionDto } from './create-rfa-revision.dto';

export class UpdateRfaDto extends PartialType(CreateRfaRevisionDto) {}
