import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity.js';
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

  async findAll(projectId?: number) {
    const query = this.contractRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.project', 'p')
      .orderBy('c.contractCode', 'ASC');

    if (projectId) {
      query.where('c.projectId = :projectId', { projectId });
    }

    return query.getMany();
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
