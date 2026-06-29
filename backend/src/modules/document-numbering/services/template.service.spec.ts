// File: backend/src/modules/document-numbering/services/template.service.spec.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for TemplateService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplateService } from './template.service';
import { DocumentNumberFormat } from '../entities/document-number-format.entity';

describe('TemplateService', () => {
  let service: TemplateService;
  let formatRepo: Repository<DocumentNumberFormat>;

  const mockFormat = {
    id: 1,
    projectId: 1,
    correspondenceTypeId: 1,
    formatTemplate: '{ORG}-{SEQ:4}/{YEAR:BE}',
    resetSequenceYearly: true,
  };

  const mockDefaultFormat = {
    id: 2,
    projectId: 1,
    correspondenceTypeId: null,
    formatTemplate: '{PROJECT}-{SEQ:4}',
    resetSequenceYearly: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateService,
        {
          provide: getRepositoryToken(DocumentNumberFormat),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TemplateService>(TemplateService);
    formatRepo = module.get<Repository<DocumentNumberFormat>>(
      getRepositoryToken(DocumentNumberFormat)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findTemplate', () => {
    it('should return specific template when correspondenceTypeId is provided', async () => {
      (formatRepo.findOne as jest.Mock).mockResolvedValue(mockFormat);

      const result = await service.findTemplate(1, 1);

      expect(result).toEqual(mockFormat);
      expect(formatRepo.findOne).toHaveBeenCalledWith({
        where: { projectId: 1, correspondenceTypeId: 1 },
      });
    });

    it('should return project default template when specific not found', async () => {
      (formatRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(null) // First call (specific)
        .mockResolvedValueOnce(mockDefaultFormat); // Second call (default)

      const result = await service.findTemplate(1, 1);

      expect(result).toEqual(mockDefaultFormat);
      expect(formatRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('should return project default template when correspondenceTypeId is not provided', async () => {
      (formatRepo.findOne as jest.Mock).mockResolvedValue(mockDefaultFormat);

      const result = await service.findTemplate(1);

      expect(result).toEqual(mockDefaultFormat);
      expect(formatRepo.findOne).toHaveBeenCalledWith({
        where: { projectId: 1, correspondenceTypeId: undefined },
      });
    });

    it('should return null when no template found', async () => {
      (formatRepo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.findTemplate(1, 1);

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      (formatRepo.findOne as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.findTemplate(1, 1)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});
