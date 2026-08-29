// File: backend/src/modules/correspondence/correspondence.service.spec.ts
// Change Log:
// - 2026-08-26: เพิ่ม regression tests สำหรับ hardDelete — attachments.uuid และ vector deletion payload

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PermissionException } from '../../common/exceptions';
import { CorrespondenceService } from './correspondence.service';
import { Correspondence } from './entities/correspondence.entity';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { CorrespondenceType } from './entities/correspondence-type.entity';
import { CorrespondenceStatus } from './entities/correspondence-status.entity';
import { CorrespondenceReference } from './entities/correspondence-reference.entity';
import { CorrespondenceTag } from './entities/correspondence-tag.entity';
import { Organization } from '../organization/entities/organization.entity';
import { CorrespondenceRecipient } from './entities/correspondence-recipient.entity';
import { CorrespondenceRevisionAttachment } from './entities/correspondence-revision-attachment.entity';
import { DocumentNumberingService } from '../document-numbering/services/document-numbering.service';
import { JsonSchemaService } from '../json-schema/json-schema.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { UserService } from '../user/user.service';
import { SearchService } from '../search/search.service';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { NotificationService } from '../notification/notification.service';
import { CirculationService } from '../circulation/circulation.service';
import { AiQueueService } from '../ai/ai-queue.service';
import { UpdateCorrespondenceDto } from './dto/update-correspondence.dto';
import { CreateCorrespondenceDto } from './dto/create-correspondence.dto';
import { User } from '../user/entities/user.entity';

jest.mock('fs-extra', () => ({
  pathExists: jest.fn().mockResolvedValue(true),
  remove: jest.fn().mockResolvedValue(undefined),
}));

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

  const mockManager = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getRepository: jest.fn(() => createMockRepository()),
  };

  const mockDataSource = {
    query: jest.fn().mockResolvedValue([]),
    createQueryRunner: jest.fn(() => ({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: mockManager,
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
            previewNumber: jest.fn(),
          },
        },
        {
          provide: JsonSchemaService,
          useValue: { validate: jest.fn() },
        },
        {
          provide: WorkflowEngineService,
          useValue: {
            createInstance: jest.fn(),
            getInstanceByEntity: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: UserService,
          useValue: {
            findOne: jest.fn(),
            getUserPermissions: jest.fn().mockResolvedValue([]),
            findDocControlIdByOrg: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: SearchService,
          useValue: { indexDocument: jest.fn().mockResolvedValue(undefined) },
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
        {
          provide: getRepositoryToken(CorrespondenceRevisionAttachment),
          useValue: createMockRepository(),
        },
        {
          provide: CirculationService,
          useValue: {
            forceClose: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: AiQueueService,
          useValue: {
            enqueueVectorDeletion: jest.fn().mockResolvedValue('job-id'),
          },
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
    it('should allow non-draft update for org-admin+ permissions', async () => {
      const mockUser = {
        user_id: 1,
        primaryOrganizationId: 10,
      } as unknown as User;

      const mockCorr = {
        id: 1,
        publicId: 'corr-uuid-1',
        correspondenceNumber: 'CORR-001',
        projectId: 1,
        createdAt: new Date(),
        recipients: [],
      };

      const mockRevision = {
        id: 100,
        correspondenceId: 1,
        isCurrent: true,
        statusId: 23,
        correspondence: mockCorr,
      };

      jest
        .spyOn(revisionRepo, 'findOne')
        .mockResolvedValue(mockRevision as unknown as CorrespondenceRevision);

      const statusRepo = testingModule.get<Repository<CorrespondenceStatus>>(
        getRepositoryToken(CorrespondenceStatus)
      );
      (statusRepo.findOne as jest.Mock).mockResolvedValue({
        id: 23,
        statusCode: 'SUBOWN',
      });

      const userService = testingModule.get<UserService>(UserService);
      (userService.getUserPermissions as jest.Mock).mockResolvedValue([
        'correspondence.cancel',
      ]);

      jest.spyOn(correspondenceRepo, 'findOne').mockResolvedValue({
        ...mockCorr,
        revisions: [],
      } as unknown as Correspondence);

      await expect(
        service.update(1, { subject: 'Updated Subject' }, mockUser)
      ).resolves.toBeDefined();
    });

    it('should reject non-draft update for non-admin permissions', async () => {
      const mockUser = {
        user_id: 2,
        primaryOrganizationId: 10,
      } as unknown as User;
      const mockRevision = {
        id: 101,
        correspondenceId: 2,
        isCurrent: true,
        statusId: 23,
      };

      jest
        .spyOn(revisionRepo, 'findOne')
        .mockResolvedValue(mockRevision as unknown as CorrespondenceRevision);

      const statusRepo = testingModule.get<Repository<CorrespondenceStatus>>(
        getRepositoryToken(CorrespondenceStatus)
      );
      (statusRepo.findOne as jest.Mock).mockResolvedValue({
        id: 23,
        statusCode: 'SUBOWN',
      });

      const userService = testingModule.get<UserService>(UserService);
      (userService.getUserPermissions as jest.Mock).mockResolvedValue([
        'correspondence.edit',
      ]);

      await expect(
        service.update(2, { subject: 'Should Fail' }, mockUser)
      ).rejects.toThrow(PermissionException);
    });

    it('should NOT regenerate number if critical fields unchanged', async () => {
      const mockUser = { id: 1, primaryOrganizationId: 10 } as unknown as User;

      const mockCorr = {
        id: 1,
        projectId: 1,
        correspondenceTypeId: 2,
        disciplineId: 3,
        originatorId: 10,
        correspondenceNumber: 'OLD-NUM',
        recipients: [{ recipientType: 'TO', recipientOrganizationId: 99 }],
      };
      const mockRevision = {
        id: 100,
        correspondenceId: 1,
        isCurrent: true,
        statusId: 5,
        correspondence: mockCorr,
      };

      jest
        .spyOn(revisionRepo, 'findOne')
        .mockResolvedValue(mockRevision as unknown as CorrespondenceRevision);

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
      const mockCorr = {
        id: 1,
        projectId: 1,
        correspondenceTypeId: 2,
        disciplineId: 3,
        originatorId: 10,
        correspondenceNumber: 'OLD-NUM',
        recipients: [{ recipientType: 'TO', recipientOrganizationId: 99 }],
      };
      const mockRevision = {
        id: 100,
        correspondenceId: 1,
        isCurrent: true,
        statusId: 5,
        correspondence: mockCorr,
      };
      jest
        .spyOn(revisionRepo, 'findOne')
        .mockResolvedValue(mockRevision as unknown as CorrespondenceRevision);

      const statusRepo = testingModule.get<Repository<CorrespondenceStatus>>(
        getRepositoryToken(CorrespondenceStatus)
      );
      (statusRepo.findOne as jest.Mock).mockResolvedValue({
        id: 5,
        statusCode: 'DRAFT',
      });

      const typeRepo = testingModule.get<Repository<CorrespondenceType>>(
        getRepositoryToken(CorrespondenceType)
      );
      (typeRepo.findOne as jest.Mock).mockResolvedValue({
        id: 2,
        typeCode: 'OLD-TYPE',
      });

      const updateDto: UpdateCorrespondenceDto = {
        projectId: 2,
      };

      const uuidResolver =
        testingModule.get<UuidResolverService>(UuidResolverService);
      (uuidResolver.resolveProjectId as jest.Mock).mockResolvedValue(2);

      jest.spyOn(correspondenceRepo, 'findOne').mockResolvedValue({
        ...mockCorr,
        projectId: 2,
      } as unknown as Correspondence);

      await service.update(1, updateDto, mockUser);

      expect(
        numberingService.updateNumberForDraft as jest.Mock
      ).toHaveBeenCalled();
    });

    it('should regenerate number if Document Type changes', async () => {
      const mockUser = { id: 1, primaryOrganizationId: 10 } as unknown as User;
      const mockCorr = {
        id: 1,
        projectId: 1,
        correspondenceTypeId: 2,
        disciplineId: 3,
        originatorId: 10,
        correspondenceNumber: 'OLD-NUM',
        recipients: [{ recipientType: 'TO', recipientOrganizationId: 99 }],
      };
      const mockRevision = {
        id: 100,
        correspondenceId: 1,
        isCurrent: true,
        statusId: 5,
        correspondence: mockCorr,
      };
      jest
        .spyOn(revisionRepo, 'findOne')
        .mockResolvedValue(mockRevision as unknown as CorrespondenceRevision);

      const statusRepo = testingModule.get<Repository<CorrespondenceStatus>>(
        getRepositoryToken(CorrespondenceStatus)
      );
      (statusRepo.findOne as jest.Mock).mockResolvedValue({
        id: 5,
        statusCode: 'DRAFT',
      });

      const typeRepo = testingModule.get<Repository<CorrespondenceType>>(
        getRepositoryToken(CorrespondenceType)
      );
      (typeRepo.findOne as jest.Mock).mockResolvedValue({
        id: 999,
        typeCode: 'NEW-TYPE',
      });

      const updateDto: UpdateCorrespondenceDto = {
        typeId: 999,
      };

      jest.spyOn(correspondenceRepo, 'findOne').mockResolvedValue({
        ...mockCorr,
        correspondenceTypeId: 999,
      } as unknown as Correspondence);

      await service.update(1, updateDto, mockUser);

      expect(
        numberingService.updateNumberForDraft as jest.Mock
      ).toHaveBeenCalled();
    });

    it('should regenerate number if Recipient Organization changes', async () => {
      const mockUser = { id: 1, primaryOrganizationId: 10 } as unknown as User;
      const mockCorr = {
        id: 1,
        projectId: 1,
        correspondenceTypeId: 2,
        disciplineId: 3,
        originatorId: 10,
        correspondenceNumber: 'OLD-NUM',
        recipients: [{ recipientType: 'TO', recipientOrganizationId: 99 }],
      };
      const mockRevision = {
        id: 100,
        correspondenceId: 1,
        isCurrent: true,
        statusId: 5,
        correspondence: mockCorr,
      };
      jest
        .spyOn(revisionRepo, 'findOne')
        .mockResolvedValue(mockRevision as unknown as CorrespondenceRevision);

      const typeRepo = testingModule.get<Repository<CorrespondenceType>>(
        getRepositoryToken(CorrespondenceType)
      );
      (typeRepo.findOne as jest.Mock).mockResolvedValue({
        id: 2,
        typeCode: 'OLD-TYPE',
      });

      const statusRepo = testingModule.get<Repository<CorrespondenceStatus>>(
        getRepositoryToken(CorrespondenceStatus)
      );
      (statusRepo.findOne as jest.Mock).mockResolvedValue({
        id: 5,
        statusCode: 'DRAFT',
      });

      // Access DataSource manager for mocking
      mockDataSource.manager.findOne.mockResolvedValue({
        id: 88,
        organizationCode: 'NEW-ORG',
      } as unknown as Organization);

      const updateDto: UpdateCorrespondenceDto = {
        recipients: [{ type: 'TO', organizationId: 88 }],
      };

      jest.spyOn(correspondenceRepo, 'findOne').mockResolvedValue({
        ...mockCorr,
        recipients: [{ recipientType: 'TO', recipientOrganizationId: 88 }],
      } as unknown as Correspondence);

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
        expect.objectContaining({ revisionLabel: undefined })
      );
    });

    it('should set revisionLabel to undefined for MEMO type', async () => {
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
        expect.objectContaining({ revisionLabel: undefined })
      );
    });
  });

  // Regression: hardDelete เดิม SELECT a.public_id ซึ่ง column ไม่มีจริงในตาราง attachments
  // ทำให้ query พังทั้ง flow — ต้องใช้ a.uuid เท่านั้น
  describe('hardDelete (regression: attachments.uuid)', () => {
    const superadmin = { user_id: 99 } as unknown as User;

    const setupHardDeleteMocks = (): {
      queryRunner: {
        manager: { delete: jest.Mock; query: jest.Mock };
        commitTransaction: jest.Mock;
      };
    } => {
      const userService = testingModule.get<UserService>(UserService);
      (userService.getUserPermissions as jest.Mock).mockResolvedValue([
        'system.manage_all',
      ]);

      jest.spyOn(service, 'findOneByUuid').mockResolvedValue({
        id: 501,
        publicId: 'corr-uuid-hard',
        project: { publicId: 'proj-uuid-hard' },
      } as unknown as Awaited<ReturnType<typeof service.findOneByUuid>>);

      mockDataSource.query.mockResolvedValue([
        { id: 1, file_path: '/data/a.pdf', uuid: 'att-uuid-1' },
        { id: 2, file_path: '/data/b.pdf', uuid: 'att-uuid-2' },
      ]);

      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          delete: jest.fn().mockResolvedValue({ affected: 1 }),
          query: jest.fn().mockResolvedValue([]),
        },
      };
      (mockDataSource.createQueryRunner as jest.Mock).mockReturnValue(
        queryRunner
      );

      return { queryRunner };
    };

    it('ควร SELECT a.uuid (ไม่ใช่ a.public_id) ตอนดึง attachment rows', async () => {
      setupHardDeleteMocks();

      const result = await service.hardDelete('corr-uuid-hard', superadmin);

      const [sql, params] = mockDataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('a.uuid');
      expect(sql).not.toContain('a.public_id');
      expect(params).toEqual([501]);
      expect(result.deletedAttachmentCount).toBe(2);
      expect(result.deletedCorrespondence).toBe(true);
    });

    it('ควร enqueue vector deletion ด้วย publicId ของเอกสารและ project', async () => {
      setupHardDeleteMocks();
      const aiQueueService = testingModule.get<AiQueueService>(AiQueueService);

      const result = await service.hardDelete('corr-uuid-hard', superadmin);

      expect(aiQueueService.enqueueVectorDeletion).toHaveBeenCalledWith({
        documentPublicId: 'corr-uuid-hard',
        projectPublicId: 'proj-uuid-hard',
        requestedByUserPublicId: 'user-99',
      });
      expect(result.vectorDeletionJobsEnqueued).toBe(1);
    });

    it('ควรปฏิเสธเมื่อผู้ใช้ไม่มีสิทธิ์ system.manage_all', async () => {
      const userService = testingModule.get<UserService>(UserService);
      (userService.getUserPermissions as jest.Mock).mockResolvedValue([
        'correspondence.delete',
      ]);

      await expect(
        service.hardDelete('corr-uuid-hard', {
          user_id: 100,
        } as unknown as User)
      ).rejects.toThrow(PermissionException);
    });
  });

  describe('findAll', () => {
    it('should return paginated results from revision repo', async () => {
      const revisionRepoLocal = testingModule.get<
        Repository<CorrespondenceRevision>
      >(getRepositoryToken(CorrespondenceRevision));
      (revisionRepoLocal.createQueryBuilder as jest.Mock).mockReturnValueOnce({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 1]),
      });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([{ id: 1 }]);
      expect(result.meta.total).toBe(1);
    });

    it('should use default pagination when no params provided', async () => {
      const revisionRepoLocal = testingModule.get<
        Repository<CorrespondenceRevision>
      >(getRepositoryToken(CorrespondenceRevision));
      (revisionRepoLocal.createQueryBuilder as jest.Mock).mockReturnValueOnce({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });

      const result = await service.findAll();

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });
  });

  describe('findOne', () => {
    it('should return correspondence with workflow info when found', async () => {
      const mockCorr = { id: 1, publicId: 'uuid-1', subject: 'Test' };
      jest
        .spyOn(correspondenceRepo, 'findOne')
        .mockResolvedValue(mockCorr as never);

      const result = await service.findOne(1);

      expect(result).toEqual(
        expect.objectContaining({ id: 1, publicId: 'uuid-1' })
      );
    });

    it('should throw NotFoundException when not found', async () => {
      jest.spyOn(correspondenceRepo, 'findOne').mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow();
    });
  });

  describe('findOneByUuid', () => {
    it('should return correspondence with workflow info when found', async () => {
      const mockCorr = { id: 1, publicId: 'uuid-1', subject: 'Test' };
      (correspondenceRepo.createQueryBuilder as jest.Mock).mockReturnValueOnce({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockCorr),
      });

      const result = await service.findOneByUuid('uuid-1');

      expect(result).toEqual(
        expect.objectContaining({ id: 1, publicId: 'uuid-1' })
      );
    });

    it('should throw NotFoundException when not found', async () => {
      (correspondenceRepo.createQueryBuilder as jest.Mock).mockReturnValueOnce({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOneByUuid('uuid-999')).rejects.toThrow();
    });
  });

  describe('getReferences', () => {
    it('should return outgoing and incoming references', async () => {
      const refRepo = testingModule.get<Repository<CorrespondenceReference>>(
        getRepositoryToken(CorrespondenceReference)
      );
      const mockOutgoing = [{ id: 1, sourceId: 1, targetId: 10 }];
      const mockIncoming = [{ id: 2, sourceId: 5, targetId: 1 }];
      (refRepo.find as jest.Mock)
        .mockResolvedValueOnce(mockOutgoing)
        .mockResolvedValueOnce(mockIncoming);

      const result = await service.getReferences(1);

      expect(result.outgoing).toEqual(mockOutgoing);
      expect(result.incoming).toEqual(mockIncoming);
    });
  });

  describe('addReference', () => {
    it('should create and save a new reference', async () => {
      const refRepo = testingModule.get<Repository<CorrespondenceReference>>(
        getRepositoryToken(CorrespondenceReference)
      );
      jest
        .spyOn(correspondenceRepo, 'findOne')
        .mockResolvedValueOnce({ id: 1 } as never)
        .mockResolvedValueOnce({ id: 2, publicId: 'target-uuid' } as never);
      (refRepo.findOne as jest.Mock).mockResolvedValue(null);
      (refRepo.create as jest.Mock).mockReturnValue({
        sourceId: 1,
        targetId: 2,
      });
      (refRepo.save as jest.Mock).mockResolvedValue({
        id: 1,
        sourceId: 1,
        targetId: 2,
      });

      const result = await service.addReference(1, {
        targetUuid: 'target-uuid',
      } as never);

      expect(refRepo.save).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, sourceId: 1, targetId: 2 });
    });

    it('should return existing reference if already exists', async () => {
      const refRepo = testingModule.get<Repository<CorrespondenceReference>>(
        getRepositoryToken(CorrespondenceReference)
      );
      jest
        .spyOn(correspondenceRepo, 'findOne')
        .mockResolvedValueOnce({ id: 1 } as never)
        .mockResolvedValueOnce({ id: 2, publicId: 'target-uuid' } as never);
      const existingRef = { id: 99, sourceId: 1, targetId: 2 };
      (refRepo.findOne as jest.Mock).mockResolvedValue(existingRef);

      const result = await service.addReference(1, {
        targetUuid: 'target-uuid',
      } as never);

      expect(result).toEqual(existingRef);
      expect(refRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BusinessException for self-reference', async () => {
      jest
        .spyOn(correspondenceRepo, 'findOne')
        .mockResolvedValueOnce({ id: 1 } as never)
        .mockResolvedValueOnce({ id: 1, publicId: 'same-uuid' } as never);

      await expect(
        service.addReference(1, { targetUuid: 'same-uuid' } as never)
      ).rejects.toThrow();
    });

    it('should throw NotFoundException when source or target not found', async () => {
      jest.spyOn(correspondenceRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.addReference(1, { targetUuid: 'target-uuid' } as never)
      ).rejects.toThrow();
    });
  });

  describe('removeReference', () => {
    it('should delete the reference', async () => {
      const refRepo = testingModule.get<Repository<CorrespondenceReference>>(
        getRepositoryToken(CorrespondenceReference)
      );
      (refRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.removeReference(1, 2);

      expect(refRepo.delete).toHaveBeenCalledWith({ sourceId: 1, targetId: 2 });
    });

    it('should throw NotFoundException when no reference deleted', async () => {
      const refRepo = testingModule.get<Repository<CorrespondenceReference>>(
        getRepositoryToken(CorrespondenceReference)
      );
      (refRepo.delete as jest.Mock).mockResolvedValue({ affected: 0 });

      await expect(service.removeReference(1, 2)).rejects.toThrow();
    });
  });

  describe('getTags', () => {
    it('should return tags for a correspondence', async () => {
      const tagRepo = testingModule.get<Repository<CorrespondenceTag>>(
        getRepositoryToken(CorrespondenceTag)
      );
      const mockTags = [
        { id: 1, tagId: 10, tag: { id: 10, name: 'Important' } },
      ];
      (tagRepo.find as jest.Mock).mockResolvedValue(mockTags);

      const result = await service.getTags(1);

      expect(result).toEqual([{ id: 10, name: 'Important' }]);
    });

    it('should filter out falsy tags', async () => {
      const tagRepo = testingModule.get<Repository<CorrespondenceTag>>(
        getRepositoryToken(CorrespondenceTag)
      );
      (tagRepo.find as jest.Mock).mockResolvedValue([
        { id: 1, tagId: 10, tag: null },
      ]);

      const result = await service.getTags(1);

      expect(result).toEqual([]);
    });
  });

  describe('addTag', () => {
    it('should create and save a new tag association', async () => {
      const tagRepo = testingModule.get<Repository<CorrespondenceTag>>(
        getRepositoryToken(CorrespondenceTag)
      );
      jest
        .spyOn(correspondenceRepo, 'findOne')
        .mockResolvedValue({ id: 1 } as never);
      mockDataSource.manager.findOne.mockResolvedValue({
        id: 10,
        name: 'Important',
      });
      (tagRepo.findOne as jest.Mock).mockResolvedValue(null);
      (tagRepo.create as jest.Mock).mockReturnValue({
        correspondenceId: 1,
        tagId: 10,
      });
      (tagRepo.save as jest.Mock).mockResolvedValue({
        correspondenceId: 1,
        tagId: 10,
      });

      await service.addTag(1, 10);

      expect(tagRepo.save).toHaveBeenCalled();
    });

    it('should return existing tag if already associated', async () => {
      const tagRepo = testingModule.get<Repository<CorrespondenceTag>>(
        getRepositoryToken(CorrespondenceTag)
      );
      jest
        .spyOn(correspondenceRepo, 'findOne')
        .mockResolvedValue({ id: 1 } as never);
      mockDataSource.manager.findOne.mockResolvedValue({
        id: 10,
        name: 'Important',
      });
      const existing = { correspondenceId: 1, tagId: 10 };
      (tagRepo.findOne as jest.Mock).mockResolvedValue(existing);

      const result = await service.addTag(1, 10);

      expect(result).toEqual(existing);
      expect(tagRepo.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when correspondence not found', async () => {
      jest.spyOn(correspondenceRepo, 'findOne').mockResolvedValue(null);

      await expect(service.addTag(1, 10)).rejects.toThrow();
    });

    it('should throw NotFoundException when tag not found', async () => {
      jest
        .spyOn(correspondenceRepo, 'findOne')
        .mockResolvedValue({ id: 1 } as never);
      mockDataSource.manager.findOne.mockResolvedValue(null);

      await expect(service.addTag(1, 10)).rejects.toThrow();
    });
  });

  describe('removeTag', () => {
    it('should delete the tag association', async () => {
      const tagRepo = testingModule.get<Repository<CorrespondenceTag>>(
        getRepositoryToken(CorrespondenceTag)
      );
      (tagRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.removeTag(1, 10);

      expect(tagRepo.delete).toHaveBeenCalledWith({
        correspondenceId: 1,
        tagId: 10,
      });
    });

    it('should throw NotFoundException when no tag deleted', async () => {
      const tagRepo = testingModule.get<Repository<CorrespondenceTag>>(
        getRepositoryToken(CorrespondenceTag)
      );
      (tagRepo.delete as jest.Mock).mockResolvedValue({ affected: 0 });

      await expect(service.removeTag(1, 10)).rejects.toThrow();
    });
  });

  describe('previewDocumentNumber', () => {
    it('should return preview number from numbering service', async () => {
      const typeRepo = testingModule.get<Repository<CorrespondenceType>>(
        getRepositoryToken(CorrespondenceType)
      );
      const uuidResolver =
        testingModule.get<UuidResolverService>(UuidResolverService);
      const userService = testingModule.get<UserService>(UserService);

      (uuidResolver.resolveProjectId as jest.Mock).mockResolvedValue(1);
      (uuidResolver.resolveOrganizationId as jest.Mock).mockResolvedValue(20);
      (typeRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        typeCode: 'LTR',
      });
      (userService.findOne as jest.Mock).mockResolvedValue({
        primaryOrganizationId: 10,
      });
      mockDataSource.manager.findOne.mockResolvedValue({
        id: 20,
        organizationCode: 'REC',
      });
      (numberingService.previewNumber as jest.Mock).mockResolvedValue({
        number: 'PREVIEW-001',
      });

      const mockUser = {
        user_id: 1,
        primaryOrganizationId: 10,
      } as unknown as User;
      const createDto = {
        projectId: 'proj-uuid',
        typeId: 1,
        subject: 'Test',
        recipients: [{ organizationId: 'org-uuid', type: 'TO' }],
      } as CreateCorrespondenceDto;

      const result = await service.previewDocumentNumber(createDto, mockUser);

      expect(numberingService.previewNumber).toHaveBeenCalled();
      expect(result).toEqual({ number: 'PREVIEW-001' });
    });

    it('should throw NotFoundException when type not found', async () => {
      const typeRepo = testingModule.get<Repository<CorrespondenceType>>(
        getRepositoryToken(CorrespondenceType)
      );
      const uuidResolver =
        testingModule.get<UuidResolverService>(UuidResolverService);

      (uuidResolver.resolveProjectId as jest.Mock).mockResolvedValue(1);
      (typeRepo.findOne as jest.Mock).mockResolvedValue(null);

      const mockUser = {
        user_id: 1,
        primaryOrganizationId: 10,
      } as unknown as User;
      const createDto = {
        projectId: 'proj-uuid',
        typeId: 999,
        subject: 'Test',
        recipients: [{ organizationId: 'org-uuid', type: 'TO' }],
      } as CreateCorrespondenceDto;

      await expect(
        service.previewDocumentNumber(createDto, mockUser)
      ).rejects.toThrow();
    });
  });

  describe('cancel', () => {
    it('should cancel correspondence when user has permission', async () => {
      const userService = testingModule.get<UserService>(UserService);
      (userService.getUserPermissions as jest.Mock).mockResolvedValue([
        'correspondence.cancel',
      ]);

      jest.spyOn(service, 'findOneByUuid').mockResolvedValue({
        id: 1,
        publicId: 'corr-uuid-1',
        projectId: 1,
        correspondenceNumber: 'DOC-001',
        originatorId: 10,
      } as unknown as Awaited<ReturnType<typeof service.findOneByUuid>>);

      const statusRepo = testingModule.get<Repository<CorrespondenceStatus>>(
        getRepositoryToken(CorrespondenceStatus)
      );
      (statusRepo.findOne as jest.Mock).mockResolvedValue({
        id: 5,
        statusCode: 'CANCELLED',
      });

      const revisionRepoLocal = testingModule.get<
        Repository<CorrespondenceRevision>
      >(getRepositoryToken(CorrespondenceRevision));
      (revisionRepoLocal.findOne as jest.Mock).mockResolvedValue({
        id: 100,
        isCurrent: true,
        subject: 'Test',
      });

      const mockCircRepo = createMockRepository();
      mockCircRepo.find.mockResolvedValue([]);
      (mockDataSource.getRepository as jest.Mock).mockReturnValue(mockCircRepo);

      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        },
      };
      (mockDataSource.createQueryRunner as jest.Mock).mockReturnValue(
        queryRunner
      );

      const mockUser = {
        user_id: 1,
        primaryOrganizationId: 10,
      } as unknown as User;
      const result = await service.cancel(
        'corr-uuid-1',
        'Test reason',
        mockUser
      );

      expect(result.success).toBe(true);
    });

    it('should reject when user lacks permission', async () => {
      const userService = testingModule.get<UserService>(UserService);
      (userService.getUserPermissions as jest.Mock).mockResolvedValue([]);

      jest.spyOn(service, 'findOneByUuid').mockResolvedValue({
        id: 1,
        publicId: 'corr-uuid-1',
      } as unknown as Awaited<ReturnType<typeof service.findOneByUuid>>);

      const mockUser = {
        user_id: 1,
        primaryOrganizationId: 10,
      } as unknown as User;

      await expect(
        service.cancel('corr-uuid-1', 'Test reason', mockUser)
      ).rejects.toThrow(PermissionException);
    });
  });

  describe('bulkCancel', () => {
    it('should cancel multiple correspondences and report results', async () => {
      const userService = testingModule.get<UserService>(UserService);
      (userService.getUserPermissions as jest.Mock).mockResolvedValue([
        'system.manage_all',
      ]);

      jest.spyOn(service, 'findOneByUuid').mockResolvedValue({
        id: 1,
        publicId: 'corr-uuid-1',
        projectId: 1,
        correspondenceNumber: 'DOC-001',
        originatorId: 10,
      } as unknown as Awaited<ReturnType<typeof service.findOneByUuid>>);

      const statusRepo = testingModule.get<Repository<CorrespondenceStatus>>(
        getRepositoryToken(CorrespondenceStatus)
      );
      (statusRepo.findOne as jest.Mock).mockResolvedValue({
        id: 5,
        statusCode: 'CANCELLED',
      });

      const revisionRepoLocal = testingModule.get<
        Repository<CorrespondenceRevision>
      >(getRepositoryToken(CorrespondenceRevision));
      (revisionRepoLocal.findOne as jest.Mock).mockResolvedValue({
        id: 100,
        isCurrent: true,
        subject: 'Test',
      });

      const mockCircRepo = createMockRepository();
      mockCircRepo.find.mockResolvedValue([]);
      (mockDataSource.getRepository as jest.Mock).mockReturnValue(mockCircRepo);

      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        },
      };
      (mockDataSource.createQueryRunner as jest.Mock).mockReturnValue(
        queryRunner
      );

      const mockUser = {
        user_id: 1,
        primaryOrganizationId: 10,
      } as unknown as User;
      const result = await service.bulkCancel(
        ['corr-uuid-1', 'corr-uuid-2'],
        'Bulk cancel reason',
        mockUser
      );

      expect(result.succeeded).toContain('corr-uuid-1');
      expect(result.succeeded).toContain('corr-uuid-2');
    });

    it('should report failed cancellations', async () => {
      const userService = testingModule.get<UserService>(UserService);
      (userService.getUserPermissions as jest.Mock).mockResolvedValue([]);

      jest.spyOn(service, 'findOneByUuid').mockResolvedValue({
        id: 1,
        publicId: 'corr-uuid-1',
      } as unknown as Awaited<ReturnType<typeof service.findOneByUuid>>);

      const mockUser = {
        user_id: 1,
        primaryOrganizationId: 10,
      } as unknown as User;
      const result = await service.bulkCancel(
        ['corr-uuid-fail'],
        'Bulk cancel reason',
        mockUser
      );

      expect(result.failed).toContain('corr-uuid-fail');
    });
  });

  describe('exportCsv', () => {
    it('should return CSV string with headers', async () => {
      const revisionRepoLocal = testingModule.get<
        Repository<CorrespondenceRevision>
      >(getRepositoryToken(CorrespondenceRevision));
      (revisionRepoLocal.createQueryBuilder as jest.Mock).mockReturnValueOnce({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 1,
              revisionNumber: 0,
              subject: 'Test',
              createdAt: new Date('2026-01-01'),
              correspondence: {
                publicId: 'uuid-1',
                correspondenceNumber: 'DOC-001',
                type: { typeCode: 'LTR' },
                project: { projectCode: 'PROJ' },
                originator: { organizationCode: 'ORG' },
              },
              status: { statusCode: 'DRAFT' },
            },
          ],
          1,
        ]),
      });

      const result = await service.exportCsv({});

      expect(typeof result).toBe('string');
      expect(result).toContain('Document No.');
      expect(result).toContain('DOC-001');
    });

    it('should return CSV with only headers when no data', async () => {
      const revisionRepoLocal = testingModule.get<
        Repository<CorrespondenceRevision>
      >(getRepositoryToken(CorrespondenceRevision));
      (revisionRepoLocal.createQueryBuilder as jest.Mock).mockReturnValueOnce({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });

      const result = await service.exportCsv({});

      expect(typeof result).toBe('string');
      expect(result).toContain('Document No.');
    });
  });
});
