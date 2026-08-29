// File: src/modules/drawing/asbuilt-drawing.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ AsBuiltDrawingService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { AsBuiltDrawingService } from './asbuilt-drawing.service';
import { AsBuiltDrawing } from './entities/asbuilt-drawing.entity';
import { AsBuiltDrawingRevision } from './entities/asbuilt-drawing-revision.entity';
import { ShopDrawingRevision } from './entities/shop-drawing-revision.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { User } from '../user/entities/user.entity';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { CreateAsBuiltDrawingDto } from './dto/create-asbuilt-drawing.dto';
import { CreateAsBuiltDrawingRevisionDto } from './dto/create-asbuilt-drawing-revision.dto';
import { SearchAsBuiltDrawingDto } from './dto/search-asbuilt-drawing.dto';

describe('AsBuiltDrawingService', () => {
  let service: AsBuiltDrawingService;

  const mockAsBuiltRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockRevisionRepo = {
    findOne: jest.fn(),
  };
  const mockShopDrawingRevisionRepo = {
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
        AsBuiltDrawingService,
        {
          provide: getRepositoryToken(AsBuiltDrawing),
          useValue: mockAsBuiltRepo,
        },
        {
          provide: getRepositoryToken(AsBuiltDrawingRevision),
          useValue: mockRevisionRepo,
        },
        {
          provide: getRepositoryToken(ShopDrawingRevision),
          useValue: mockShopDrawingRevisionRepo,
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

    service = module.get<AsBuiltDrawingService>(AsBuiltDrawingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: CreateAsBuiltDrawingDto = {
      projectId: 1,
      drawingNumber: 'AB-001',
      mainCategoryId: 1,
      subCategoryId: 2,
      title: 'Test As Built',
    };

    it('ควรสร้าง AS Built Drawing พร้อม Revision 0', async () => {
      mockAsBuiltRepo.findOne.mockResolvedValue(null);
      const savedDrawing = { id: 10, drawingNumber: 'AB-001' };
      const savedRevision = { id: 100, revisionNumber: 0 };
      mockManager.create
        .mockReturnValueOnce(savedDrawing)
        .mockReturnValueOnce(savedRevision);
      mockManager.save
        .mockResolvedValueOnce(savedDrawing)
        .mockResolvedValueOnce(savedRevision);

      const result = await service.create(dto, mockUser as User);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: 10,
        currentRevision: savedRevision,
      });
    });

    it('ควร throw ConflictException เมื่อ drawingNumber ซ้ำ', async () => {
      mockAsBuiltRepo.findOne.mockResolvedValue({ id: 1 });

      await expect(service.create(dto, mockUser as User)).rejects.toThrow(
        ConflictException
      );
    });

    it('ควร commit attachments เมื่อมี attachmentIds', async () => {
      const dtoWithAttachments: CreateAsBuiltDrawingDto = {
        ...dto,
        attachmentIds: [1, 2],
      };
      mockAsBuiltRepo.findOne.mockResolvedValue(null);
      mockAttachmentRepo.findBy.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const savedDrawing = { id: 10 };
      const savedRevision = {
        id: 100,
        revisionNumber: 0,
        revisionDate: new Date(),
      };
      mockManager.create
        .mockReturnValueOnce(savedDrawing)
        .mockReturnValueOnce(savedRevision);
      mockManager.save
        .mockResolvedValueOnce(savedDrawing)
        .mockResolvedValueOnce(savedRevision);

      await service.create(dtoWithAttachments, mockUser as User);

      expect(mockFileStorageService.commit).toHaveBeenCalledWith(
        ['1', '2'],
        expect.objectContaining({ documentType: 'AsBuiltDrawing' })
      );
    });

    it('ควร resolve shopDrawingRevisions เมื่อมี shopDrawingRevisionIds', async () => {
      const dtoWithRevs: CreateAsBuiltDrawingDto = {
        ...dto,
        shopDrawingRevisionIds: [5, 6],
      };
      mockAsBuiltRepo.findOne.mockResolvedValue(null);
      mockShopDrawingRevisionRepo.findBy.mockResolvedValue([
        { id: 5 },
        { id: 6 },
      ]);
      const savedDrawing = { id: 10 };
      const savedRevision = { id: 100, revisionNumber: 0 };
      mockManager.create
        .mockReturnValueOnce(savedDrawing)
        .mockReturnValueOnce(savedRevision);
      mockManager.save
        .mockResolvedValueOnce(savedDrawing)
        .mockResolvedValueOnce(savedRevision);

      await service.create(dtoWithRevs, mockUser as User);

      expect(mockShopDrawingRevisionRepo.findBy).toHaveBeenCalled();
    });

    it('ควร rollback เมื่อเกิด error', async () => {
      mockAsBuiltRepo.findOne.mockResolvedValue(null);
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
    const dto: CreateAsBuiltDrawingRevisionDto = {
      revisionLabel: 'A',
      title: 'Rev A',
    };

    it('ควร throw NotFoundException เมื่อไม่พบ as built drawing', async () => {
      mockAsBuiltRepo.findOneBy.mockResolvedValue(null);

      await expect(service.createRevision(999, dto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('ควร throw ConflictException เมื่อ revisionLabel ซ้ำ', async () => {
      mockAsBuiltRepo.findOneBy.mockResolvedValue({ id: 10 });
      mockRevisionRepo.findOne.mockResolvedValue({ id: 100 });

      await expect(service.createRevision(10, dto)).rejects.toThrow(
        ConflictException
      );
    });

    it('ควรสร้าง revision ใหม่ได้', async () => {
      mockAsBuiltRepo.findOneBy.mockResolvedValue({ id: 10 });
      mockRevisionRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ revisionNumber: 2 });
      const savedRevision = { id: 200, revisionNumber: 3 };
      mockManager.create.mockReturnValue(savedRevision);
      mockManager.save.mockResolvedValue(savedRevision);

      const result = await service.createRevision(10, dto);

      expect(result).toEqual(savedRevision);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('ควร rollback เมื่อเกิด error ใน revision', async () => {
      mockAsBuiltRepo.findOneBy.mockResolvedValue({ id: 10 });
      mockRevisionRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockManager.create.mockReturnValue({});
      mockManager.save.mockRejectedValue(new Error('DB error'));

      await expect(service.createRevision(10, dto)).rejects.toThrow('DB error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
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

    it('ควรคืน paginated as built drawings', async () => {
      const items = [
        {
          id: 1,
          revisions: [{ revisionNumber: 1 }, { revisionNumber: 0 }],
        },
      ];
      mockQB.getManyAndCount.mockResolvedValue([items, 1]);
      mockAsBuiltRepo.createQueryBuilder.mockReturnValue(mockQB);

      const searchDto: SearchAsBuiltDrawingDto = {
        projectUuid: 'uuid-001',
        projectId: 1,
      };

      const result = await service.findAll(searchDto);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].currentRevision.revisionNumber).toBe(1);
      expect(result.meta.total).toBe(1);
    });

    it('ควรกรองด้วย mainCategoryId, subCategoryId และ search', async () => {
      mockQB.getManyAndCount.mockResolvedValue([[], 0]);
      mockAsBuiltRepo.createQueryBuilder.mockReturnValue(mockQB);

      const searchDto: SearchAsBuiltDrawingDto = {
        projectUuid: 'uuid-001',
        projectId: 1,
        mainCategoryId: 5,
        subCategoryId: 10,
        search: 'AB',
      };

      await service.findAll(searchDto);

      expect(mockQB.andWhere).toHaveBeenCalledWith(
        'abd.mainCategoryId = :mainCategoryId',
        { mainCategoryId: 5 }
      );
      expect(mockQB.andWhere).toHaveBeenCalledWith(
        'abd.subCategoryId = :subCategoryId',
        { subCategoryId: 10 }
      );
      expect(mockQB.andWhere).toHaveBeenCalledWith(
        'abd.drawingNumber LIKE :search',
        { search: '%AB%' }
      );
    });
  });

  describe('findOne', () => {
    it('ควรคืน as built drawing ตาม id', async () => {
      const drawing = { id: 1, drawingNumber: 'AB-001' };
      mockAsBuiltRepo.findOne.mockResolvedValue(drawing);

      const result = await service.findOne(1);

      expect(result).toEqual(drawing);
    });

    it('ควร throw NotFoundException เมื่อไม่พบ id', async () => {
      mockAsBuiltRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneByUuid', () => {
    it('ควรคืน as built drawing ตาม uuid', async () => {
      const drawing = { id: 1, publicId: 'uuid-001' };
      mockAsBuiltRepo.findOne.mockResolvedValue(drawing);

      const result = await service.findOneByUuid('uuid-001');

      expect(result).toEqual(drawing);
    });

    it('ควร throw NotFoundException เมื่อไม่พบ uuid', async () => {
      mockAsBuiltRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneByUuid('not-found')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('remove', () => {
    it('ควร soft remove as built drawing', async () => {
      const drawing = { id: 1, updatedBy: 0 };
      mockAsBuiltRepo.findOne.mockResolvedValue(drawing);
      mockAsBuiltRepo.save.mockResolvedValue(drawing);
      mockAsBuiltRepo.softRemove.mockResolvedValue(drawing);

      await service.remove(1, mockUser as User);

      expect(mockAsBuiltRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: 42 })
      );
      expect(mockAsBuiltRepo.softRemove).toHaveBeenCalledWith(drawing);
    });
  });
});
