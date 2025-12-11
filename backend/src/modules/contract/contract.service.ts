import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { CreateContractDto } from './dto/create-contract.dto.js';
import { UpdateContractDto } from './dto/update-contract.dto.js';

@Injectable()
export class ContractService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>
  ) {}

  async create(dto: CreateContractDto) {
    const existing = await this.contractRepo.findOne({
      where: { contractCode: dto.contractCode },
    });
    if (existing) {
      throw new ConflictException(
        `Contract Code "${dto.contractCode}" already exists`
      );
    }
    const contract = this.contractRepo.create(dto);
    return this.contractRepo.save(contract);
  }

  async findAll(params?: any) {
    const { search, projectId, page = 1, limit = 100 } = params || {};
    const skip = (page - 1) * limit;

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

    if (projectId) {
      // Combine project filter with search if exists
      if (searchConditions.length > 0) {
        findOptions.where = searchConditions.map((cond) => ({
          ...cond,
          projectId,
        }));
      } else {
        findOptions.where = { projectId };
      }
    } else {
      if (searchConditions.length > 0) {
        findOptions.where = searchConditions;
      } else {
        delete findOptions.where; // No filters
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

  async update(id: number, dto: UpdateContractDto) {
    const contract = await this.findOne(id);
    Object.assign(contract, dto);
    return this.contractRepo.save(contract);
  }

  async remove(id: number) {
    const contract = await this.findOne(id);
    // Schema doesn't have deleted_at for Contract either.
    return this.contractRepo.remove(contract);
  }
}
