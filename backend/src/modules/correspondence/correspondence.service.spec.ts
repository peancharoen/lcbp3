import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CorrespondenceService } from './correspondence.service';
import { Correspondence } from './entities/correspondence.entity';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { CorrespondenceType } from './entities/correspondence-type.entity';
import { CorrespondenceStatus } from './entities/correspondence-status.entity';
import { CorrespondenceReference } from './entities/correspondence-reference.entity';
import { Organization } from '../organization/entities/organization.entity';
import { CorrespondenceRecipient } from './entities/correspondence-recipient.entity';
import { DocumentNumberingService } from '../document-numbering/services/document-numbering.service';
import { JsonSchemaService } from '../json-schema/json-schema.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { UserService } from '../user/user.service';
import { SearchService } from '../search/search.service';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import { UpdateCorrespondenceDto } from './dto/update-correspondence.dto';
import { User } from '../user/entities/user.entity';

describe('CorrespondenceService', () => {
  let service: CorrespondenceService;
  let numberingService: DocumentNumberingService;
  let correspondenceRepo: Repository<Correspondence>;
  let revisionRepo: Repository<CorrespondenceRevision>;
  let _dataSource: DataSource;

  const createMockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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

  const mockDataSource = {
    createQueryRunner: jest.fn(() => ({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
      },
    })),
    getRepository: jest.fn(() => createMockRepository()),
  };

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
          provide: getRepositoryToken(CorrespondenceReference),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(CorrespondenceRecipient),
          useValue: createMockRepository(),
        },
        {
          provide: DocumentNumberingService,
          useValue: {
            generateNextNumber: jest.fn(),
            updateNumberForDraft: jest.fn(),
            previewNextNumber: jest.fn(),
          },
        },
        {
          provide: JsonSchemaService,
          useValue: { validate: jest.fn() },
        },
        {
          provide: WorkflowEngineService,
          useValue: { createInstance: jest.fn() },
        },
        {
          provide: UserService,
          useValue: {
            findOne: jest.fn(),
            getUserPermissions: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: SearchService,
          useValue: { indexDocument: jest.fn() },
        },
        {
          provide: FileStorageService,
          useValue: { commit: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    service = module.get<CorrespondenceService>(CorrespondenceService);
    numberingService = module.get<DocumentNumberingService>(
      DocumentNumberingService
    );
    correspondenceRepo = module.get<Repository<Correspondence>>(
      getRepositoryToken(Correspondence)
    );
    revisionRepo = module.get<Repository<CorrespondenceRevision>>(
      getRepositoryToken(CorrespondenceRevision)
    );
    _dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('should NOT regenerate number if critical fields unchanged', async () => {
      const mockUser = { id: 1, primaryOrganizationId: 10 } as unknown as User;
      const mockRevision = {
        id: 100,
        correspondenceId: 1,
        isCurrent: true,
        statusId: 5,
      };

      jest
        .spyOn(revisionRepo, 'findOne')
        .mockResolvedValue(mockRevision as unknown as CorrespondenceRevision);

      const mockCorr = {
        id: 1,
        projectId: 1,
        correspondenceTypeId: 2,
        disciplineId: 3,
        originatorId: 10,
        correspondenceNumber: 'OLD-NUM',
        recipients: [{ recipientType: 'TO', recipientOrganizationId: 99 }],
      };
      jest
        .spyOn(correspondenceRepo, 'findOne')
        .mockResolvedValue(mockCorr as unknown as Correspondence);

      const updateDto: UpdateCorrespondenceDto = {
        projectId: 1,
        disciplineId: 3,
      };

      await service.update(1, updateDto, mockUser);

      expect(
        numberingService.updateNumberForDraft as jest.Mock
      ).not.toHaveBeenCalled();
    });

    it('should regenerate number if Project ID changes', async () => {
      const mockUser = { id: 1, primaryOrganizationId: 10 } as unknown as User;
      const mockRevision = {
        id: 100,
        correspondenceId: 1,
        isCurrent: true,
        statusId: 5,
      };
      jest
        .spyOn(revisionRepo, 'findOne')
        .mockResolvedValue(mockRevision as unknown as CorrespondenceRevision);

      const mockCorr = {
        id: 1,
        projectId: 1,
        correspondenceTypeId: 2,
        disciplineId: 3,
        originatorId: 10,
        correspondenceNumber: 'OLD-NUM',
        recipients: [{ recipientType: 'TO', recipientOrganizationId: 99 }],
      };
      jest
        .spyOn(correspondenceRepo, 'findOne')
        .mockResolvedValue(mockCorr as unknown as Correspondence);

      const updateDto: UpdateCorrespondenceDto = {
        projectId: 2,
      };

      await service.update(1, updateDto, mockUser);

      expect(
        numberingService.updateNumberForDraft as jest.Mock
      ).toHaveBeenCalled();
    });

    it('should regenerate number if Document Type changes', async () => {
      const mockUser = { id: 1, primaryOrganizationId: 10 } as unknown as User;
      const mockRevision = {
        id: 100,
        correspondenceId: 1,
        isCurrent: true,
        statusId: 5,
      };
      jest
        .spyOn(revisionRepo, 'findOne')
        .mockResolvedValue(mockRevision as unknown as CorrespondenceRevision);

      const mockCorr = {
        id: 1,
        projectId: 1,
        correspondenceTypeId: 2,
        disciplineId: 3,
        originatorId: 10,
        correspondenceNumber: 'OLD-NUM',
        recipients: [{ recipientType: 'TO', recipientOrganizationId: 99 }],
      };
      jest
        .spyOn(correspondenceRepo, 'findOne')
        .mockResolvedValue(mockCorr as unknown as Correspondence);

      const updateDto: UpdateCorrespondenceDto = {
        typeId: 999,
      };

      await service.update(1, updateDto, mockUser);

      expect(
        numberingService.updateNumberForDraft as jest.Mock
      ).toHaveBeenCalled();
    });

    it('should regenerate number if Recipient Organization changes', async () => {
      const mockUser = { id: 1, primaryOrganizationId: 10 } as unknown as User;
      const mockRevision = {
        id: 100,
        correspondenceId: 1,
        isCurrent: true,
        statusId: 5,
      };
      jest
        .spyOn(revisionRepo, 'findOne')
        .mockResolvedValue(mockRevision as unknown as CorrespondenceRevision);

      const mockCorr = {
        id: 1,
        projectId: 1,
        correspondenceTypeId: 2,
        disciplineId: 3,
        originatorId: 10,
        correspondenceNumber: 'OLD-NUM',
        recipients: [{ recipientType: 'TO', recipientOrganizationId: 99 }],
      };
      jest
        .spyOn(correspondenceRepo, 'findOne')
        .mockResolvedValue(mockCorr as unknown as Correspondence);

      // Access private property for mocking via casting
      const internalService = service as unknown as {
        orgRepo: Repository<Organization>;
      };
      jest.spyOn(internalService.orgRepo, 'findOne').mockResolvedValue({
        id: 88,
        organizationCode: 'NEW-ORG',
      } as unknown as Organization);

      const updateDto: UpdateCorrespondenceDto = {
        recipients: [{ type: 'TO', organizationId: 88 }],
      };

      await service.update(1, updateDto, mockUser);

      expect(
        numberingService.updateNumberForDraft as jest.Mock
      ).toHaveBeenCalled();
    });
  });
});
