import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, FindManyOptions } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { CreateContractDto } from './dto/create-contract.dto.js';
import { UpdateContractDto } from './dto/update-contract.dto.js';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';

@Injectable()
export class ContractService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
    private readonly uuidResolver: UuidResolverService
  ) {}

  async create(dto: CreateContractDto) {
    const internalProjectId = await this.uuidResolver.resolveProjectId(
      dto.projectId
    );

    const existing = await this.contractRepo.findOne({
      where: { contractCode: dto.contractCode },
    });
    if (existing) {
      throw new ConflictException(
        `Contract Code "${dto.contractCode}" already exists`
      );
    }
    const contract = this.contractRepo.create({
      ...dto,
      projectId: internalProjectId,
    });
    return this.contractRepo.save(contract);
  }

  async findAll(params?: {
    search?: string;
    projectId?: number | string;
    page?: number;
    limit?: number;
  }) {
    const { search, projectId, page = 1, limit = 100 } = params || {};
    const skip = (page - 1) * limit;

    let internalProjectId: number | undefined = undefined;
    if (projectId) {
      internalProjectId = await this.uuidResolver.resolveProjectId(projectId);
    }

    const findOptions: FindManyOptions<Contract> = {
      relations: ['project'],
      order: { contractCode: 'ASC' },
      skip,
      take: limit,
    };

    const searchConditions: FindOptionsWhere<Contract>[] = [];
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
    } else if (searchConditions.length > 0) {
      findOptions.where = searchConditions;
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
      where: { publicId: uuid },
      relations: ['project'],
    });
    if (!contract)
      throw new NotFoundException(`Contract with UUID ${uuid} not found`);
    return contract;
  }

  async update(publicId: string, dto: UpdateContractDto) {
    const contract = await this.findOneByUuid(publicId);
    if (dto.projectId) {
      dto.projectId = await this.uuidResolver.resolveProjectId(dto.projectId);
    }
    Object.assign(contract, dto);
    return this.contractRepo.save(contract);
  }

  async remove(publicId: string) {
    const contract = await this.findOneByUuid(publicId);
    return this.contractRepo.remove(contract);
  }
}
