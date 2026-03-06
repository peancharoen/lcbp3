// File: src/modules/master/master.service.ts

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Import Entities
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { RfaType } from '../rfa/entities/rfa-type.entity';
import { RfaStatusCode } from '../rfa/entities/rfa-status-code.entity';
import { RfaApproveCode } from '../rfa/entities/rfa-approve-code.entity';
import { CirculationStatusCode } from '../circulation/entities/circulation-status-code.entity';
import { Tag } from './entities/tag.entity';

// [New] Entities
import { Discipline } from './entities/discipline.entity';
import { CorrespondenceSubType } from '../correspondence/entities/correspondence-sub-type.entity';
import { DocumentNumberFormat } from '../document-numbering/entities/document-number-format.entity';

// Import DTOs
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { SearchTagDto } from './dto/search-tag.dto';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { CreateSubTypeDto } from './dto/create-sub-type.dto';
import { SaveNumberFormatDto } from './dto/save-number-format.dto';

@Injectable()
export class MasterService {
  constructor(
    @InjectRepository(CorrespondenceType)
    private readonly corrTypeRepo: Repository<CorrespondenceType>,
    @InjectRepository(CorrespondenceStatus)
    private readonly corrStatusRepo: Repository<CorrespondenceStatus>,
    @InjectRepository(RfaType)
    private readonly rfaTypeRepo: Repository<RfaType>,
    @InjectRepository(RfaStatusCode)
    private readonly rfaStatusRepo: Repository<RfaStatusCode>,
    @InjectRepository(RfaApproveCode)
    private readonly rfaApproveRepo: Repository<RfaApproveCode>,
    @InjectRepository(CirculationStatusCode)
    private readonly circulationStatusRepo: Repository<CirculationStatusCode>,
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,

    // [New] Repositories
    @InjectRepository(Discipline)
    private readonly disciplineRepo: Repository<Discipline>,
    @InjectRepository(CorrespondenceSubType)
    private readonly subTypeRepo: Repository<CorrespondenceSubType>,
    @InjectRepository(DocumentNumberFormat)
    private readonly formatRepo: Repository<DocumentNumberFormat>
  ) {}

  // ... (Method เดิม: findAllCorrespondenceTypes, findAllCorrespondenceStatuses, ฯลฯ เก็บไว้เหมือนเดิม) ...
  // หมายเหตุ: ตรวจสอบว่า Entity ใช้ชื่อ property ว่า isActive หรือ is_active (ใน SQL เป็น is_active แต่ใน Entity มักเป็น isActive)
  // โค้ดเดิมใช้ `where: { isActive: true }` ซึ่งถูกต้องถ้า Entity map column name แล้ว

  async findAllCorrespondenceTypes() {
    return this.corrTypeRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async createCorrespondenceType(dto: any) {
    const item = this.corrTypeRepo.create(dto);
    return this.corrTypeRepo.save(item);
  }

  async updateCorrespondenceType(id: number, dto: any) {
    const item = await this.corrTypeRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Correspondence Type not found');
    Object.assign(item, dto);
    return this.corrTypeRepo.save(item);
  }

  async deleteCorrespondenceType(id: number) {
    const result = await this.corrTypeRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('Correspondence Type not found');
    return { deleted: true };
  }
  async findAllCorrespondenceStatuses() {
    return this.corrStatusRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }
  async findAllRfaTypes(contractId?: number) {
    const where: any = { isActive: true };
    if (contractId) {
      where.contractId = contractId;
    }
    return this.rfaTypeRepo.find({
      where,
      order: { typeCode: 'ASC' },
      relations: contractId ? [] : [], // Add relations if needed later
    });
  }

  async createRfaType(dto: any) {
    // Validate unique code if needed
    const rfaType = this.rfaTypeRepo.create(dto);
    return this.rfaTypeRepo.save(rfaType);
  }

  async updateRfaType(id: number, dto: any) {
    const rfaType = await this.rfaTypeRepo.findOne({ where: { id } });
    if (!rfaType) throw new NotFoundException('RFA Type not found');
    Object.assign(rfaType, dto);
    return this.rfaTypeRepo.save(rfaType);
  }

  async deleteRfaType(id: number) {
    const result = await this.rfaTypeRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('RFA Type not found');
    return { deleted: true };
  }
  async findAllRfaStatuses() {
    return this.rfaStatusRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }
  async findAllRfaApproveCodes() {
    return this.rfaApproveRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }
  async findAllCirculationStatuses() {
    return this.circulationStatusRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  // =================================================================
  // 🏗️ Disciplines Logic
  // =================================================================

  async findAllDisciplines(contractId?: number) {
    const query = this.disciplineRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.contract', 'c')
      .orderBy('d.disciplineCode', 'ASC');

    if (contractId) {
      query.where('d.contractId = :contractId', { contractId });
    }
    // เพิ่มเงื่อนไข Active หากต้องการ
    query.andWhere('d.isActive = :isActive', { isActive: true });

    return query.getMany();
  }

  async createDiscipline(dto: CreateDisciplineDto) {
    const exists = await this.disciplineRepo.findOne({
      where: { contractId: dto.contractId, disciplineCode: dto.disciplineCode },
    });
    if (exists)
      throw new ConflictException(
        'Discipline code already exists in this contract'
      );

    const discipline = this.disciplineRepo.create(dto);
    return this.disciplineRepo.save(discipline);
  }

  async deleteDiscipline(id: number) {
    const result = await this.disciplineRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Discipline ID ${id} not found`);
    return { deleted: true };
  }

  // =================================================================
  // 📑 Sub-Types Logic
  // =================================================================

  async findAllSubTypes(contractId?: number, typeId?: number) {
    const query = this.subTypeRepo
      .createQueryBuilder('st')
      .leftJoinAndSelect('st.contract', 'c')
      .leftJoinAndSelect('st.correspondenceType', 'ct')
      .orderBy('st.subTypeCode', 'ASC');

    if (contractId)
      query.andWhere('st.contractId = :contractId', { contractId });
    if (typeId) query.andWhere('st.correspondenceTypeId = :typeId', { typeId });

    return query.getMany();
  }

  async createSubType(dto: CreateSubTypeDto) {
    // อาจจะเช็ค Duplicate code ด้วย logic คล้าย discipline
    const subType = this.subTypeRepo.create(dto);
    return this.subTypeRepo.save(subType);
  }

  async deleteSubType(id: number) {
    const result = await this.subTypeRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Sub-type ID ${id} not found`);
    return { deleted: true };
  }

  // =================================================================
  // 🔢 Numbering Formats Logic
  // =================================================================

  async findNumberFormat(projectId: number, typeId: number) {
    const format = await this.formatRepo.findOne({
      where: { projectId, correspondenceTypeId: typeId },
    });
    if (!format) {
      // Optional: Return default format structure or null
      return null;
    }
    return format;
  }

  async saveNumberFormat(dto: SaveNumberFormatDto) {
    // Check if exists (Upsert)
    let format = await this.formatRepo.findOne({
      where: {
        projectId: dto.projectId,
        correspondenceTypeId: dto.correspondenceTypeId,
      },
    });

    if (format) {
      format.formatTemplate = dto.formatTemplate;
      // format.updatedBy = ... (ถ้ามี)
    } else {
      format = this.formatRepo.create({
        projectId: dto.projectId,
        correspondenceTypeId: dto.correspondenceTypeId,
        formatTemplate: dto.formatTemplate,
      });
    }

    return this.formatRepo.save(format);
  }

  // ... (Tag Logic เดิม คงไว้ตามปกติ) ...
  async findAllTags(query?: SearchTagDto) {
    const qb = this.tagRepo.createQueryBuilder('tag');

    if (query?.project_id) {
      qb.andWhere('tag.project_id = :projectId', {
        projectId: query.project_id,
      });
    }

    if (query?.search) {
      qb.andWhere(
        '(tag.tag_name LIKE :search OR tag.description LIKE :search)',
        {
          search: `%${query.search}%`,
        }
      );
    }
    qb.orderBy('tag.tag_name', 'ASC');
    if (query?.page && query?.limit) {
      const page = query.page;
      const limit = query.limit;
      qb.skip((page - 1) * limit).take(limit);
      const [items, total] = await qb.getManyAndCount();
      return {
        data: items,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }
    return qb.getMany();
  }

  async findOneTag(id: number) {
    const tag = await this.tagRepo.findOne({ where: { id } });
    if (!tag) throw new NotFoundException(`Tag with ID "${id}" not found`);
    return tag;
  }

  async createTag(dto: CreateTagDto, userId: number) {
    const tag = this.tagRepo.create({
      ...dto,
      created_by: userId,
    });
    return this.tagRepo.save(tag);
  }

  async updateTag(id: number, dto: UpdateTagDto) {
    const tag = await this.findOneTag(id);
    Object.assign(tag, dto);
    return this.tagRepo.save(tag);
  }

  async deleteTag(id: number) {
    const tag = await this.findOneTag(id);
    return this.tagRepo.remove(tag);
  }
}
