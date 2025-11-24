// File: src/modules/master/master.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Import Entities จาก Module อื่นๆ (ตามโครงสร้างที่มีอยู่แล้ว)
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { RfaType } from '../rfa/entities/rfa-type.entity';
import { RfaStatusCode } from '../rfa/entities/rfa-status-code.entity';
import { RfaApproveCode } from '../rfa/entities/rfa-approve-code.entity';
import { CirculationStatusCode } from '../circulation/entities/circulation-status-code.entity';
import { Tag } from './entities/tag.entity'; // Entity ของ Module นี้เอง

import { CreateTagDto } from './dto/create-tag.dto';

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

  // --- Correspondence ---
  findAllCorrespondenceTypes() {
    return this.corrTypeRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC' },
    });
  }

  findAllCorrespondenceStatuses() {
    return this.corrStatusRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC' },
    });
  }

  // --- RFA ---
  findAllRfaTypes() {
    return this.rfaTypeRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC' },
    });
  }

  findAllRfaStatuses() {
    return this.rfaStatusRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC' },
    });
  }

  findAllRfaApproveCodes() {
    return this.rfaApproveRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC' },
    });
  }

  // --- Circulation ---
  findAllCirculationStatuses() {
    return this.circulationStatusRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC' },
    });
  }

  // --- Tags ---
  findAllTags() {
    return this.tagRepo.find({ order: { tag_name: 'ASC' } });
  }

  async createTag(dto: CreateTagDto) {
    const tag = this.tagRepo.create(dto);
    return this.tagRepo.save(tag);
  }
}
