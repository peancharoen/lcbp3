import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DocumentNumberCounter } from '../entities/document-number-counter.entity';
import { CounterKeyDto } from '../dto/counter-key.dto';

@Injectable()
export class CounterService {
  private readonly logger = new Logger(CounterService.name);

  constructor(
    @InjectRepository(DocumentNumberCounter)
    private counterRepo: Repository<DocumentNumberCounter>,
    private dataSource: DataSource
  ) {}

  /**
   * Increment counter and return next number
   * Uses optimistic locking to prevent race conditions
   */
  async incrementCounter(counterKey: CounterKeyDto): Promise<number> {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          // Find or create counter
          let counter = await manager.findOne(DocumentNumberCounter, {
            where: this.buildWhereClause(counterKey),
          });

          if (!counter) {
            counter = manager.create(DocumentNumberCounter, {
              projectId: counterKey.projectId,
              originatorId: counterKey.originatorOrganizationId,
              recipientOrganizationId: counterKey.recipientOrganizationId,
              correspondenceTypeId: counterKey.correspondenceTypeId,
              subTypeId: counterKey.subTypeId,
              rfaTypeId: counterKey.rfaTypeId,
              disciplineId: counterKey.disciplineId,
              resetScope: counterKey.resetScope,
              lastNumber: 1,
              version: 0,
            });
            await manager.save(counter);
            return 1;
          }

          // Increment with optimistic lock
          const currentVersion = counter.version;
          const nextNumber = counter.lastNumber + 1;

          const result = await manager
            .createQueryBuilder()
            .update(DocumentNumberCounter)
            .set({
              lastNumber: nextNumber,
              version: () => 'version + 1',
            })
            .where(this.buildWhereClause(counterKey))
            .andWhere('version = :version', { version: currentVersion })
            .execute();

          if (result.affected === 0) {
            throw new ConflictException('Counter version conflict');
          }

          return nextNumber;
        });
      } catch (error) {
        if (error instanceof ConflictException && attempt < MAX_RETRIES - 1) {
          this.logger.warn(
            `Version conflict on attempt ${attempt + 1}/${MAX_RETRIES}, retrying...`
          );
          // Exponential backoff
          await this.sleep(100 * Math.pow(2, attempt));
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('เลขที่เอกสารถูกเปลี่ยน กรุณาลองใหม่');
  }

  /**
   * Get current counter value without incrementing
   */
  async getCurrentCounter(counterKey: CounterKeyDto): Promise<number> {
    const counter = await this.counterRepo.findOne({
      where: this.buildWhereClause(counterKey),
    });
    return counter?.lastNumber || 0;
  }

  private buildWhereClause(key: CounterKeyDto) {
    return {
      projectId: key.projectId,
      originatorId: key.originatorOrganizationId,
      recipientOrganizationId: key.recipientOrganizationId,
      correspondenceTypeId: key.correspondenceTypeId,
      subTypeId: key.subTypeId,
      rfaTypeId: key.rfaTypeId,
      disciplineId: key.disciplineId,
      resetScope: key.resetScope,
    };
  }

  /**
   * Force update counter value (Admin Override)
   * WARNING: This bypasses optimistic locking checks slightly, but still increments version
   */
  async forceUpdateCounter(
    counterKey: CounterKeyDto,
    newValue: number
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      let counter = await manager.findOne(DocumentNumberCounter, {
        where: this.buildWhereClause(counterKey),
      });

      if (!counter) {
        counter = manager.create(DocumentNumberCounter, {
          projectId: counterKey.projectId,
          originatorId: counterKey.originatorOrganizationId,
          recipientOrganizationId: counterKey.recipientOrganizationId,
          correspondenceTypeId: counterKey.correspondenceTypeId,
          subTypeId: counterKey.subTypeId,
          rfaTypeId: counterKey.rfaTypeId,
          disciplineId: counterKey.disciplineId,
          resetScope: counterKey.resetScope,
          lastNumber: newValue,
          version: 1,
        });
        await manager.save(counter);
      } else {
        // Force update regardless of version, but increment version
        await manager
          .createQueryBuilder()
          .update(DocumentNumberCounter)
          .set({
            lastNumber: newValue,
            version: () => 'version + 1',
          })
          .where(this.buildWhereClause(counterKey))
          .execute();
      }
    });

    this.logger.log(
      `Counter force updated to ${newValue} for key: ${JSON.stringify(
        counterKey
      )}`
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
