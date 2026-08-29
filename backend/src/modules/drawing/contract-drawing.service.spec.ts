// File: src/modules/drawing/contract-drawing.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ ContractDrawingService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Brackets } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ContractDrawingService } from './contract-drawing.service';
import { ContractDrawing } from './entities/contract-drawing.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { Contract } from '../contract/entities/contract.entity';
import { User } from '../user/entities/user.entity';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { CreateContractDrawingDto } from './dto/create-contract-drawing.dto';
import { SearchContractDrawingDto } from './dto/search-contract-drawing.dto';
import { UpdateContractDrawingDto } from './dto/update-contract-drawing.dto';

describe('ContractDrawingService', () => {
  let service: ContractDrawingService;

  const mockDrawingRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };
  const mockAttachmentRepo = {
    findBy: jest.fn(),
  };
  const mockContractRepo = {
    findOne: jest.fn(),
  };
  const mockFileStorageService = {
    commit: jest.fn().mockResolvedValue(undefined),
  };
  const mockUuidResolver = {
    resolveProjectId: jest.fn().mockResolvedValue(1),
  };

  const mockManager = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: mockManager,
  };
  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  const mockUser: Partial<User> = { user_id: 42 };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractDrawingService,
        {
          provide: getRepositoryToken(ContractDrawing),
          useValue: mockDrawingRepo,
        },
        {
          provide: getRepositoryToken(Attachment),
          useValue: mockAttachmentRepo,
        },
        {
          provide: getRepositoryToken(Contract),
          useValue: mockContractRepo,
        },
        { provide: FileStorageService, useValue: mockFileStorageService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: UuidResolverService, useValue: mockUuidResolver },
      ],
    }).compile();

    service = module.get<ContractDrawingService>(ContractDrawingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: CreateContractDrawingDto = {
      projectId: 1,
      contractDrawingNo: 'CD-001',
      title: 'Test Drawing',
    };

    it('ควรสร้าง contract drawing ใหม่ได้', async () => {
      mockDrawingRepo.findOne.mockResolvedValue(null);
      mockContractRepo.findOne.mockResolvedValue({
        startDate: new Date('2026-01-01'),
      });
      const savedDrawing = { id: 10, contractDrawingNo: 'CD-001' };
      mockManager.create.mockReturnValue(savedDrawing);
      mockManager.save.mockResolvedValue(savedDrawing);

      const result = await service.create(dto, mockUser as User);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toEqual(savedDrawing);
    });

    it('ควร throw ConflictException เมื่อ contractDrawingNo ซ้ำ', async () => {
      mockDrawingRepo.findOne.mockResolvedValue({ id: 1 });

      await expect(service.create(dto, mockUser as User)).rejects.toThrow(
        ConflictException
      );
    });

    it('ควร commit attachments เมื่อมี attachmentIds', async () => {
      const dtoWithAttachments: CreateContractDrawingDto = {
        ...dto,
        attachmentIds: [1, 2],
      };
      mockDrawingRepo.findOne.mockResolvedValue(null);
      mockAttachmentRepo.findBy.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockContractRepo.findOne.mockResolvedValue({
        startDate: new Date('2026-01-01'),
      });
      const savedDrawing = { id: 10 };
      mockManager.create.mockReturnValue(savedDrawing);
      mockManager.save.mockResolvedValue(savedDrawing);

      await service.create(dtoWithAttachments, mockUser as User);

      expect(mockFileStorageService.commit).toHaveBeenCalledWith(
        ['1', '2'],
        expect.objectContaining({ documentType: 'ContractDrawing' })
      );
    });

    it('ควร rollback เมื่อเกิด error', async () => {
      mockDrawingRepo.findOne.mockResolvedValue(null);
      mockManager.create.mockReturnValue({});
      mockManager.save.mockRejectedValue(new Error('DB error'));

      await expect(service.create(dto, mockUser as User)).rejects.toThrow(
        'DB error'
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('ควรใช้ current date เป็น fallback เมื่อไม่พบ contract', async () => {
      const dtoWithAttachments: CreateContractDrawingDto = {
        ...dto,
        attachmentIds: [1],
      };
      mockDrawingRepo.findOne.mockResolvedValue(null);
      mockAttachmentRepo.findBy.mockResolvedValue([{ id: 1 }]);
      mockContractRepo.findOne.mockResolvedValue(null);
      const savedDrawing = { id: 10 };
      mockManager.create.mockReturnValue(savedDrawing);
      mockManager.save.mockResolvedValue(savedDrawing);

      await service.create(dtoWithAttachments, mockUser as User);

      expect(mockFileStorageService.commit).toHaveBeenCalledWith(
        ['1'],
        expect.objectContaining({
          documentType: 'ContractDrawing',
          issueDate: expect.any(Date),
        })
      );
    });
  });

  describe('findAll', () => {
    const mockQB = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };

    it('ควรคืน paginated contract drawings', async () => {
      mockQB.getManyAndCount.mockResolvedValue([[{ id: 1 }], 1]);
      mockDrawingRepo.createQueryBuilder.mockReturnValue(mockQB);

      const searchDto: SearchContractDrawingDto = {
        projectUuid: 'uuid-001',
        projectId: 1,
      };

      const result = await service.findAll(searchDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('ควรกรองด้วย volumeId, mapCatId และ search', async () => {
      mockQB.getManyAndCount.mockResolvedValue([[], 0]);
      mockDrawingRepo.createQueryBuilder.mockReturnValue(mockQB);

      const searchDto: SearchContractDrawingDto = {
        projectUuid: 'uuid-001',
        projectId: 1,
        volumeId: 5,
        mapCatId: 10,
        search: 'CD',
      };

      await service.findAll(searchDto);

      expect(mockQB.andWhere).toHaveBeenCalledWith(
        'drawing.volumeId = :volumeId',
        { volumeId: 5 }
      );
      expect(mockQB.andWhere).toHaveBeenCalledWith(
        'drawing.mapCatId = :mapCatId',
        { mapCatId: 10 }
      );
      expect(mockQB.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
    });
  });

  describe('findOne', () => {
    it('ควรคืน contract drawing ตาม id', async () => {
      const drawing = { id: 1, contractDrawingNo: 'CD-001' };
      mockDrawingRepo.findOne.mockResolvedValue(drawing);

      const result = await service.findOne(1);

      expect(result).toEqual(drawing);
    });

    it('ควร throw NotFoundException เมื่อไม่พบ id', async () => {
      mockDrawingRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneByUuid', () => {
    it('ควรคืน contract drawing ตาม uuid', async () => {
      const drawing = { id: 1, publicId: 'uuid-001' };
      mockDrawingRepo.findOne.mockResolvedValue(drawing);

      const result = await service.findOneByUuid('uuid-001');

      expect(result).toEqual(drawing);
    });

    it('ควร throw NotFoundException เมื่อไม่พบ uuid', async () => {
      mockDrawingRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneByUuid('not-found')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('update', () => {
    it('ควรอัปเดต contract drawing ได้', async () => {
      const drawing = {
        id: 1,
        contractDrawingNo: 'CD-001',
        title: 'Old',
        projectId: 1,
      };
      mockDrawingRepo.findOne.mockResolvedValue(drawing);
      mockContractRepo.findOne.mockResolvedValue({
        startDate: new Date('2026-01-01'),
      });
      const updated = { ...drawing, title: 'New' };
      mockManager.save.mockResolvedValue(updated);

      const dto: UpdateContractDrawingDto = {
        contractDrawingNo: 'CD-002',
        title: 'New',
        volumeId: 5,
        volumePage: 10,
        mapCatId: 3,
      };

      const result = await service.update(1, dto, mockUser as User);

      expect(result.title).toBe('New');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('ควรอัปเดตได้แม้ไม่มีฟิลด์ให้ update (ยกเว้น attachments)', async () => {
      const drawing = { id: 1, projectId: 1, title: 'Old' };
      mockDrawingRepo.findOne.mockResolvedValue(drawing);
      mockManager.save.mockResolvedValue(drawing);

      const dto: UpdateContractDrawingDto = {};

      const result = await service.update(1, dto, mockUser as User);

      expect(result).toEqual(drawing);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('ควรอัปเดต attachments เมื่อมี attachmentIds', async () => {
      const drawing = {
        id: 1,
        contractDrawingNo: 'CD-001',
        title: 'Old',
        projectId: 1,
        attachments: [],
      };
      mockDrawingRepo.findOne.mockResolvedValue(drawing);
      mockAttachmentRepo.findBy.mockResolvedValue([{ id: 5 }]);
      mockContractRepo.findOne.mockResolvedValue({
        startDate: new Date('2026-01-01'),
      });
      mockManager.save.mockResolvedValue(drawing);

      const dto: UpdateContractDrawingDto = {
        attachmentIds: [5],
      };

      await service.update(1, dto, mockUser as User);

      expect(mockFileStorageService.commit).toHaveBeenCalledWith(
        ['5'],
        expect.objectContaining({ documentType: 'ContractDrawing' })
      );
    });

    it('ควร rollback เมื่อเกิด error', async () => {
      const drawing = { id: 1, projectId: 1 };
      mockDrawingRepo.findOne.mockResolvedValue(drawing);
      mockManager.save.mockRejectedValue(new Error('DB error'));

      const dto: UpdateContractDrawingDto = { title: 'New' };

      await expect(service.update(1, dto, mockUser as User)).rejects.toThrow(
        'DB error'
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('ควร soft remove contract drawing', async () => {
      const drawing = { id: 1, updatedBy: 0 };
      mockDrawingRepo.findOne.mockResolvedValue(drawing);
      mockDrawingRepo.save.mockResolvedValue(drawing);
      mockDrawingRepo.softRemove.mockResolvedValue(drawing);

      await service.remove(1, mockUser as User);

      expect(mockDrawingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: 42 })
      );
      expect(mockDrawingRepo.softRemove).toHaveBeenCalledWith(drawing);
    });
  });
});
