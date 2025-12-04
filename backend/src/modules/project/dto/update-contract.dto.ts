import { PartialType } from '@nestjs/swagger';
import { CreateContractDto } from './create-contract.dto.js';

export class UpdateContractDto extends PartialType(CreateContractDto) {}
