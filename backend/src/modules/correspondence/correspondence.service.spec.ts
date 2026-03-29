import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CorrespondenceService } from './correspondence.service';
import { Correspondence } from './entities/correspondence.entity';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { CorrespondenceType } from './entities/correspondence-type.entity';
import { CorrespondenceStatus } from './entities/correspondence-status.entity';
import { CorrespondenceReference } from './entities/correspondence-reference.entity';
import { CorrespondenceTag } from './entities/correspondence-tag.entity';
import { Organization } from '../organization/entities/organization.entity';
import { CorrespondenceRecipient } from './entities/correspondence-recipient.entity';
import { DocumentNumberingService } from '../document-numbering/services/document-numbering.service';
import { JsonSchemaService } from '../json-schema/json-schema.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { UserService } from '../user/user.service';
import { SearchService } from '../search/search.service';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { NotificationService } from '../notification/notification.service';
import { UpdateCorrespondenceDto } from './dto/update-correspondence.dto';
import { CreateCorrespondenceDto } from './dto/create-correspondence.dto';
import { User } from '../user/entities/user.entity';

describe('CorrespondenceService', () => {
  let service: CorrespondenceService;
  let numberingService: DocumentNumberingService;
  let correspondenceRepo: Repository<Correspondence>;
  let revisionRepo: Repository<CorrespondenceRevision>;
  let testingModule: TestingModule;
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
    manager: {
      findOne: jest.fn(),
    },
  };

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
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
          provide: getRepositoryToken(CorrespondenceTag),
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
        {
          provide: UuidResolverService,
          useValue: {
            resolveProjectId: jest.fn().mockResolvedValue(1),
            resolveOrganizationId: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: NotificationService,
          useValue: { send: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = testingModule.get<CorrespondenceService>(CorrespondenceService);
    numberingService = testingModule.get<DocumentNumberingService>(
      DocumentNumberingService
    );
    correspondenceRepo = testingModule.get<Repository<Correspondence>>(
      getRepositoryToken(Correspondence)
    );
    revisionRepo = testingModule.get<Repository<CorrespondenceRevision>>(
      getRepositoryToken(CorrespondenceRevision)
    );
    _dataSource = testingModule.get<DataSource>(DataSource);
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

      const uuidResolver =
        testingModule.get<UuidResolverService>(UuidResolverService);
      (uuidResolver.resolveProjectId as jest.Mock).mockResolvedValue(2);

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

      const typeRepo = testingModule.get<Repository<CorrespondenceType>>(
        getRepositoryToken(CorrespondenceType)
      );
      (typeRepo.findOne as jest.Mock).mockResolvedValue({
        id: 999,
        typeCode: 'NEW-TYPE',
      });

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

      // Access DataSource manager for mocking
      mockDataSource.manager.findOne.mockResolvedValue({
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

  describe('create', () => {
    it('should allow system.manage_all user without primaryOrganizationId when originatorId is provided', async () => {
      const mockUser = {
        user_id: 1,
        primaryOrganizationId: null,
      } as unknown as User;

      const createDto: CreateCorrespondenceDto = {
        projectId: 'project-uuid',
        typeId: 1,
        subject: 'Test Subject',
        originatorId: 'originator-uuid',
        recipients: [{ organizationId: 'recipient-uuid', type: 'TO' }],
      };

      const userService = testingModule.get<UserService>(UserService);
      const typeRepo = testingModule.get<Repository<CorrespondenceType>>(
        getRepositoryToken(CorrespondenceType)
      );
      const statusRepo = testingModule.get<Repository<CorrespondenceStatus>>(
        getRepositoryToken(CorrespondenceStatus)
      );
      const uuidResolver =
        testingModule.get<UuidResolverService>(UuidResolverService);

      (userService.findOne as jest.Mock).mockResolvedValue({
        user_id: 1,
        primaryOrganizationId: null,
      });
      (userService.getUserPermissions as jest.Mock).mockResolvedValue([
        'system.manage_all',
      ]);

      (uuidResolver.resolveProjectId as jest.Mock).mockResolvedValue(100);
      (uuidResolver.resolveOrganizationId as jest.Mock).mockImplementation(
        (value: number | string) => {
          if (value === 'originator-uuid') return 10;
          if (value === 'recipient-uuid') return 20;
          return 0;
        }
      );

      (typeRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        typeCode: 'LTR',
      });
      (statusRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        statusCode: 'DRAFT',
      });

      (numberingService.generateNextNumber as jest.Mock).mockResolvedValue({
        number: 'DOC-001',
      });

      mockDataSource.manager.findOne
        .mockResolvedValueOnce({ id: 10, organizationCode: 'ORG' })
        .mockResolvedValueOnce({ id: 20, organizationCode: 'REC' });

      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          create: jest.fn(
            (_entity: unknown, payload: Record<string, unknown>) => payload
          ),
          save: jest
            .fn()
            .mockResolvedValueOnce({ id: 999, publicId: 'corr-uuid' })
            .mockResolvedValueOnce({ id: 1000 })
            .mockResolvedValueOnce([]),
          findOne: jest.fn(),
        },
      };

      (mockDataSource.createQueryRunner as jest.Mock).mockReturnValue(
        queryRunner
      );

      await service.create(createDto, mockUser);

      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        Correspondence,
        expect.objectContaining({ originatorId: 10 })
      );
    });

    it('should set revisionLabel to "A" for RFA type', async () => {
      const mockUser = {
        user_id: 1,
        primaryOrganizationId: 10,
      } as unknown as User;

      const createDto: CreateCorrespondenceDto = {
        projectId: 'project-uuid',
        typeId: 1,
        subject: 'Test Subject',
        recipients: [{ organizationId: 'recipient-uuid', type: 'TO' }],
      };

      const typeRepo = testingModule.get<Repository<CorrespondenceType>>(
        getRepositoryToken(CorrespondenceType)
      );
      const statusRepo = testingModule.get<Repository<CorrespondenceStatus>>(
        getRepositoryToken(CorrespondenceStatus)
      );
      const uuidResolver =
        testingModule.get<UuidResolverService>(UuidResolverService);

      (uuidResolver.resolveProjectId as jest.Mock).mockResolvedValue(100);
      (uuidResolver.resolveOrganizationId as jest.Mock).mockResolvedValue(20);

      (typeRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        typeCode: 'RFA',
      });
      (statusRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        statusCode: 'DRAFT',
      });

      (numberingService.generateNextNumber as jest.Mock).mockResolvedValue({
        number: 'DOC-001',
      });

      mockDataSource.manager.findOne
        .mockResolvedValueOnce({ id: 10, organizationCode: 'ORG' })
        .mockResolvedValueOnce({ id: 20, organizationCode: 'REC' });

      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          create: jest.fn(
            (_entity: unknown, payload: Record<string, unknown>) => payload
          ),
          save: jest
            .fn()
            .mockResolvedValueOnce({ id: 999, publicId: 'corr-uuid' })
            .mockResolvedValueOnce({ id: 1000 })
            .mockResolvedValueOnce([]),
          findOne: jest.fn(),
        },
      };

      (mockDataSource.createQueryRunner as jest.Mock).mockReturnValue(
        queryRunner
      );

      await service.create(createDto, mockUser);

      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        CorrespondenceRevision,
        expect.objectContaining({ revisionLabel: 'A' })
      );
    });

    it('should set revisionLabel to "A" for RFI type', async () => {
      const mockUser = {
        user_id: 1,
        primaryOrganizationId: 10,
      } as unknown as User;

      const createDto: CreateCorrespondenceDto = {
        projectId: 'project-uuid',
        typeId: 1,
        subject: 'Test Subject',
        recipients: [{ organizationId: 'recipient-uuid', type: 'TO' }],
      };

      const typeRepo = testingModule.get<Repository<CorrespondenceType>>(
        getRepositoryToken(CorrespondenceType)
      );
      const statusRepo = testingModule.get<Repository<CorrespondenceStatus>>(
        getRepositoryToken(CorrespondenceStatus)
      );
      const uuidResolver =
        testingModule.get<UuidResolverService>(UuidResolverService);

      (uuidResolver.resolveProjectId as jest.Mock).mockResolvedValue(100);
      (uuidResolver.resolveOrganizationId as jest.Mock).mockResolvedValue(20);

      (typeRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        typeCode: 'RFI',
      });
      (statusRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        statusCode: 'DRAFT',
      });

      (numberingService.generateNextNumber as jest.Mock).mockResolvedValue({
        number: 'DOC-001',
      });

      mockDataSource.manager.findOne
        .mockResolvedValueOnce({ id: 10, organizationCode: 'ORG' })
        .mockResolvedValueOnce({ id: 20, organizationCode: 'REC' });

      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          create: jest.fn(
            (_entity: unknown, payload: Record<string, unknown>) => payload
          ),
          save: jest
            .fn()
            .mockResolvedValueOnce({ id: 999, publicId: 'corr-uuid' })
            .mockResolvedValueOnce({ id: 1000 })
            .mockResolvedValueOnce([]),
          findOne: jest.fn(),
        },
      };

      (mockDataSource.createQueryRunner as jest.Mock).mockReturnValue(
        queryRunner
      );

      await service.create(createDto, mockUser);

      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        CorrespondenceRevision,
        expect.objectContaining({ revisionLabel: 'A' })
      );
    });

    it('should set revisionLabel to null for LETTER type', async () => {
      const mockUser = {
        user_id: 1,
        primaryOrganizationId: 10,
      } as unknown as User;

      const createDto: CreateCorrespondenceDto = {
        projectId: 'project-uuid',
        typeId: 1,
        subject: 'Test Subject',
        recipients: [{ organizationId: 'recipient-uuid', type: 'TO' }],
      };

      const typeRepo = testingModule.get<Repository<CorrespondenceType>>(
        getRepositoryToken(CorrespondenceType)
      );
      const statusRepo = testingModule.get<Repository<CorrespondenceStatus>>(
        getRepositoryToken(CorrespondenceStatus)
      );
      const uuidResolver =
        testingModule.get<UuidResolverService>(UuidResolverService);

      (uuidResolver.resolveProjectId as jest.Mock).mockResolvedValue(100);
      (uuidResolver.resolveOrganizationId as jest.Mock).mockResolvedValue(20);

      (typeRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        typeCode: 'LETTER',
      });
      (statusRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        statusCode: 'DRAFT',
      });

      (numberingService.generateNextNumber as jest.Mock).mockResolvedValue({
        number: 'DOC-001',
      });

      mockDataSource.manager.findOne
        .mockResolvedValueOnce({ id: 10, organizationCode: 'ORG' })
        .mockResolvedValueOnce({ id: 20, organizationCode: 'REC' });

      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          create: jest.fn(
            (_entity: unknown, payload: Record<string, unknown>) => payload
          ),
          save: jest
            .fn()
            .mockResolvedValueOnce({ id: 999, publicId: 'corr-uuid' })
            .mockResolvedValueOnce({ id: 1000 })
            .mockResolvedValueOnce([]),
          findOne: jest.fn(),
        },
      };

      (mockDataSource.createQueryRunner as jest.Mock).mockReturnValue(
        queryRunner
      );

      await service.create(createDto, mockUser);

      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        CorrespondenceRevision,
        expect.objectContaining({ revisionLabel: null })
      );
    });

    it('should set revisionLabel to null for MEMO type', async () => {
      const mockUser = {
        user_id: 1,
        primaryOrganizationId: 10,
      } as unknown as User;

      const createDto: CreateCorrespondenceDto = {
        projectId: 'project-uuid',
        typeId: 1,
        subject: 'Test Subject',
        recipients: [{ organizationId: 'recipient-uuid', type: 'TO' }],
      };

      const typeRepo = testingModule.get<Repository<CorrespondenceType>>(
        getRepositoryToken(CorrespondenceType)
      );
      const statusRepo = testingModule.get<Repository<CorrespondenceStatus>>(
        getRepositoryToken(CorrespondenceStatus)
      );
      const uuidResolver =
        testingModule.get<UuidResolverService>(UuidResolverService);

      (uuidResolver.resolveProjectId as jest.Mock).mockResolvedValue(100);
      (uuidResolver.resolveOrganizationId as jest.Mock).mockResolvedValue(20);

      (typeRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        typeCode: 'MEMO',
      });
      (statusRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        statusCode: 'DRAFT',
      });

      (numberingService.generateNextNumber as jest.Mock).mockResolvedValue({
        number: 'DOC-001',
      });

      mockDataSource.manager.findOne
        .mockResolvedValueOnce({ id: 10, organizationCode: 'ORG' })
        .mockResolvedValueOnce({ id: 20, organizationCode: 'REC' });

      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          create: jest.fn(
            (_entity: unknown, payload: Record<string, unknown>) => payload
          ),
          save: jest
            .fn()
            .mockResolvedValueOnce({ id: 999, publicId: 'corr-uuid' })
            .mockResolvedValueOnce({ id: 1000 })
            .mockResolvedValueOnce([]),
          findOne: jest.fn(),
        },
      };

      (mockDataSource.createQueryRunner as jest.Mock).mockReturnValue(
        queryRunner
      );

      await service.create(createDto, mockUser);

      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        CorrespondenceRevision,
        expect.objectContaining({ revisionLabel: null })
      );
    });
  });
});
