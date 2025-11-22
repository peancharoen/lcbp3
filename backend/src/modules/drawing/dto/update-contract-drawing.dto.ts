import { PartialType } from '@nestjs/swagger';
import { CreateContractDrawingDto } from './create-contract-drawing.dto';

export class UpdateContractDrawingDto extends PartialType(
  CreateContractDrawingDto,
) {}
