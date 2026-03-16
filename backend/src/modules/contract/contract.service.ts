import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { Repository, Like, EntityManager } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { CreateContractDto } from './dto/create-contract.dto.js';
import { UpdateContractDto } from './dto/update-contract.dto.js';
import { Project } from '../project/entities/project.entity';

@Injectable()
export class ContractService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
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

    if (!project) {
      throw new NotFoundException(`Project with UUID ${projectId} not found`);
    }

    return project.id;
  }

  async create(dto: CreateContractDto) {
    const internalProjectId = await this.resolveProjectId(dto.projectId);
    
    const existing = await this.contractRepo.findOne({
      where: { contractCode: dto.contractCode },
    });
    if (existing) {
      throw new ConflictException(
        `Contract Code "${dto.contractCode}" already exists`
      );
    }
    const contract = this.contractRepo.create({ ...dto, projectId: internalProjectId });
    return this.contractRepo.save(contract);
  }

  async findAll(params?: any) {
    const { search, projectId, page = 1, limit = 100 } = params || {};
    const skip = (page - 1) * limit;

    let internalProjectId = undefined;
    if (projectId) {
        internalProjectId = await this.resolveProjectId(projectId);
    }

    const findOptions: any = {
      relations: ['project'],
      order: { contractCode: 'ASC' },
      skip,
      take: limit,
      where: [],
    };

    const searchConditions = [];
    if (search) {
      searchConditions.push({ contractCode: Like(`%${search}%`) });
      searchConditions.push({ contractName: Like(`%${search}%`) });
    }

    if (internalProjectId) {
      if (searchConditions.length > 0) {
        findOptions.where = searchConditions.map((cond) => ({
          ...cond,
          projectId: internalProjectId,
        }));
      } else {
        findOptions.where = { projectId: internalProjectId };
      }
    } else {
      if (searchConditions.length > 0) {
        findOptions.where = searchConditions;
      } else {
        delete findOptions.where;
      }
    }

    const [data, total] = await this.contractRepo.findAndCount(findOptions);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: ['project'],
    });
    if (!contract) throw new NotFoundException(`Contract ID ${id} not found`);
    return contract;
  }

  async findOneByUuid(uuid: string) {
    const contract = await this.contractRepo.findOne({
      where: { uuid },
      relations: ['project'],
    });
    if (!contract)
      throw new NotFoundException(`Contract UUID ${uuid} not found`);
    return contract;
  }

  async update(uuid: string, dto: UpdateContractDto) {
    const contract = await this.findOneByUuid(uuid);
    if (dto.projectId) {
        dto.projectId = await this.resolveProjectId(dto.projectId);
    }
    Object.assign(contract, dto);
    return this.contractRepo.save(contract);
  }

  async remove(uuid: string) {
    const contract = await this.findOneByUuid(uuid);
    return this.contractRepo.remove(contract);
  }
}
