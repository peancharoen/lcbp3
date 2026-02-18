import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';

// Entities
import { AsBuiltDrawing } from './entities/asbuilt-drawing.entity';
import { AsBuiltDrawingRevision } from './entities/asbuilt-drawing-revision.entity';
import { ShopDrawingRevision } from './entities/shop-drawing-revision.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { User } from '../user/entities/user.entity';

// DTOs
import { CreateAsBuiltDrawingDto } from './dto/create-asbuilt-drawing.dto';
import { CreateAsBuiltDrawingRevisionDto } from './dto/create-asbuilt-drawing-revision.dto';
import { SearchAsBuiltDrawingDto } from './dto/search-asbuilt-drawing.dto';

// Services
import { FileStorageService } from '../../common/file-storage/file-storage.service';

@Injectable()
export class AsBuiltDrawingService {
  private readonly logger = new Logger(AsBuiltDrawingService.name);

  constructor(
    @InjectRepository(AsBuiltDrawing)
    private asBuiltDrawingRepo: Repository<AsBuiltDrawing>,
    @InjectRepository(AsBuiltDrawingRevision)
    private revisionRepo: Repository<AsBuiltDrawingRevision>,
    @InjectRepository(ShopDrawingRevision)
    private shopDrawingRevisionRepo: Repository<ShopDrawingRevision>,
    @InjectRepository(Attachment)
    private attachmentRepo: Repository<Attachment>,
    private fileStorageService: FileStorageService,
    private dataSource: DataSource
  ) {}

  /**
   * สร้าง AS Built Drawing ใหม่ พร้อม Revision แรก (Rev 0)
   */
  async create(createDto: CreateAsBuiltDrawingDto, user: User) {
    // 1. Check Duplicate
    const exists = await this.asBuiltDrawingRepo.findOne({
      where: { drawingNumber: createDto.drawingNumber },
    });
    if (exists) {
      throw new ConflictException(
        `Drawing number "${createDto.drawingNumber}" already exists.`
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Prepare Relations
      let shopDrawingRevisions: ShopDrawingRevision[] = [];
      if (createDto.shopDrawingRevisionIds?.length) {
        shopDrawingRevisions = await this.shopDrawingRevisionRepo.findBy({
          id: In(createDto.shopDrawingRevisionIds),
        });
      }

      let attachments: Attachment[] = [];
      if (createDto.attachmentIds?.length) {
        attachments = await this.attachmentRepo.findBy({
          id: In(createDto.attachmentIds),
        });
      }

      // 3. Create Master AS Built Drawing
      const asBuiltDrawing = queryRunner.manager.create(AsBuiltDrawing, {
        projectId: createDto.projectId,
        drawingNumber: createDto.drawingNumber,
        mainCategoryId: createDto.mainCategoryId,
        subCategoryId: createDto.subCategoryId,
        updatedBy: user.user_id,
      });
      const savedDrawing = await queryRunner.manager.save(asBuiltDrawing);

      // 4. Create First Revision (Rev 0)
      const revision = queryRunner.manager.create(AsBuiltDrawingRevision, {
        asBuiltDrawingId: savedDrawing.id,
        revisionNumber: 0,
        revisionLabel: createDto.revisionLabel || '0',
        title: createDto.title,
        legacyDrawingNumber: createDto.legacyDrawingNumber,
        revisionDate: createDto.revisionDate
          ? new Date(createDto.revisionDate)
          : new Date(),
        description: createDto.description,
        shopDrawingRevisions: shopDrawingRevisions,
        attachments: attachments,
      });
      await queryRunner.manager.save(revision);

      // 5. Commit Files
      if (createDto.attachmentIds?.length) {
        await this.fileStorageService.commit(
          createDto.attachmentIds.map(String),
          { issueDate: revision.revisionDate, documentType: 'AsBuiltDrawing' }
        );
      }

      await queryRunner.commitTransaction();

      return {
        ...savedDrawing,
        currentRevision: revision,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create AS Built drawing: ${(err as Error).message}`
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * เพิ่ม Revision ใหม่ (Add Revision)
   */
  async createRevision(
    asBuiltDrawingId: number,
    createDto: CreateAsBuiltDrawingRevisionDto
  ) {
    const asBuiltDrawing = await this.asBuiltDrawingRepo.findOneBy({
      id: asBuiltDrawingId,
    });
    if (!asBuiltDrawing) {
      throw new NotFoundException('AS Built Drawing not found');
    }

    const exists = await this.revisionRepo.findOne({
      where: { asBuiltDrawingId, revisionLabel: createDto.revisionLabel },
    });
    if (exists) {
      throw new ConflictException(
        `Revision label "${createDto.revisionLabel}" already exists for this drawing.`
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let shopDrawingRevisions: ShopDrawingRevision[] = [];
      if (createDto.shopDrawingRevisionIds?.length) {
        shopDrawingRevisions = await this.shopDrawingRevisionRepo.findBy({
          id: In(createDto.shopDrawingRevisionIds),
        });
      }

      let attachments: Attachment[] = [];
      if (createDto.attachmentIds?.length) {
        attachments = await this.attachmentRepo.findBy({
          id: In(createDto.attachmentIds),
        });
      }

      const latestRev = await this.revisionRepo.findOne({
        where: { asBuiltDrawingId },
        order: { revisionNumber: 'DESC' },
      });
      const nextRevNum = (latestRev?.revisionNumber ?? -1) + 1;

      const revision = queryRunner.manager.create(AsBuiltDrawingRevision, {
        asBuiltDrawingId,
        revisionNumber: nextRevNum,
        revisionLabel: createDto.revisionLabel,
        title: createDto.title,
        legacyDrawingNumber: createDto.legacyDrawingNumber,
        revisionDate: createDto.revisionDate
          ? new Date(createDto.revisionDate)
          : new Date(),
        description: createDto.description,
        shopDrawingRevisions: shopDrawingRevisions,
        attachments: attachments,
      });
      await queryRunner.manager.save(revision);

      if (createDto.attachmentIds?.length) {
        await this.fileStorageService.commit(
          createDto.attachmentIds.map(String),
          { issueDate: revision.revisionDate, documentType: 'AsBuiltDrawing' }
        );
      }

      await queryRunner.commitTransaction();
      return revision;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create revision: ${(err as Error).message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * ค้นหา AS Built Drawing
   */
  async findAll(searchDto: SearchAsBuiltDrawingDto) {
    const {
      projectId,
      mainCategoryId,
      subCategoryId,
      search,
      page = 1,
      limit = 20,
    } = searchDto;

    const query = this.asBuiltDrawingRepo
      .createQueryBuilder('abd')
      .leftJoinAndSelect('abd.mainCategory', 'mainCat')
      .leftJoinAndSelect('abd.subCategory', 'subCat')
      .leftJoinAndSelect('abd.revisions', 'rev')
      .where('abd.projectId = :projectId', { projectId });

    if (mainCategoryId) {
      query.andWhere('abd.mainCategoryId = :mainCategoryId', {
        mainCategoryId,
      });
    }

    if (subCategoryId) {
      query.andWhere('abd.subCategoryId = :subCategoryId', { subCategoryId });
    }

    if (search) {
      query.andWhere('abd.drawingNumber LIKE :search', {
        search: `%${search}%`,
      });
    }

    query.orderBy('abd.updatedAt', 'DESC');

    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [items, total] = await query.getManyAndCount();

    // Transform Data
    const transformedItems = items.map((item) => {
      item.revisions.sort((a, b) => b.revisionNumber - a.revisionNumber);
      const currentRevision = item.revisions[0];
      return {
        ...item,
        currentRevision,
        revisions: undefined,
      };
    });

    return {
      data: transformedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ดูรายละเอียด AS Built Drawing
   */
  async findOne(id: number) {
    const asBuiltDrawing = await this.asBuiltDrawingRepo.findOne({
      where: { id },
      relations: [
        'mainCategory',
        'subCategory',
        'revisions',
        'revisions.attachments',
        'revisions.shopDrawingRevisions',
      ],
      order: {
        revisions: { revisionNumber: 'DESC' },
      },
    });

    if (!asBuiltDrawing) {
      throw new NotFoundException(`AS Built Drawing ID ${id} not found`);
    }

    return asBuiltDrawing;
  }

  /**
   * ลบ AS Built Drawing
   */
  async remove(id: number, user: User) {
    const asBuiltDrawing = await this.findOne(id);

    asBuiltDrawing.updatedBy = user.user_id;
    await this.asBuiltDrawingRepo.save(asBuiltDrawing);

    return this.asBuiltDrawingRepo.softRemove(asBuiltDrawing);
  }
}
