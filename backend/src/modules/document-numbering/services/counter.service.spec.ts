// File: backend/src/modules/document-numbering/services/counter.service.spec.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for CounterService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CounterService } from './counter.service';
import { DocumentNumberCounter } from '../entities/document-number-counter.entity';
import { CounterKeyDto } from '../dto/counter-key.dto';
import { ConflictException } from '@nestjs/common';

describe('CounterService', () => {
  let service: CounterService;
  let counterRepo: Repository<DocumentNumberCounter>;

  const mockCounterKey: CounterKeyDto = {
    projectId: 1,
    originatorOrganizationId: 2,
    recipientOrganizationId: 3,
    correspondenceTypeId: 4,
    subTypeId: 5,
    rfaTypeId: 6,
    disciplineId: 7,
    resetScope: 'YEAR_2025',
  };

  const mockCounter: DocumentNumberCounter = {
    projectId: 1,
    originatorId: 2,
    recipientOrganizationId: 3,
    correspondenceTypeId: 4,
    subTypeId: 5,
    rfaTypeId: 6,
    disciplineId: 7,
    resetScope: 'YEAR_2025',
    lastNumber: 10,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQueryRunner = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockQueryBuilder = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CounterService,
        {
          provide: getRepositoryToken(DocumentNumberCounter),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((callback: (runner: unknown) => unknown) =>
              callback(mockQueryRunner)
            ),
          },
        },
      ],
    }).compile();

    service = module.get<CounterService>(CounterService);
    counterRepo = module.get<Repository<DocumentNumberCounter>>(
      getRepositoryToken(DocumentNumberCounter)
    );

    // Setup query builder chain
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.set.mockReturnThis();
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.andWhere.mockReturnThis();
    mockQueryRunner.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('incrementCounter', () => {
    it('should increment existing counter successfully', async () => {
      mockQueryRunner.findOne.mockResolvedValue(mockCounter);
      mockQueryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await service.incrementCounter(mockCounterKey);

      expect(result).toBe(11);
      expect(mockQueryRunner.findOne).toHaveBeenCalled();
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });

    it('should create new counter when none exists', async () => {
      mockQueryRunner.findOne.mockResolvedValue(null);
      mockQueryRunner.create.mockReturnValue(mockCounter);
      mockQueryRunner.save.mockResolvedValue(mockCounter);

      const result = await service.incrementCounter(mockCounterKey);

      expect(result).toBe(1);
      expect(mockQueryRunner.create).toHaveBeenCalled();
      expect(mockQueryRunner.save).toHaveBeenCalled();
    });

    it('should retry on version conflict and succeed', async () => {
      mockQueryRunner.findOne
        .mockResolvedValueOnce(mockCounter)
        .mockResolvedValueOnce(mockCounter);
      mockQueryBuilder.execute
        .mockResolvedValueOnce({ affected: 0 }) // First attempt - conflict
        .mockResolvedValueOnce({ affected: 1 }); // Second attempt - success

      const result = await service.incrementCounter(mockCounterKey);

      expect(result).toBe(11);
      expect(mockQueryBuilder.execute).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException after max retries', async () => {
      mockQueryRunner.findOne.mockResolvedValue(mockCounter);
      mockQueryBuilder.execute.mockResolvedValue({ affected: 0 });

      await expect(service.incrementCounter(mockCounterKey)).rejects.toThrow(
        ConflictException
      );
    });

    it('should throw error on database failure', async () => {
      mockQueryRunner.findOne.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.incrementCounter(mockCounterKey)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('getCurrentCounter', () => {
    it('should return current counter value', async () => {
      (counterRepo.findOne as jest.Mock).mockResolvedValue(mockCounter);

      const result = await service.getCurrentCounter(mockCounterKey);

      expect(result).toBe(10);
      expect(counterRepo.findOne).toHaveBeenCalled();
    });

    it('should return 0 when counter does not exist', async () => {
      (counterRepo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.getCurrentCounter(mockCounterKey);

      expect(result).toBe(0);
    });
  });

  describe('forceUpdateCounter', () => {
    it('should update existing counter', async () => {
      mockQueryRunner.findOne.mockResolvedValue(mockCounter);
      mockQueryBuilder.execute.mockResolvedValue({ affected: 1 });

      await service.forceUpdateCounter(mockCounterKey, 999);

      expect(mockQueryRunner.findOne).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        lastNumber: 999,
        version: expect.any(Function),
      });
    });

    it('should create new counter if none exists', async () => {
      mockQueryRunner.findOne.mockResolvedValue(null);
      mockQueryRunner.create.mockReturnValue(mockCounter);
      mockQueryRunner.save.mockResolvedValue(mockCounter);

      await service.forceUpdateCounter(mockCounterKey, 999);

      expect(mockQueryRunner.create).toHaveBeenCalled();
      expect(mockQueryRunner.save).toHaveBeenCalled();
    });
  });
});
