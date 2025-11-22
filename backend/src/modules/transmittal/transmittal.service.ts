import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';

import { Transmittal } from './entities/transmittal.entity';
import { TransmittalItem } from './entities/transmittal-item.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CreateTransmittalDto } from './dto/create-transmittal.dto'; // ต้องสร้าง DTO
import { User } from '../user/entities/user.entity';
import { DocumentNumberingService } from '../document-numbering/document-numbering.service';

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
  ) {}

  async create(createDto: CreateTransmittalDto, user: User) {
    // ✅ FIX: ตรวจสอบว่า User มีสังกัดองค์กรหรือไม่
    if (!user.primaryOrganizationId) {
      throw new BadRequestException(
        'User must belong to an organization to create documents',
      );
    }
    const userOrgId = user.primaryOrganizationId; // TypeScript จะรู้ว่าเป็น number แล้ว

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Generate Document Number
      const transmittalTypeId = 3; // TODO: ควรดึง ID จริงจาก DB หรือ Config
      const orgCode = 'ORG'; // TODO: Fetch real ORG Code

      const docNumber = await this.numberingService.generateNextNumber(
        createDto.projectId,
        userOrgId, // ✅ ส่งค่าที่เช็คแล้ว
        transmittalTypeId,
        new Date().getFullYear(),
        { TYPE_CODE: 'TR', ORG_CODE: orgCode },
      );

      // 2. Create Correspondence (Header)
      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber,
        correspondenceTypeId: transmittalTypeId,
        projectId: createDto.projectId,
        originatorId: userOrgId, // ✅ ส่งค่าที่เช็คแล้ว
        isInternal: false,
        createdBy: user.user_id,
      });
      const savedCorr = await queryRunner.manager.save(correspondence);

      // 3. Create Transmittal (Detail)
      const transmittal = queryRunner.manager.create(Transmittal, {
        correspondenceId: savedCorr.id,
        purpose: createDto.purpose,
        remarks: createDto.remarks,
      });
      await queryRunner.manager.save(transmittal);

      // 4. Link Items (Documents being sent)
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
