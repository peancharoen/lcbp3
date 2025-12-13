import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CorrespondenceService } from './correspondence.service';
import { Correspondence } from './entities/correspondence.entity';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { CorrespondenceType } from './entities/correspondence-type.entity';
import { CorrespondenceStatus } from './entities/correspondence-status.entity';
import { RoutingTemplate } from './entities/routing-template.entity';
import { CorrespondenceRouting } from './entities/correspondence-routing.entity';
import { CorrespondenceReference } from './entities/correspondence-reference.entity';
import { DocumentNumberingService } from '../document-numbering/document-numbering.service';
import { JsonSchemaService } from '../json-schema/json-schema.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { UserService } from '../user/user.service';
import { SearchService } from '../search/search.service';

describe('CorrespondenceService', () => {
  let service: CorrespondenceService;

  const createMockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    })),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrespondenceService,
        {
          provide: getRepositoryToken(Correspondence),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(CorrespondenceRevision),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(CorrespondenceType),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(CorrespondenceStatus),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(RoutingTemplate),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(CorrespondenceRouting),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(CorrespondenceReference),
          useValue: createMockRepository(),
        },
        {
          provide: DocumentNumberingService,
          useValue: { generateNextNumber: jest.fn() },
        },
        {
          provide: JsonSchemaService,
          useValue: { validate: jest.fn() },
        },
        {
          provide: WorkflowEngineService,
          useValue: { startWorkflow: jest.fn(), processAction: jest.fn() },
        },
        {
          provide: UserService,
          useValue: { findOne: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(() => ({
              connect: jest.fn(),
              startTransaction: jest.fn(),
              commitTransaction: jest.fn(),
              rollbackTransaction: jest.fn(),
              release: jest.fn(),
              manager: {
                save: jest.fn(),
                findOne: jest.fn(),
              },
            })),
          },
        },
        {
          provide: SearchService,
          useValue: { indexDocument: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CorrespondenceService>(CorrespondenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return correspondences array', async () => {
      const result = await service.findAll({ projectId: 1 });
      expect(Array.isArray(result.data)).toBeTruthy();
      expect(result.meta).toBeDefined();
    });
  });
});
