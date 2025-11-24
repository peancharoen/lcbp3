import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Brackets } from 'typeorm';

// Entities
import { ShopDrawing } from './entities/shop-drawing.entity';
import { ShopDrawingRevision } from './entities/shop-drawing-revision.entity';
import { ContractDrawing } from './entities/contract-drawing.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { User } from '../user/entities/user.entity';

// DTOs
import { CreateShopDrawingDto } from './dto/create-shop-drawing.dto';
import { CreateShopDrawingRevisionDto } from './dto/create-shop-drawing-revision.dto';
import { SearchShopDrawingDto } from './dto/search-shop-drawing.dto';

// Services
import { FileStorageService } from '../../common/file-storage/file-storage.service';

@Injectable()
export class ShopDrawingService {
  private readonly logger = new Logger(ShopDrawingService.name);

  constructor(
    @InjectRepository(ShopDrawing)
    private shopDrawingRepo: Repository<ShopDrawing>,
    @InjectRepository(ShopDrawingRevision)
    private revisionRepo: Repository<ShopDrawingRevision>,
    @InjectRepository(ContractDrawing)
    private contractDrawingRepo: Repository<ContractDrawing>,
    @InjectRepository(Attachment)
    private attachmentRepo: Repository<Attachment>,
    private fileStorageService: FileStorageService,
    private dataSource: DataSource,
  ) {}

  /**
   * สร้าง Shop Drawing ใหม่ พร้อม Revision แรก (Rev 0)
   */
  async create(createDto: CreateShopDrawingDto, user: User) {
    // 1. Check Duplicate
    const exists = await this.shopDrawingRepo.findOne({
      where: { drawingNumber: createDto.drawingNumber },
    });
    if (exists) {
      throw new ConflictException(
        `Drawing number "${createDto.drawingNumber}" already exists.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Prepare Relations
      let contractDrawings: ContractDrawing[] = [];
      if (createDto.contractDrawingIds?.length) {
        contractDrawings = await this.contractDrawingRepo.findBy({
          id: In(createDto.contractDrawingIds),
        });
      }

      let attachments: Attachment[] = [];
      if (createDto.attachmentIds?.length) {
        attachments = await this.attachmentRepo.findBy({
          id: In(createDto.attachmentIds),
        });
      }

      // 3. Create Master Shop Drawing
      const shopDrawing = queryRunner.manager.create(ShopDrawing, {
        projectId: createDto.projectId,
        drawingNumber: createDto.drawingNumber,
        title: createDto.title,
        mainCategoryId: createDto.mainCategoryId,
        subCategoryId: createDto.subCategoryId,
        updatedBy: user.user_id,
      });
      const savedShopDrawing = await queryRunner.manager.save(shopDrawing);

      // 4. Create First Revision (Rev 0)
      const revision = queryRunner.manager.create(ShopDrawingRevision, {
        shopDrawingId: savedShopDrawing.id,
        revisionNumber: 0,
        revisionLabel: createDto.revisionLabel || '0',
        revisionDate: createDto.revisionDate
          ? new Date(createDto.revisionDate)
          : new Date(),
        description: createDto.description,
        contractDrawings: contractDrawings,
        attachments: attachments,
      });
      await queryRunner.manager.save(revision);

      // 5. Commit Files
      if (createDto.attachmentIds?.length) {
        await this.fileStorageService.commit(
          createDto.attachmentIds.map(String),
        );
      }

      await queryRunner.commitTransaction();

      // ✅ FIX: Return ข้อมูลของ ShopDrawing และ Revision (ไม่ใช่ savedCorr หรือ docNumber)
      return {
        ...savedShopDrawing,
        currentRevision: revision,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create shop drawing: ${(err as Error).message}`,
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
    shopDrawingId: number,
    createDto: CreateShopDrawingRevisionDto,
  ) {
    const shopDrawing = await this.shopDrawingRepo.findOneBy({
      id: shopDrawingId,
    });
    if (!shopDrawing) {
      throw new NotFoundException('Shop Drawing not found');
    }

    const exists = await this.revisionRepo.findOne({
      where: { shopDrawingId, revisionLabel: createDto.revisionLabel },
    });
    if (exists) {
      throw new ConflictException(
        `Revision label "${createDto.revisionLabel}" already exists for this drawing.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let contractDrawings: ContractDrawing[] = [];
      if (createDto.contractDrawingIds?.length) {
        contractDrawings = await this.contractDrawingRepo.findBy({
          id: In(createDto.contractDrawingIds),
        });
      }

      let attachments: Attachment[] = [];
      if (createDto.attachmentIds?.length) {
        attachments = await this.attachmentRepo.findBy({
          id: In(createDto.attachmentIds),
        });
      }

      const latestRev = await this.revisionRepo.findOne({
        where: { shopDrawingId },
        order: { revisionNumber: 'DESC' },
      });
      const nextRevNum = (latestRev?.revisionNumber ?? -1) + 1;

      const revision = queryRunner.manager.create(ShopDrawingRevision, {
        shopDrawingId,
        revisionNumber: nextRevNum,
        revisionLabel: createDto.revisionLabel,
        revisionDate: createDto.revisionDate
          ? new Date(createDto.revisionDate)
          : new Date(),
        description: createDto.description,
        contractDrawings: contractDrawings,
        attachments: attachments,
      });
      await queryRunner.manager.save(revision);

      if (createDto.attachmentIds?.length) {
        await this.fileStorageService.commit(
          createDto.attachmentIds.map(String),
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
   * ค้นหา Shop Drawing
   */
  async findAll(searchDto: SearchShopDrawingDto) {
    const {
      projectId,
      mainCategoryId,
      subCategoryId,
      search,
      page = 1,
      pageSize = 20,
    } = searchDto;

    const query = this.shopDrawingRepo
      .createQueryBuilder('sd')
      .leftJoinAndSelect('sd.mainCategory', 'mainCat')
      .leftJoinAndSelect('sd.subCategory', 'subCat')
      .leftJoinAndSelect('sd.revisions', 'rev')
      .where('sd.projectId = :projectId', { projectId });

    if (mainCategoryId) {
      query.andWhere('sd.mainCategoryId = :mainCategoryId', { mainCategoryId });
    }

    if (subCategoryId) {
      query.andWhere('sd.subCategoryId = :subCategoryId', { subCategoryId });
    }

    if (search) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('sd.drawingNumber LIKE :search', {
            search: `%${search}%`,
          }).orWhere('sd.title LIKE :search', { search: `%${search}%` });
        }),
      );
    }

    query.orderBy('sd.updatedAt', 'DESC');

    const skip = (page - 1) * pageSize;
    query.skip(skip).take(pageSize);

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
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * ดูรายละเอียด Shop Drawing
   */
  async findOne(id: number) {
    const shopDrawing = await this.shopDrawingRepo.findOne({
      where: { id },
      relations: [
        'mainCategory',
        'subCategory',
        'revisions',
        'revisions.attachments',
        'revisions.contractDrawings',
      ],
      order: {
        revisions: { revisionNumber: 'DESC' },
      },
    });

    if (!shopDrawing) {
      throw new NotFoundException(`Shop Drawing ID ${id} not found`);
    }

    return shopDrawing;
  }

  /**
   * ลบ Shop Drawing
   */
  async remove(id: number, user: User) {
    const shopDrawing = await this.findOne(id);

    shopDrawing.updatedBy = user.user_id;
    await this.shopDrawingRepo.save(shopDrawing);

    return this.shopDrawingRepo.softRemove(shopDrawing);
  }
}
