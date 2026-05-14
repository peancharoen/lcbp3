// File: src/modules/distribution/services/transmittal-creator.service.ts
// Change Log
// - 2026-05-14: Use schema-aligned Matrix conditions and canonical documentTypeId lookup.
// สร้าง Transmittal records จาก Distribution jobs (T057)
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { DistributionMatrix } from '../entities/distribution-matrix.entity';
import { DistributionRecipient } from '../entities/distribution-recipient.entity';
import { DeliveryMethod, RecipientType } from '../../common/enums/review.enums';
import { CorrespondenceRevision } from '../../correspondence/entities/correspondence-revision.entity';
import { Correspondence } from '../../correspondence/entities/correspondence.entity';
import { CorrespondenceType } from '../../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../../correspondence/entities/correspondence-status.entity';
import { CorrespondenceRecipient } from '../../correspondence/entities/correspondence-recipient.entity';
import { Transmittal } from '../../transmittal/entities/transmittal.entity';
import { TransmittalItem } from '../../transmittal/entities/transmittal-item.entity';
import { DocumentNumberingService } from '../../document-numbering/services/document-numbering.service';
import { Organization } from '../../organization/entities/organization.entity';
import { User } from '../../user/entities/user.entity';

export interface DistributionNotificationTarget {
  userId: number;
  deliveryMethod: DeliveryMethod;
}

export interface DistributionCreationResult {
  transmittalPublicIds: string[];
  notificationTargets: DistributionNotificationTarget[];
}

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
    private readonly dataSource: DataSource,
    private readonly numberingService: DocumentNumberingService
  ) {}

  /**
   * สร้าง Transmittal draft จาก Distribution event (FR-019)
   * Note: actual Transmittal creation ผ่าน TransmittalModule — inject ที่ DI level
   */
  async createFromDistribution(payload: {
    rfaPublicId: string;
    rfaRevisionPublicId: string;
    projectId: number;
    documentTypeId?: number;
    documentTypeCode?: string;
    responseCode: string;
  }): Promise<DistributionCreationResult> {
    if (!payload.documentTypeId) {
      this.logger.warn(
        `Distribution skipped for RFA ${payload.rfaPublicId}: documentTypeId missing`
      );
      return { transmittalPublicIds: [], notificationTargets: [] };
    }

    const matrix = await this.matrixRepo.findOne({
      where: [
        {
          projectId: payload.projectId,
          documentTypeId: payload.documentTypeId,
          isActive: true,
        },
        {
          projectId: IsNull(),
          documentTypeId: payload.documentTypeId,
          isActive: true,
        },
      ],
      relations: ['recipients'],
    });

    if (!matrix || !matrix.recipients || matrix.recipients.length === 0) {
      this.logger.log(
        `No distribution matrix found for project ${payload.projectId}, docType ${payload.documentTypeId}`
      );
      return { transmittalPublicIds: [], notificationTargets: [] };
    }

    // ตรวจสอบ response code filter
    if (
      matrix.conditions?.codes &&
      matrix.conditions.codes.length > 0 &&
      !matrix.conditions.codes.includes(payload.responseCode)
    ) {
      this.logger.log(
        `Response code ${payload.responseCode} not in filter — skipping distribution`
      );
      return { transmittalPublicIds: [], notificationTargets: [] };
    }
    if (matrix.conditions?.excludeCodes?.includes(payload.responseCode)) {
      this.logger.log(
        `Response code ${payload.responseCode} is excluded — skipping distribution`
      );
      return { transmittalPublicIds: [], notificationTargets: [] };
    }

    const sourceRevision = await this.dataSource.manager.findOne(
      CorrespondenceRevision,
      {
        where: { publicId: payload.rfaRevisionPublicId },
        relations: ['correspondence'],
      }
    );
    if (!sourceRevision?.correspondence) {
      this.logger.warn(
        `Distribution skipped for RFA ${payload.rfaPublicId}: source revision not found`
      );
      return { transmittalPublicIds: [], notificationTargets: [] };
    }

    const recipientOrganizationIds = await this.resolveRecipientOrganizations(
      matrix.recipients
    );
    const notificationTargets = await this.resolveNotificationTargets(
      matrix.recipients
    );
    if (recipientOrganizationIds.length === 0) {
      this.logger.warn(
        `Distribution skipped for RFA ${payload.rfaPublicId}: no organization recipients resolved`
      );
      return { transmittalPublicIds: [], notificationTargets };
    }

    this.logger.log(
      `Creating Transmittal for RFA ${payload.rfaPublicId} → ${recipientOrganizationIds.length} recipient organizations`
    );

    const transmittalPublicIds: string[] = [];
    for (const recipientOrganizationId of recipientOrganizationIds) {
      const existingPublicId = await this.findExistingTransmittalPublicId(
        sourceRevision.correspondence.id,
        recipientOrganizationId
      );
      if (existingPublicId) {
        transmittalPublicIds.push(existingPublicId);
        continue;
      }
      const createdPublicId = await this.createDraftTransmittal({
        sourceCorrespondence: sourceRevision.correspondence,
        recipientOrganizationId,
        payload,
      });
      if (createdPublicId) transmittalPublicIds.push(createdPublicId);
    }
    return { transmittalPublicIds, notificationTargets };
  }

  private async resolveNotificationTargets(
    recipients: DistributionRecipient[]
  ): Promise<DistributionNotificationTarget[]> {
    const targets = new Map<number, DistributionNotificationTarget>();
    for (const recipient of recipients) {
      if (recipient.recipientType !== RecipientType.USER) continue;
      const user = await this.dataSource.manager.findOne(User, {
        where: { publicId: recipient.recipientPublicId },
      });
      if (!user) continue;
      targets.set(user.user_id, {
        userId: user.user_id,
        deliveryMethod: recipient.deliveryMethod,
      });
    }
    return Array.from(targets.values());
  }

  private async resolveRecipientOrganizations(
    recipients: DistributionRecipient[]
  ): Promise<number[]> {
    const organizationIds = new Set<number>();
    for (const recipient of recipients) {
      const organizationId =
        await this.resolveRecipientOrganizationId(recipient);
      if (organizationId) organizationIds.add(organizationId);
    }
    return Array.from(organizationIds);
  }

  private async resolveRecipientOrganizationId(
    recipient: DistributionRecipient
  ): Promise<number | undefined> {
    if (recipient.deliveryMethod === DeliveryMethod.IN_APP) return undefined;
    if (recipient.recipientType === RecipientType.ORGANIZATION) {
      const organization = await this.dataSource.manager.findOne(Organization, {
        where: { publicId: recipient.recipientPublicId },
      });
      return organization?.id;
    }
    if (recipient.recipientType === RecipientType.USER) {
      const user = await this.dataSource.manager.findOne(User, {
        where: { publicId: recipient.recipientPublicId },
      });
      return user?.primaryOrganizationId;
    }
    this.logger.warn(
      `Recipient type ${recipient.recipientType} requires expansion and was skipped for Transmittal creation`
    );
    return undefined;
  }

  private async findExistingTransmittalPublicId(
    sourceCorrespondenceId: number,
    recipientOrganizationId: number
  ): Promise<string | undefined> {
    const rows = await this.dataSource.query<Array<{ publicId: string }>>(
      `
        SELECT c.uuid AS publicId
        FROM transmittals t
        INNER JOIN correspondences c ON c.id = t.correspondence_id
        INNER JOIN transmittal_items ti ON ti.transmittal_id = t.correspondence_id
        INNER JOIN correspondence_recipients cr ON cr.correspondence_id = t.correspondence_id
        WHERE ti.item_correspondence_id = ?
          AND cr.recipient_organization_id = ?
        LIMIT 1
      `,
      [sourceCorrespondenceId, recipientOrganizationId]
    );
    return rows[0]?.publicId;
  }

  private async createDraftTransmittal(context: {
    sourceCorrespondence: Correspondence;
    recipientOrganizationId: number;
    payload: {
      rfaPublicId: string;
      projectId: number;
      responseCode: string;
    };
  }): Promise<string | undefined> {
    const type = await this.dataSource.manager.findOne(CorrespondenceType, {
      where: { typeCode: 'TRN' },
    });
    const status = await this.dataSource.manager.findOne(CorrespondenceStatus, {
      where: { statusCode: 'DRAFT' },
    });
    if (!type || !status || !context.sourceCorrespondence.originatorId) {
      this.logger.warn(
        `Distribution skipped for RFA ${context.payload.rfaPublicId}: missing Transmittal master data or originator`
      );
      return undefined;
    }

    const docNumber = await this.numberingService.generateNextNumber({
      projectId: context.payload.projectId,
      originatorOrganizationId: context.sourceCorrespondence.originatorId,
      recipientOrganizationId: context.recipientOrganizationId,
      typeId: type.id,
      year: new Date().getFullYear(),
      customTokens: {
        TYPE_CODE: type.typeCode,
        RESPONSE_CODE: context.payload.responseCode,
      },
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber.number,
        correspondenceTypeId: type.id,
        projectId: context.payload.projectId,
        originatorId: context.sourceCorrespondence.originatorId,
        isInternal: false,
      });
      const savedCorrespondence =
        await queryRunner.manager.save(correspondence);

      const revision = queryRunner.manager.create(CorrespondenceRevision, {
        correspondenceId: savedCorrespondence.id,
        revisionNumber: 0,
        revisionLabel: '0',
        isCurrent: true,
        statusId: status.id,
        subject: `Distribution for ${context.sourceCorrespondence.correspondenceNumber}`,
        details: {
          sourceRfaPublicId: context.payload.rfaPublicId,
        },
      });
      await queryRunner.manager.save(revision);

      const recipient = queryRunner.manager.create(CorrespondenceRecipient, {
        correspondenceId: savedCorrespondence.id,
        recipientOrganizationId: context.recipientOrganizationId,
        recipientType: 'TO',
      });
      await queryRunner.manager.save(recipient);

      const transmittal = queryRunner.manager.create(Transmittal, {
        correspondenceId: savedCorrespondence.id,
        purpose: 'FOR_INFORMATION',
        remarks: `Auto-distributed from RFA ${context.payload.rfaPublicId}`,
      });
      await queryRunner.manager.save(transmittal);

      const item = queryRunner.manager.create(TransmittalItem, {
        transmittalId: savedCorrespondence.id,
        itemCorrespondenceId: context.sourceCorrespondence.id,
        quantity: 1,
        remarks: `RFA response code ${context.payload.responseCode}`,
      });
      await queryRunner.manager.save(item);

      await queryRunner.commitTransaction();
      return savedCorrespondence.publicId;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
