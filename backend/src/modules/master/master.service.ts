// File: src/modules/master/master.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
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

// Import DTOs
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { SearchTagDto } from './dto/search-tag.dto';

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
  ) {}

  // =================================================================
  // ✉️ Correspondence Master Data
  // =================================================================

  async findAllCorrespondenceTypes() {
    return this.corrTypeRepo.find({
      where: { isActive: true }, // ✅ แก้เป็น camelCase
      order: { sortOrder: 'ASC' }, // ✅ แก้เป็น camelCase
    });
  }

  async findAllCorrespondenceStatuses() {
    return this.corrStatusRepo.find({
      where: { isActive: true }, // ✅ แก้เป็น camelCase
      order: { sortOrder: 'ASC' }, // ✅ แก้เป็น camelCase
    });
  }

  // =================================================================
  // 📐 RFA Master Data
  // =================================================================

  async findAllRfaTypes() {
    return this.rfaTypeRepo.find({
      where: { isActive: true }, // ✅ แก้เป็น camelCase
      order: { sortOrder: 'ASC' }, // ✅ แก้เป็น camelCase
    });
  }

  async findAllRfaStatuses() {
    return this.rfaStatusRepo.find({
      where: { isActive: true }, // ✅ แก้เป็น camelCase
      order: { sortOrder: 'ASC' }, // ✅ แก้เป็น camelCase
    });
  }

  async findAllRfaApproveCodes() {
    return this.rfaApproveRepo.find({
      where: { isActive: true }, // ✅ แก้เป็น camelCase
      order: { sortOrder: 'ASC' }, // ✅ แก้เป็น camelCase
    });
  }

  // =================================================================
  // 🔄 Circulation Master Data
  // =================================================================

  async findAllCirculationStatuses() {
    return this.circulationStatusRepo.find({
      where: { isActive: true }, // ✅ แก้เป็น camelCase
      order: { sortOrder: 'ASC' }, // ✅ แก้เป็น camelCase
    });
  }

  // =================================================================
  // 🏷️ Tag Management (CRUD)
  // =================================================================

  async findAllTags(query?: SearchTagDto) {
    const qb = this.tagRepo.createQueryBuilder('tag');

    if (query?.search) {
      qb.where('tag.tag_name LIKE :search OR tag.description LIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('tag.tag_name', 'ASC');

    if (query?.page && query?.limit) {
      const page = query.page;
      const limit = query.limit;
      qb.skip((page - 1) * limit).take(limit);
    }

    if (query?.page && query?.limit) {
      const [items, total] = await qb.getManyAndCount();
      return {
        data: items,
        meta: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    }

    return qb.getMany();
  }

  async findOneTag(id: number) {
    const tag = await this.tagRepo.findOne({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`Tag with ID "${id}" not found`);
    }
    return tag;
  }

  async createTag(dto: CreateTagDto) {
    const tag = this.tagRepo.create(dto);
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
