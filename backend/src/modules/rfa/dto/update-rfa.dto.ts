import { PartialType } from '@nestjs/swagger';
import { CreateRfaDto } from './create-rfa.dto';

export class UpdateRfaDto extends PartialType(CreateRfaDto) {}
