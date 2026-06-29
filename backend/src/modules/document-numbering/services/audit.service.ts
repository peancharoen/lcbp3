import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentNumberAudit } from '../entities/document-number-audit.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(DocumentNumberAudit)
    private readonly auditRepo: Repository<DocumentNumberAudit>
  ) {}

  async log(entry: Partial<DocumentNumberAudit>): Promise<void> {
    try {
      // Async save - do not await strictly if we want fire-and-forget, but for data integrity await is safer in critical flows
      // For performance, we might offload to a queue, but direct save is safer for now.
      const logEntry = this.auditRepo.create(entry);
      await this.auditRepo.save(logEntry);
    } catch (error) {
      this.logger.error('Failed to write audit log', error);
      // Fail silent or throw? -> Fail silent to not crash the main flow, assuming log is secondary
    }
  }
}
