import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentNumberFormat } from '../entities/document-number-format.entity';
// import { TemplateValidator } from '../validators/template.validator'; // TODO: Create validator

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectRepository(DocumentNumberFormat)
    private readonly formatRepo: Repository<DocumentNumberFormat>
    // private readonly validator: TemplateValidator,
  ) {}

  async findTemplate(
    projectId: number,
    correspondenceTypeId?: number
  ): Promise<DocumentNumberFormat | null> {
    // 1. Try specific Project + Type
    if (correspondenceTypeId) {
      const specific = await this.formatRepo.findOne({
        where: { projectId, correspondenceTypeId },
      });
      if (specific) return specific;
    }

    // 2. Fallback to Project default (type IS NULL)
    // Note: Assuming specific requirements for fallback, usually project-wide default is stored with null type
    // If not, we might need a Global default logic.
    const defaultProj = await this.formatRepo.findOne({
      where: { projectId, correspondenceTypeId: undefined }, // IS NULL
    });

    return defaultProj;
  }

  // Placeholder for Create/Update with validation logic
}
