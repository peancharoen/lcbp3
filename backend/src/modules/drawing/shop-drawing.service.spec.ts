// File: src/modules/drawing/shop-drawing.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ ShopDrawingService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ShopDrawingService } from './shop-drawing.service';
import { ShopDrawing } from './entities/shop-drawing.entity';
import { ShopDrawingRevision } from './entities/shop-drawing-revision.entity';
import { ContractDrawing } from './entities/contract-drawing.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { User } from '../user/entities/user.entity';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { CreateShopDrawingDto } from './dto/create-shop-drawing.dto';
import { CreateShopDrawingRevisionDto } from './dto/create-shop-drawing-revision.dto';
import { SearchShopDrawingDto } from './dto/search-shop-drawing.dto';

describe('ShopDrawingService', () => {
  let service: ShopDrawingService;

  const mockShopDrawingRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockRevisionRepo = {
    findOne: jest.fn(),
  };
  const mockContractDrawingRepo = {
    findBy: jest.fn(),
  };
  const mockAttachmentRepo = {
    findBy: jest.fn(),
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
        ShopDrawingService,
        {
          provide: getRepositoryToken(ShopDrawing),
          useValue: mockShopDrawingRepo,
        },
        {
          provide: getRepositoryToken(ShopDrawingRevision),
          useValue: mockRevisionRepo,
        },
        {
          provide: getRepositoryToken(ContractDrawing),
          useValue: mockContractDrawingRepo,
        },
        {
          provide: getRepositoryToken(Attachment),
          useValue: mockAttachmentRepo,
        },
        { provide: FileStorageService, useValue: mockFileStorageService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: UuidResolverService, useValue: mockUuidResolver },
      ],
    }).compile();

    service = module.get<ShopDrawingService>(ShopDrawingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: CreateShopDrawingDto = {
      projectId: 1,
      drawingNumber: 'SD-001',
      title: 'Test Drawing',
      mainCategoryId: 1,
      subCategoryId: 2,
    };

    it('ควรสร้าง Shop Drawing พร้อม Revision 0', async () => {
      mockShopDrawingRepo.findOne.mockResolvedValue(null);
      const savedShopDrawing = { id: 10, drawingNumber: 'SD-001' };
      const savedRevision = { id: 100, revisionNumber: 0 };
      mockManager.create
        .mockReturnValueOnce(savedShopDrawing)
        .mockReturnValueOnce(savedRevision);
      mockManager.save
        .mockResolvedValueOnce(savedShopDrawing)
        .mockResolvedValueOnce(savedRevision);

      const result = await service.create(dto, mockUser as User);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: 10,
        currentRevision: savedRevision,
      });
    });

    it('ควร throw ConflictException เมื่อ drawingNumber ซ้ำ', async () => {
      mockShopDrawingRepo.findOne.mockResolvedValue({ id: 1 });

      await expect(service.create(dto, mockUser as User)).rejects.toThrow(
        ConflictException
      );
    });

    it('ควร commit attachments เมื่อมี attachmentIds', async () => {
      const dtoWithAttachments: CreateShopDrawingDto = {
        ...dto,
        attachmentIds: [1, 2],
      };
      mockShopDrawingRepo.findOne.mockResolvedValue(null);
      mockAttachmentRepo.findBy.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const savedShopDrawing = { id: 10 };
      const savedRevision = {
        id: 100,
        revisionNumber: 0,
        revisionDate: new Date(),
      };
      mockManager.create
        .mockReturnValueOnce(savedShopDrawing)
        .mockReturnValueOnce(savedRevision);
      mockManager.save
        .mockResolvedValueOnce(savedShopDrawing)
        .mockResolvedValueOnce(savedRevision);

      await service.create(dtoWithAttachments, mockUser as User);

      expect(mockFileStorageService.commit).toHaveBeenCalledWith(
        ['1', '2'],
        expect.objectContaining({ documentType: 'ShopDrawing' })
      );
    });

    it('ควร resolve contractDrawings เมื่อมี contractDrawingIds', async () => {
      const dtoWithContracts: CreateShopDrawingDto = {
        ...dto,
        contractDrawingIds: [5, 6],
      };
      mockShopDrawingRepo.findOne.mockResolvedValue(null);
      mockContractDrawingRepo.findBy.mockResolvedValue([{ id: 5 }, { id: 6 }]);
      const savedShopDrawing = { id: 10 };
      const savedRevision = { id: 100, revisionNumber: 0 };
      mockManager.create
        .mockReturnValueOnce(savedShopDrawing)
        .mockReturnValueOnce(savedRevision);
      mockManager.save
        .mockResolvedValueOnce(savedShopDrawing)
        .mockResolvedValueOnce(savedRevision);

      await service.create(dtoWithContracts, mockUser as User);

      expect(mockContractDrawingRepo.findBy).toHaveBeenCalled();
    });

    it('ควร rollback เมื่อเกิด error', async () => {
      mockShopDrawingRepo.findOne.mockResolvedValue(null);
      mockManager.create.mockReturnValue({});
      mockManager.save.mockRejectedValue(new Error('DB error'));

      await expect(service.create(dto, mockUser as User)).rejects.toThrow(
        'DB error'
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('createRevision', () => {
    const dto: CreateShopDrawingRevisionDto = {
      revisionLabel: 'A',
      title: 'Rev A',
    };

    it('ควร throw NotFoundException เมื่อไม่พบ shop drawing', async () => {
      mockShopDrawingRepo.findOneBy.mockResolvedValue(null);

      await expect(service.createRevision(999, dto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('ควร throw ConflictException เมื่อ revisionLabel ซ้ำ', async () => {
      mockShopDrawingRepo.findOneBy.mockResolvedValue({ id: 10 });
      mockRevisionRepo.findOne.mockResolvedValue({ id: 100 });

      await expect(service.createRevision(10, dto)).rejects.toThrow(
        ConflictException
      );
    });

    it('ควรสร้าง revision ใหม่ได้', async () => {
      mockShopDrawingRepo.findOneBy.mockResolvedValue({ id: 10 });
      mockRevisionRepo.findOne
        .mockResolvedValueOnce(null) // duplicate check
        .mockResolvedValueOnce({ revisionNumber: 2 }); // latest rev
      const savedRevision = { id: 200, revisionNumber: 3 };
      mockManager.create.mockReturnValue(savedRevision);
      mockManager.save.mockResolvedValue(savedRevision);

      const result = await service.createRevision(10, dto);

      expect(result).toEqual(savedRevision);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('ควร rollback เมื่อเกิด error ใน revision', async () => {
      mockShopDrawingRepo.findOneBy.mockResolvedValue({ id: 10 });
      mockRevisionRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockManager.create.mockReturnValue({});
      mockManager.save.mockRejectedValue(new Error('DB error'));

      await expect(service.createRevision(10, dto)).rejects.toThrow('DB error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('ควร resolve contractDrawings และ commit attachments ใน revision', async () => {
      const dtoWithRelations: CreateShopDrawingRevisionDto = {
        revisionLabel: 'B',
        title: 'Rev B',
        contractDrawingIds: [5, 6],
        attachmentIds: [1, 2],
      };
      mockShopDrawingRepo.findOneBy.mockResolvedValue({ id: 10 });
      mockRevisionRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ revisionNumber: 2 });
      mockContractDrawingRepo.findBy.mockResolvedValue([{ id: 5 }, { id: 6 }]);
      mockAttachmentRepo.findBy.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const savedRevision = {
        id: 200,
        revisionNumber: 3,
        revisionDate: new Date(),
      };
      mockManager.create.mockReturnValue(savedRevision);
      mockManager.save.mockResolvedValue(savedRevision);

      await service.createRevision(10, dtoWithRelations);

      expect(mockContractDrawingRepo.findBy).toHaveBeenCalled();
      expect(mockFileStorageService.commit).toHaveBeenCalledWith(
        ['1', '2'],
        expect.objectContaining({ documentType: 'ShopDrawing' })
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

    it('ควรคืน paginated shop drawings', async () => {
      const items = [
        {
          id: 1,
          revisions: [{ revisionNumber: 1 }, { revisionNumber: 0 }],
        },
      ];
      mockQB.getManyAndCount.mockResolvedValue([items, 1]);
      mockShopDrawingRepo.createQueryBuilder.mockReturnValue(mockQB);

      const searchDto: SearchShopDrawingDto = {
        projectUuid: 'uuid-001',
        projectId: 1,
      };

      const result = await service.findAll(searchDto);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].currentRevision.revisionNumber).toBe(1);
      expect(result.meta.total).toBe(1);
    });

    it('ควรกรองด้วย mainCategoryId และ search', async () => {
      mockQB.getManyAndCount.mockResolvedValue([[], 0]);
      mockShopDrawingRepo.createQueryBuilder.mockReturnValue(mockQB);

      const searchDto: SearchShopDrawingDto = {
        projectUuid: 'uuid-001',
        projectId: 1,
        mainCategoryId: 5,
        search: 'SD',
      };

      await service.findAll(searchDto);

      expect(mockQB.andWhere).toHaveBeenCalledWith(
        'sd.mainCategoryId = :mainCategoryId',
        { mainCategoryId: 5 }
      );
      expect(mockQB.andWhere).toHaveBeenCalledWith(
        'sd.drawingNumber LIKE :search',
        { search: '%SD%' }
      );
    });
  });

  describe('findOne', () => {
    it('ควรคืน shop drawing ตาม id', async () => {
      const drawing = { id: 1, drawingNumber: 'SD-001' };
      mockShopDrawingRepo.findOne.mockResolvedValue(drawing);

      const result = await service.findOne(1);

      expect(result).toEqual(drawing);
    });

    it('ควร throw NotFoundException เมื่อไม่พบ id', async () => {
      mockShopDrawingRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneByUuid', () => {
    it('ควรคืน shop drawing ตาม uuid', async () => {
      const drawing = { id: 1, publicId: 'uuid-001' };
      mockShopDrawingRepo.findOne.mockResolvedValue(drawing);

      const result = await service.findOneByUuid('uuid-001');

      expect(result).toEqual(drawing);
    });

    it('ควร throw NotFoundException เมื่อไม่พบ uuid', async () => {
      mockShopDrawingRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneByUuid('not-found')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('remove', () => {
    it('ควร soft remove shop drawing หลังบันทึก updatedBy', async () => {
      const drawing = { id: 1, updatedBy: 0 };
      mockShopDrawingRepo.findOne.mockResolvedValue(drawing);
      mockShopDrawingRepo.save.mockResolvedValue(drawing);
      mockShopDrawingRepo.softRemove.mockResolvedValue(drawing);

      await service.remove(1, mockUser as User);

      expect(mockShopDrawingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: 42 })
      );
      expect(mockShopDrawingRepo.softRemove).toHaveBeenCalledWith(drawing);
    });
  });
});
