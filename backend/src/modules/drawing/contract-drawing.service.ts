import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Brackets } from 'typeorm';

// Entities
import { ContractDrawing } from './entities/contract-drawing.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { User } from '../user/entities/user.entity';

// DTOs
import { CreateContractDrawingDto } from './dto/create-contract-drawing.dto';
import { SearchContractDrawingDto } from './dto/search-contract-drawing.dto';
import { UpdateContractDrawingDto } from './dto/update-contract-drawing.dto';

// Services
import { FileStorageService } from '../../common/file-storage/file-storage.service';

@Injectable()
export class ContractDrawingService {
  private readonly logger = new Logger(ContractDrawingService.name);

  constructor(
    @InjectRepository(ContractDrawing)
    private drawingRepo: Repository<ContractDrawing>,
    @InjectRepository(Attachment)
    private attachmentRepo: Repository<Attachment>,
    private fileStorageService: FileStorageService,
    private dataSource: DataSource
  ) {}

  /**
   * สร้างแบบสัญญาใหม่ (Create Contract Drawing)
   * - ตรวจสอบเลขที่ซ้ำในโปรเจกต์
   * - บันทึกข้อมูล
   * - ผูกไฟล์แนบและ Commit ไฟล์จาก Temp -> Permanent
   */
  async create(createDto: CreateContractDrawingDto, user: User) {
    // 1. ตรวจสอบเลขที่แบบซ้ำ (Unique per Project)
    const exists = await this.drawingRepo.findOne({
      where: {
        projectId: createDto.projectId,
        contractDrawingNo: createDto.contractDrawingNo,
      },
    });

    if (exists) {
      throw new ConflictException(
        `Contract Drawing No. "${createDto.contractDrawingNo}" already exists in this project.`
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. เตรียมไฟล์แนบ
      let attachments: Attachment[] = [];
      if (createDto.attachmentIds?.length) {
        attachments = await this.attachmentRepo.findBy({
          id: In(createDto.attachmentIds),
        });
      }

      // 3. สร้าง Entity
      const drawing = queryRunner.manager.create(ContractDrawing, {
        projectId: createDto.projectId,
        contractDrawingNo: createDto.contractDrawingNo,
        title: createDto.title,
        mapCatId: createDto.mapCatId, // Updated
        volumeId: createDto.volumeId,
        volumePage: createDto.volumePage, // Updated
        updatedBy: user.user_id,
        attachments: attachments,
      });

      const savedDrawing = await queryRunner.manager.save(drawing);

      // 4. Commit Files (ย้ายไฟล์จริง)
      if (createDto.attachmentIds?.length) {
        // ✅ FIX TS2345: แปลง number[] เป็น string[] ก่อนส่ง
        await this.fileStorageService.commit(
          createDto.attachmentIds.map(String),
          { documentType: 'ContractDrawing' }
        );
      }

      await queryRunner.commitTransaction();
      return savedDrawing;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      // ✅ FIX TS18046: Cast err เป็น Error
      this.logger.error(
        `Failed to create contract drawing: ${(err as Error).message}`
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * ค้นหาแบบสัญญา (Search & Filter)
   * รองรับ Pagination และการค้นหาด้วย Text
   */
  async findAll(searchDto: SearchContractDrawingDto) {
    const {
      projectId,
      volumeId,
      mapCatId,
      search,
      page = 1,
      limit = 20,
    } = searchDto;

    const query = this.drawingRepo
      .createQueryBuilder('drawing')
      .leftJoinAndSelect('drawing.attachments', 'files')
      // .leftJoinAndSelect('drawing.subCategory', 'subCat')
      // .leftJoinAndSelect('drawing.volume', 'vol')
      .where('drawing.projectId = :projectId', { projectId });

    // Filter by Volume
    if (volumeId) {
      query.andWhere('drawing.volumeId = :volumeId', { volumeId });
    }

    // Filter by Map Category (Updated)
    if (mapCatId) {
      query.andWhere('drawing.mapCatId = :mapCatId', { mapCatId });
    }

    // Search Text (No. or Title)
    if (search) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('drawing.contractDrawingNo LIKE :search', {
            search: `%${search}%`,
          }).orWhere('drawing.title LIKE :search', { search: `%${search}%` });
        })
      );
    }

    query.orderBy('drawing.contractDrawingNo', 'ASC');

    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [items, total] = await query.getManyAndCount();

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

  /**
   * ดึงข้อมูลแบบรายตัว (Get One)
   */
  async findOne(id: number) {
    const drawing = await this.drawingRepo.findOne({
      where: { id },
      relations: ['attachments'], // เพิ่ม relations อื่นๆ ตามต้องการ
    });

    if (!drawing) {
      throw new NotFoundException(`Contract Drawing ID ${id} not found`);
    }

    return drawing;
  }

  /**
   * แก้ไขข้อมูลแบบ (Update)
   */
  async update(id: number, updateDto: UpdateContractDrawingDto, user: User) {
    const drawing = await this.findOne(id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update Fields
      if (updateDto.contractDrawingNo)
        drawing.contractDrawingNo = updateDto.contractDrawingNo;
      if (updateDto.title) drawing.title = updateDto.title;
      if (updateDto.volumeId !== undefined)
        drawing.volumeId = updateDto.volumeId;
      if (updateDto.volumePage !== undefined)
        drawing.volumePage = updateDto.volumePage;
      if (updateDto.mapCatId !== undefined)
        drawing.mapCatId = updateDto.mapCatId;

      drawing.updatedBy = user.user_id;

      // Update Attachments (Replace logic)
      if (updateDto.attachmentIds) {
        const newAttachments = await this.attachmentRepo.findBy({
          id: In(updateDto.attachmentIds),
        });
        drawing.attachments = newAttachments;

        // Commit new files
        // ✅ FIX TS2345: แปลง number[] เป็น string[] ก่อนส่ง
        await this.fileStorageService.commit(
          updateDto.attachmentIds.map(String),
          { documentType: 'ContractDrawing' }
        );
      }

      const updatedDrawing = await queryRunner.manager.save(drawing);
      await queryRunner.commitTransaction();

      return updatedDrawing;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      // ✅ FIX TS18046: Cast err เป็น Error (Optional: Added logger here too for consistency)
      this.logger.error(
        `Failed to update contract drawing: ${(err as Error).message}`
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * ลบแบบสัญญา (Soft Delete)
   */
  async remove(id: number, user: User) {
    const drawing = await this.findOne(id);

    // บันทึกว่าใครเป็นคนลบก่อน Soft Delete (Optional)
    drawing.updatedBy = user.user_id;
    await this.drawingRepo.save(drawing);

    return this.drawingRepo.softRemove(drawing);
  }
}
