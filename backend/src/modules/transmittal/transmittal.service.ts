// File: src/modules/transmittal/transmittal.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';

import { Transmittal } from './entities/transmittal.entity.js';
import { TransmittalItem } from './entities/transmittal-item.entity.js';
import { Correspondence } from '../correspondence/entities/correspondence.entity.js';
import { CreateTransmittalDto } from './dto/create-transmittal.dto.js';
import { User } from '../user/entities/user.entity.js';
import { DocumentNumberingService } from '../document-numbering/document-numbering.service.js';
import { SearchService } from '../search/search.service.js';

@Injectable()
export class TransmittalService {
  constructor(
    @InjectRepository(Transmittal)
    private transmittalRepo: Repository<Transmittal>,
    @InjectRepository(TransmittalItem)
    private transmittalItemRepo: Repository<TransmittalItem>,
    @InjectRepository(Correspondence)
    private correspondenceRepo: Repository<Correspondence>,
    private numberingService: DocumentNumberingService,
    private dataSource: DataSource,
    private searchService: SearchService,
  ) {}

  async create(createDto: CreateTransmittalDto, user: User) {
    if (!user.primaryOrganizationId) {
      throw new BadRequestException(
        'User must belong to an organization to create documents',
      );
    }
    const userOrgId = user.primaryOrganizationId;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transmittalTypeId = 3; // TODO: ดึง ID จริงจาก DB หรือ Config
      const orgCode = 'ORG'; // TODO: Fetch real ORG Code

      // [FIXED] เรียกใช้แบบ Object Context
      const docNumber = await this.numberingService.generateNextNumber({
        projectId: createDto.projectId,
        originatorId: userOrgId,
        typeId: transmittalTypeId,
        year: new Date().getFullYear(),
        customTokens: {
          TYPE_CODE: 'TR',
          ORG_CODE: orgCode,
        },
      });

      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber,
        correspondenceTypeId: transmittalTypeId,
        projectId: createDto.projectId,
        originatorId: userOrgId,
        isInternal: false,
        createdBy: user.user_id,
      });
      const savedCorr = await queryRunner.manager.save(correspondence);

      const transmittal = queryRunner.manager.create(Transmittal, {
        correspondenceId: savedCorr.id,
        purpose: createDto.purpose,
        remarks: createDto.remarks,
      });
      await queryRunner.manager.save(transmittal);

      if (createDto.itemIds && createDto.itemIds.length > 0) {
        const items = createDto.itemIds.map((itemId) =>
          queryRunner.manager.create(TransmittalItem, {
            transmittalId: savedCorr.id,
            itemCorrespondenceId: itemId,
            quantity: 1,
          }),
        );
        await queryRunner.manager.save(items);
      }

      await queryRunner.commitTransaction();
      return { ...savedCorr, transmittal };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}