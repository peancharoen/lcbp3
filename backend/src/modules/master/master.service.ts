// File: src/modules/master/master.service.ts

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';

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
import { Project } from '../project/entities/project.entity';
import { Contract } from '../contract/entities/contract.entity';

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
    private readonly formatRepo: Repository<DocumentNumberFormat>,

    @InjectEntityManager()
    private readonly entityManager: EntityManager
  ) {}

  /**
   * Helper to resolve projectId (ID or UUID) to internal INT ID
   */
  async resolveProjectId(projectId: number | string): Promise<number> {
    if (typeof projectId === 'number') return projectId;
    const num = Number(projectId);
    if (!isNaN(num)) return num;
    const project = await this.entityManager.findOne(Project, {
      where: { uuid: projectId as string },
      select: ['id'],
    });
    if (!project)
      throw new NotFoundException(`Project with UUID ${projectId} not found`);
    return project.id;
  }

  /**
   * Helper to resolve contractId (ID or UUID) to internal INT ID
   */
  async resolveContractId(contractId: number | string): Promise<number> {
    if (typeof contractId === 'number') return contractId;
    const num = Number(contractId);
    if (!isNaN(num)) return num;
    const contract = await this.entityManager.findOne(Contract, {
      where: { uuid: contractId as string },
      select: ['id'],
    });
    if (!contract)
      throw new NotFoundException(`Contract with UUID ${contractId} not found`);
    return contract.id;
  }

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
  async findAllRfaTypes(contractId?: number | string) {
    const where: any = { isActive: true };
    if (contractId) {
      where.contractId = await this.resolveContractId(contractId);
    }
    return this.rfaTypeRepo.find({
      where,
      relations: ['contract'],
      order: { typeCode: 'ASC' },
    });
  }

  async createRfaType(dto: any) {
    const internalContractId = await this.resolveContractId(dto.contractId);
    const rfaType = this.rfaTypeRepo.create({
      ...dto,
      contractId: internalContractId,
    });
    return this.rfaTypeRepo.save(rfaType);
  }

  async updateRfaType(id: number, dto: any) {
    const rfaType = await this.rfaTypeRepo.findOne({ where: { id } });
    if (!rfaType) throw new NotFoundException('RFA Type not found');
    if (dto.contractId) {
      dto.contractId = await this.resolveContractId(dto.contractId);
    }
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

  async findAllDisciplines(contractId?: number | string) {
    const query = this.disciplineRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.contract', 'c')
      .orderBy('d.disciplineCode', 'ASC');

    if (contractId) {
      const internalId = await this.resolveContractId(contractId);
      query.where('d.contractId = :contractId', { contractId: internalId });
    }
    query.andWhere('d.isActive = :isActive', { isActive: true });

    return query.getMany();
  }

  async createDiscipline(dto: any) {
    const internalContractId = await this.resolveContractId(dto.contractId);
    const exists = await this.disciplineRepo.findOne({
      where: {
        contractId: internalContractId,
        disciplineCode: dto.disciplineCode,
      },
    });
    if (exists)
      throw new ConflictException(
        'Discipline code already exists in this contract'
      );

    const discipline = this.disciplineRepo.create({
      ...dto,
      contractId: internalContractId,
    });
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

  async findAllSubTypes(contractId?: number | string, typeId?: number) {
    const query = this.subTypeRepo
      .createQueryBuilder('st')
      .leftJoinAndSelect('st.contract', 'c')
      .leftJoinAndSelect('st.correspondenceType', 'ct')
      .orderBy('st.subTypeCode', 'ASC');

    if (contractId) {
      const internalId = await this.resolveContractId(contractId);
      query.andWhere('st.contractId = :contractId', { contractId: internalId });
    }
    if (typeId) query.andWhere('st.correspondenceTypeId = :typeId', { typeId });

    return query.getMany();
  }

  async createSubType(dto: any) {
    const internalContractId = await this.resolveContractId(dto.contractId);
    const subType = this.subTypeRepo.create({
      ...dto,
      contractId: internalContractId,
    });
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

  async findNumberFormat(projectId: number | string, typeId: number) {
    const internalId = await this.resolveProjectId(projectId);
    const format = await this.formatRepo.findOne({
      where: { projectId: internalId, correspondenceTypeId: typeId },
    });
    return format || null;
  }

  async saveNumberFormat(dto: any) {
    const internalProjectId = await this.resolveProjectId(dto.projectId);
    let format: DocumentNumberFormat | null = await this.formatRepo.findOne({
      where: {
        projectId: internalProjectId,
        correspondenceTypeId: dto.correspondenceTypeId,
      },
    });

    if (format) {
      format.formatTemplate = dto.formatTemplate;
    } else {
      format = this.formatRepo.create({
        ...dto,
        projectId: internalProjectId,
      } as Partial<DocumentNumberFormat>);
    }

    return this.formatRepo.save(format!);
  }

  async findAllTags(query?: SearchTagDto) {
    const qb = this.tagRepo
      .createQueryBuilder('tag')
      .leftJoinAndSelect('tag.project', 'project');

    if (query?.project_id) {
      // In Tags, we use project_id (INT) directly or resolve if UUID passed via query
      const internalId = await this.resolveProjectId(query.project_id);
      qb.andWhere('tag.project_id = :projectId', {
        projectId: internalId,
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

  async createTag(dto: any, userId: number) {
    const internalProjectId = dto.project_id
      ? await this.resolveProjectId(dto.project_id)
      : null;
    const tag = this.tagRepo.create({
      ...dto,
      project_id: internalProjectId,
      created_by: userId,
    });
    return this.tagRepo.save(tag);
  }

  async updateTag(id: number, dto: any) {
    const tag = await this.findOneTag(id);
    if (dto.project_id) {
      dto.project_id = await this.resolveProjectId(dto.project_id);
    }
    Object.assign(tag, dto);
    return this.tagRepo.save(tag);
  }

  async deleteTag(id: number) {
    const tag = await this.findOneTag(id);
    return this.tagRepo.remove(tag);
  }
}
