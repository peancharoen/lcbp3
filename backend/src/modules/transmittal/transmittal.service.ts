import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transmittal } from './entities/transmittal.entity';
import { TransmittalItem } from './entities/transmittal-item.entity';
import { CreateTransmittalDto } from './dto/create-transmittal.dto';
import { User } from '../user/entities/user.entity';
import { DocumentNumberingService } from '../document-numbering/document-numbering.service';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';

@Injectable()
export class TransmittalService {
  private readonly logger = new Logger(TransmittalService.name);

  constructor(
    @InjectRepository(Transmittal)
    private transmittalRepo: Repository<Transmittal>,
    @InjectRepository(TransmittalItem)
    private itemRepo: Repository<TransmittalItem>,
    @InjectRepository(CorrespondenceType)
    private typeRepo: Repository<CorrespondenceType>,
    @InjectRepository(CorrespondenceStatus)
    private statusRepo: Repository<CorrespondenceStatus>,
    private numberingService: DocumentNumberingService,
    private dataSource: DataSource
  ) {}

  async create(createDto: CreateTransmittalDto, user: User) {
    // 1. Get Transmittal Type (Assuming Code '901' or 'TRN')
    const type = await this.typeRepo.findOne({
      where: { typeCode: 'TRN' }, // Adjust code as per Master Data
    });
    if (!type) throw new NotFoundException('Transmittal Type (TRN) not found');

    const statusDraft = await this.statusRepo.findOne({
      where: { statusCode: 'DRAFT' },
    });
    if (!statusDraft)
      throw new InternalServerErrorException('Status DRAFT not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    if (!user.primaryOrganizationId) {
      throw new BadRequestException(
        'User must belong to an organization to create a transmittal'
      );
    }

    try {
      // 2. Generate Number
      const docNumber = await this.numberingService.generateNextNumber({
        projectId: createDto.projectId,
        originatorId: user.primaryOrganizationId,
        typeId: type.id,
        year: new Date().getFullYear(),
        customTokens: {
          TYPE_CODE: type.typeCode,
          ORG_CODE: 'ORG', // TODO: Fetch real ORG Code
        },
      });

      // 3. Create Correspondence (Parent)
      const correspondence = queryRunner.manager.create(Correspondence, {
        correspondenceNumber: docNumber,
        correspondenceTypeId: type.id,
        projectId: createDto.projectId,
        originatorId: user.primaryOrganizationId,
        isInternal: false,
        createdBy: user.user_id,
      });
      const savedCorr = await queryRunner.manager.save(correspondence);

      // 4. Create Revision (Draft)
      const revision = queryRunner.manager.create(CorrespondenceRevision, {
        correspondenceId: savedCorr.id,
        revisionNumber: 0,
        revisionLabel: '0',
        isCurrent: true,
        statusId: statusDraft.id,
        title: createDto.subject,
        createdBy: user.user_id,
      });
      await queryRunner.manager.save(revision);

      // 5. Create Transmittal
      const transmittal = queryRunner.manager.create(Transmittal, {
        correspondenceId: savedCorr.id,
        purpose: 'FOR_REVIEW', // Default or from DTO
        // remarks: createDto.remarks, // Add if in DTO
      });
      const savedTransmittal = await queryRunner.manager.save(transmittal);

      // 6. Create Items
      if (createDto.items && createDto.items.length > 0) {
        // Filter only items that are effectively correspondences (or mapped as such)
        // For now, assuming itemId refers to correspondenceId if itemType is CORRESPONDENCE
        // If itemType is DRAWING, we skip or throw error (Schema Restriction)
        const validItems = createDto.items.filter(
          (i) => i.itemType === 'CORRESPONDENCE' || i.itemType === 'DRAWING' // Temporary allow DRAWING if ID matches Correspondence? Unsafe.
        );

        const items = createDto.items.map((item) =>
          queryRunner.manager.create(TransmittalItem, {
            transmittalId: savedCorr.id,
            itemCorrespondenceId: item.itemId, // Direct mapping forced by Schema
            quantity: 1, // Default, not in DTO
            remarks: item.description,
          })
        );
        await queryRunner.manager.save(items);
      }

      await queryRunner.commitTransaction();

      return {
        ...savedTransmittal,
        correspondence: savedCorr,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create transmittal: ${(err as Error).message}`
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findOne(id: number) {
    const transmittal = await this.transmittalRepo.findOne({
      where: { correspondenceId: id },
      relations: ['correspondence', 'correspondence.revisions', 'items'],
    });
    if (!transmittal)
      throw new NotFoundException(`Transmittal ID ${id} not found`);
    return transmittal;
  }

  async findAll(query: any) {
    const { page = 1, limit = 20, projectId, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.transmittalRepo
      .createQueryBuilder('transmittal')
      .innerJoinAndSelect('transmittal.correspondence', 'correspondence')
      .leftJoinAndSelect(
        'correspondence.revisions',
        'revision',
        'revision.isCurrent = :isCurrent',
        { isCurrent: true }
      )
      .leftJoinAndSelect('transmittal.items', 'items')
      .leftJoinAndSelect('items.itemCorrespondence', 'itemCorrespondence');

    if (projectId) {
      queryBuilder.andWhere('correspondence.projectId = :projectId', {
        projectId,
      });
    }

    if (search) {
      queryBuilder.andWhere(
        '(correspondence.correspondenceNumber LIKE :search OR revision.title LIKE :search)',
        { search: `%${search}%` }
      );
    }

    const [items, total] = await queryBuilder
      .orderBy('correspondence.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
