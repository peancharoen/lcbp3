// File: src/modules/contract/contract.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ ContractService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ContractService } from './contract.service';
import { Contract } from './entities/contract.entity';
import { ContractOrganization } from './entities/contract-organization.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { OrganizationService } from '../organization/organization.service';

describe('ContractService', () => {
  let service: ContractService;

  const mockContractRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };

  const mockContractOrgRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockUuidResolver = {
    resolveProjectId: jest.fn().mockResolvedValue(1),
    resolveOrganizationId: jest.fn(),
  };

  const mockOrgService = {
    resolveRoleId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractService,
        {
          provide: getRepositoryToken(Contract),
          useValue: mockContractRepo,
        },
        {
          provide: getRepositoryToken(ContractOrganization),
          useValue: mockContractOrgRepo,
        },
        {
          provide: UuidResolverService,
          useValue: mockUuidResolver,
        },
        {
          provide: OrganizationService,
          useValue: mockOrgService,
        },
      ],
    }).compile();

    service = module.get<ContractService>(ContractService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('ควรสร้าง contract ใหม่ได้', async () => {
      const dto: CreateContractDto = {
        projectId: 'uuid-proj-1',
        contractCode: 'C001',
        contractName: 'Main Contract',
      };
      mockContractRepo.findOne.mockResolvedValue(null);
      const created: Partial<Contract> = {
        projectId: 1,
        contractCode: 'C001',
        contractName: 'Main Contract',
      };
      mockContractRepo.create.mockReturnValue(created);
      mockContractRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(mockUuidResolver.resolveProjectId).toHaveBeenCalledWith(
        'uuid-proj-1'
      );
      expect(mockContractRepo.create).toHaveBeenCalledWith({
        ...dto,
        projectId: 1,
      });
      expect(result).toEqual(created);
    });

    it('ควร throw ConflictException เมื่อ contractCode ซ้ำ', async () => {
      const dto: CreateContractDto = {
        projectId: 'uuid-proj-1',
        contractCode: 'C001',
        contractName: 'Main Contract',
      };
      mockContractRepo.findOne.mockResolvedValue({ id: 1 });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockContractRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('ควรคืน paginated contracts โดยไม่มี filter', async () => {
      const mockData: Partial<Contract>[] = [{ id: 1, contractCode: 'C001' }];
      mockContractRepo.findAndCount.mockResolvedValue([mockData, 1]);

      const result = await service.findAll();

      expect(result.data).toEqual(mockData);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(100);
    });

    it('ควรค้นหาด้วย search text', async () => {
      mockContractRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'C001' });

      const callArgs = (
        mockContractRepo.findAndCount.mock.calls[0] as unknown[]
      )[0] as {
        where: Array<Record<string, unknown>>;
        skip: number;
        take: number;
      };
      expect(callArgs.where).toHaveLength(2);
    });

    it('ควรกรองด้วย projectId', async () => {
      mockContractRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ projectId: 'uuid-proj-1' });

      expect(mockUuidResolver.resolveProjectId).toHaveBeenCalledWith(
        'uuid-proj-1'
      );
      const callArgs = (
        mockContractRepo.findAndCount.mock.calls[0] as unknown[]
      )[0] as {
        where: Record<string, unknown>;
        skip: number;
        take: number;
      };
      expect(callArgs.where).toEqual({ projectId: 1 });
    });

    it('ควรกรองด้วย projectId และ search พร้อมกัน', async () => {
      mockContractRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ projectId: 'uuid-proj-1', search: 'C001' });

      const callArgs = (
        mockContractRepo.findAndCount.mock.calls[0] as unknown[]
      )[0] as {
        where: Array<Record<string, unknown>>;
        skip: number;
        take: number;
      };
      expect(callArgs.where).toHaveLength(2);
      expect(callArgs.where[0].projectId).toBe(1);
    });

    it('ควรใช้ page และ limit ที่กำหนด', async () => {
      mockContractRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 2, limit: 50 });

      const callArgs = (
        mockContractRepo.findAndCount.mock.calls[0] as unknown[]
      )[0] as {
        where: unknown;
        skip: number;
        take: number;
      };
      expect(callArgs.skip).toBe(50);
      expect(callArgs.take).toBe(50);
    });
  });

  describe('findOne', () => {
    it('ควรคืน contract ตาม id', async () => {
      const contract: Partial<Contract> = {
        id: 1,
        contractCode: 'C001',
      };
      mockContractRepo.findOne.mockResolvedValue(contract);

      const result = await service.findOne(1);

      expect(result).toEqual(contract);
      expect(mockContractRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['project'],
      });
    });

    it('ควร throw NotFoundException เมื่อไม่พบ id', async () => {
      mockContractRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneByUuid', () => {
    it('ควรคืน contract ตาม uuid', async () => {
      const contract: Partial<Contract> = {
        id: 1,
        publicId: 'uuid-001',
      };
      mockContractRepo.findOne.mockResolvedValue(contract);

      const result = await service.findOneByUuid('uuid-001');

      expect(result).toEqual(contract);
      expect(mockContractRepo.findOne).toHaveBeenCalledWith({
        where: { publicId: 'uuid-001' },
        relations: ['project'],
      });
    });

    it('ควร throw NotFoundException เมื่อไม่พบ uuid', async () => {
      mockContractRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneByUuid('not-found')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('update', () => {
    it('ควรอัปเดต contract ตาม uuid', async () => {
      const contract: Partial<Contract> = {
        id: 1,
        publicId: 'uuid-001',
        contractName: 'Old Name',
      };
      mockContractRepo.findOne.mockResolvedValue(contract);
      mockContractRepo.save.mockResolvedValue({
        ...contract,
        contractName: 'New Name',
      });

      const dto: UpdateContractDto = { contractName: 'New Name' };

      const result = await service.update('uuid-001', dto);

      expect(result.contractName).toBe('New Name');
      expect(mockContractRepo.save).toHaveBeenCalled();
    });

    it('ควร resolve projectId เมื่อมีใน dto', async () => {
      const contract: Partial<Contract> = {
        id: 1,
        publicId: 'uuid-001',
      };
      mockContractRepo.findOne.mockResolvedValue(contract);
      mockContractRepo.save.mockResolvedValue(contract);

      const dto: UpdateContractDto = {
        projectId: 'uuid-proj-2' as unknown as number,
      };

      await service.update('uuid-001', dto);

      expect(mockUuidResolver.resolveProjectId).toHaveBeenCalledWith(
        'uuid-proj-2'
      );
    });
  });

  describe('remove', () => {
    it('ควรลบ contract ตาม uuid', async () => {
      const contract: Partial<Contract> = {
        id: 1,
        publicId: 'uuid-001',
      };
      mockContractRepo.findOne.mockResolvedValue(contract);
      mockContractRepo.remove.mockResolvedValue(contract);

      const result = await service.remove('uuid-001');

      expect(mockContractRepo.remove).toHaveBeenCalledWith(contract);
      expect(result).toEqual(contract);
    });
  });

  // ---- Organization Links (role per context) ----

  const mockContract = { id: 3, publicId: 'contract-uuid' };
  const mockLink = {
    contractId: 3,
    organizationId: 10,
    roleId: 4,
    organization: {
      publicId: 'org-uuid',
      organizationCode: 'ORG-A',
      organizationName: 'Org A',
    },
    organizationRole: { roleName: 'CONTRACTOR' },
  };

  describe('listOrganizations', () => {
    it('ควรคืน org ที่ผูกอยู่ในรูป public shape', async () => {
      mockContractRepo.findOne.mockResolvedValue(mockContract);
      mockContractOrgRepo.find.mockResolvedValue([mockLink]);

      const result = await service.listOrganizations('contract-uuid');

      expect(mockContractOrgRepo.find).toHaveBeenCalledWith({
        where: { contractId: 3 },
        relations: ['organization', 'organizationRole'],
      });
      expect(result).toEqual([
        {
          organizationId: 'org-uuid',
          organizationCode: 'ORG-A',
          organizationName: 'Org A',
          roleName: 'CONTRACTOR',
        },
      ]);
    });
  });

  describe('linkOrganization', () => {
    it('ควรสร้าง junction row พร้อม role ที่ resolve แล้ว', async () => {
      mockContractRepo.findOne.mockResolvedValue(mockContract);
      mockUuidResolver.resolveOrganizationId.mockResolvedValue(10);
      mockOrgService.resolveRoleId.mockResolvedValue(4);
      mockContractOrgRepo.findOne.mockResolvedValue(null);
      mockContractOrgRepo.create.mockReturnValue({
        contractId: 3,
        organizationId: 10,
        roleId: 4,
      });
      mockContractOrgRepo.save.mockResolvedValue({});
      mockContractOrgRepo.findOneOrFail.mockResolvedValue(mockLink);

      const result = await service.linkOrganization('contract-uuid', {
        organizationId: 'org-uuid',
        roleName: 'CONTRACTOR',
      });

      expect(mockContractOrgRepo.save).toHaveBeenCalledWith({
        contractId: 3,
        organizationId: 10,
        roleId: 4,
      });
      expect(result.roleName).toBe('CONTRACTOR');
    });

    it('ควร throw ConflictException เมื่อ org ถูกผูกอยู่แล้ว', async () => {
      mockContractRepo.findOne.mockResolvedValue(mockContract);
      mockUuidResolver.resolveOrganizationId.mockResolvedValue(10);
      mockOrgService.resolveRoleId.mockResolvedValue(4);
      mockContractOrgRepo.findOne.mockResolvedValue(mockLink);

      await expect(
        service.linkOrganization('contract-uuid', {
          organizationId: 'org-uuid',
          roleName: 'CONTRACTOR',
        })
      ).rejects.toThrow(ConflictException);
      expect(mockContractOrgRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('updateOrganizationRole', () => {
    it('ควรอัปเดต role บน link ที่มีอยู่ผ่าน update() ไม่ใช่ save() (save() จะเขียน relation เก่าทับ roleId)', async () => {
      mockContractRepo.findOne.mockResolvedValue(mockContract);
      mockUuidResolver.resolveOrganizationId.mockResolvedValue(10);
      mockContractOrgRepo.findOne.mockResolvedValue({ ...mockLink });
      mockOrgService.resolveRoleId.mockResolvedValue(2);
      mockContractOrgRepo.update.mockResolvedValue({ affected: 1 });
      mockContractOrgRepo.findOneOrFail.mockResolvedValue({
        ...mockLink,
        roleId: 2,
        organizationRole: { id: 2, roleName: 'DESIGNER' },
      });

      await service.updateOrganizationRole('contract-uuid', 'org-uuid', {
        roleName: 'DESIGNER',
      });

      expect(mockOrgService.resolveRoleId).toHaveBeenCalledWith('DESIGNER');
      expect(mockContractOrgRepo.update).toHaveBeenCalledWith(
        { contractId: mockContract.id, organizationId: 10 },
        { roleId: 2 }
      );
      expect(mockContractOrgRepo.save).not.toHaveBeenCalled();
    });

    it('ควร throw NotFoundException เมื่อยังไม่ได้ link', async () => {
      mockContractRepo.findOne.mockResolvedValue(mockContract);
      mockUuidResolver.resolveOrganizationId.mockResolvedValue(10);
      mockContractOrgRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateOrganizationRole('contract-uuid', 'org-uuid', {
          roleName: 'DESIGNER',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unlinkOrganization', () => {
    it('ควรลบ junction row', async () => {
      mockContractRepo.findOne.mockResolvedValue(mockContract);
      mockUuidResolver.resolveOrganizationId.mockResolvedValue(10);
      mockContractOrgRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.unlinkOrganization(
        'contract-uuid',
        'org-uuid'
      );

      expect(mockContractOrgRepo.delete).toHaveBeenCalledWith({
        contractId: 3,
        organizationId: 10,
      });
      expect(result).toEqual({ deleted: true });
    });

    it('ควร throw NotFoundException เมื่อไม่มีอะไรถูกลบ', async () => {
      mockContractRepo.findOne.mockResolvedValue(mockContract);
      mockUuidResolver.resolveOrganizationId.mockResolvedValue(10);
      mockContractOrgRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.unlinkOrganization('contract-uuid', 'org-uuid')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
