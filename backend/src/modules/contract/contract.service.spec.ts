// File: src/modules/contract/contract.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ ContractService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ContractService } from './contract.service';
import { Contract } from './entities/contract.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';

describe('ContractService', () => {
  let service: ContractService;

  const mockContractRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };

  const mockUuidResolver = {
    resolveProjectId: jest.fn().mockResolvedValue(1),
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
          provide: UuidResolverService,
          useValue: mockUuidResolver,
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
});
