import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, FindManyOptions } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { ContractOrganization } from './entities/contract-organization.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { OrganizationService } from '../organization/organization.service';
import { LinkOrganizationDto } from '../organization/dto/link-organization.dto';
import { UpdateLinkedOrganizationRoleDto } from '../organization/dto/update-linked-organization-role.dto';

@Injectable()
export class ContractService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
    @InjectRepository(ContractOrganization)
    private readonly contractOrgRepo: Repository<ContractOrganization>,
    private readonly uuidResolver: UuidResolverService,
    private readonly organizationService: OrganizationService
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

  // --- Contract ↔ Organization Links (role per context — PR #29) ---

  /** แปลง junction row เป็น API shape — expose เฉพาะ publicId ไม่รั่ว internal id (ADR-019) */
  private toLinkedOrganization(link: ContractOrganization) {
    return {
      organizationId: link.organization?.publicId ?? null,
      organizationCode: link.organization?.organizationCode ?? null,
      organizationName: link.organization?.organizationName ?? null,
      roleName: link.organizationRole?.roleName ?? null,
    };
  }

  /** ดึงองค์กรทั้งหมดที่ผูกกับ contract พร้อม role ใน context นั้น */
  async listOrganizations(publicId: string) {
    const contract = await this.findOneByUuid(publicId);
    const links = await this.contractOrgRepo.find({
      where: { contractId: contract.id },
      relations: ['organization', 'organizationRole'],
    });
    return links.map((link) => this.toLinkedOrganization(link));
  }

  /** ผูกองค์กรเข้า contract พร้อม role — PK (contract_id, organization_id) กันซ้ำที่ DB ด้วย */
  async linkOrganization(publicId: string, dto: LinkOrganizationDto) {
    const contract = await this.findOneByUuid(publicId);
    const organizationId = await this.uuidResolver.resolveOrganizationId(
      dto.organizationId
    );
    const roleId = await this.organizationService.resolveRoleId(dto.roleName);

    const existing = await this.contractOrgRepo.findOne({
      where: { contractId: contract.id, organizationId },
    });
    if (existing) {
      throw new ConflictException(
        'Organization is already linked to this contract'
      );
    }

    const link = this.contractOrgRepo.create({
      contractId: contract.id,
      organizationId,
      roleId,
    });
    await this.contractOrgRepo.save(link);

    const saved = await this.contractOrgRepo.findOneOrFail({
      where: { contractId: contract.id, organizationId },
      relations: ['organization', 'organizationRole'],
    });
    return this.toLinkedOrganization(saved);
  }

  /** เปลี่ยน role ขององค์กรที่ผูกอยู่แล้ว — role มีความหมายเฉพาะ context นี้ */
  async updateOrganizationRole(
    publicId: string,
    orgUuid: string,
    dto: UpdateLinkedOrganizationRoleDto
  ) {
    const contract = await this.findOneByUuid(publicId);
    const organizationId =
      await this.uuidResolver.resolveOrganizationId(orgUuid);

    const link = await this.contractOrgRepo.findOne({
      where: { contractId: contract.id, organizationId },
      relations: ['organization', 'organizationRole'],
    });
    if (!link) {
      throw new NotFoundException(
        'Organization is not linked to this contract'
      );
    }

    link.roleId = await this.organizationService.resolveRoleId(dto.roleName);
    await this.contractOrgRepo.save(link);
    return this.toLinkedOrganization(link);
  }

  /** ถอดองค์กรออกจาก contract — junction เป็น pure link table ลบจริงได้ (ไม่มี deleted_at) */
  async unlinkOrganization(publicId: string, orgUuid: string) {
    const contract = await this.findOneByUuid(publicId);
    const organizationId =
      await this.uuidResolver.resolveOrganizationId(orgUuid);

    const result = await this.contractOrgRepo.delete({
      contractId: contract.id,
      organizationId,
    });
    if (!result.affected) {
      throw new NotFoundException(
        'Organization is not linked to this contract'
      );
    }
    return { deleted: true };
  }
}
