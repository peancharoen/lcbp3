// File: src/modules/distribution/services/transmittal-creator.service.ts
// สร้าง Transmittal records จาก Distribution jobs (T057)
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DistributionMatrix } from '../entities/distribution-matrix.entity';

/**
 * TransmittalCreatorService — ใช้ Strangler Pattern ไม่แก้ไข TransmittalService เดิม
 * สร้าง Transmittal ผ่าน existing TransmittalService หลัง distribution
 */
@Injectable()
export class TransmittalCreatorService {
  private readonly logger = new Logger(TransmittalCreatorService.name);

  constructor(
    @InjectRepository(DistributionMatrix)
    private readonly matrixRepo: Repository<DistributionMatrix>,
  ) {}

  /**
   * สร้าง Transmittal draft จาก Distribution event (FR-019)
   * Note: actual Transmittal creation ผ่าน TransmittalModule — inject ที่ DI level
   */
  async createFromDistribution(payload: {
    rfaPublicId: string;
    rfaRevisionPublicId: string;
    projectId: number;
    documentTypeCode: string;
    responseCode: string;
  }): Promise<{ transmittalPublicIds: string[] }> {
    const matrix = await this.matrixRepo.findOne({
      where: {
        projectId: payload.projectId,
        documentTypeCode: payload.documentTypeCode,
        isActive: true,
      },
      relations: ['recipients'],
    });

    if (!matrix || !matrix.recipients || matrix.recipients.length === 0) {
      this.logger.log(
        `No distribution matrix found for project ${payload.projectId}, docType ${payload.documentTypeCode}`,
      );
      return { transmittalPublicIds: [] };
    }

    // ตรวจสอบ response code filter
    if (
      matrix.responseCodeFilter &&
      matrix.responseCodeFilter.length > 0 &&
      !matrix.responseCodeFilter.includes(payload.responseCode)
    ) {
      this.logger.log(
        `Response code ${payload.responseCode} not in filter — skipping distribution`,
      );
      return { transmittalPublicIds: [] };
    }

    this.logger.log(
      `Creating Transmittal for RFA ${payload.rfaPublicId} → ${matrix.recipients.length} recipients`,
    );

    // TODO: เรียก TransmittalService.create() เมื่อ integrate ใน Sprint ถัดไป
    // return transmittalService.createDraft({ rfaPublicId, recipients });

    return { transmittalPublicIds: [] };
  }
}
