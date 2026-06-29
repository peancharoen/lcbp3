import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { validate as uuidValidate } from 'uuid';

/**
 * Validates that a route parameter is a valid UUID string.
 * Accepts any UUID version (v1 from DB DEFAULT, v7 from app generation).
 *
 * Usage: @Param('uuid', ParseUuidPipe) uuid: string
 *
 * @see ADR-019 Hybrid Identifier Strategy
 */
@Injectable()
export class ParseUuidPipe implements PipeTransform<string> {
  transform(value: string): string {
    if (!uuidValidate(value)) {
      throw new BadRequestException(`Invalid UUID format: ${value}`);
    }
    return value.toLowerCase();
  }
}
