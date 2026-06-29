import { PartialType } from '@nestjs/swagger';
import { CreateTransmittalDto } from './create-transmittal.dto';

export class UpdateTransmittalDto extends PartialType(CreateTransmittalDto) {}
