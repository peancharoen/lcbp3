// File: backend/src/modules/distribution/services/transmittal-creator.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ TransmittalCreatorService (T057, FR-019)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TransmittalCreatorService } from './transmittal-creator.service';
import { DistributionMatrix } from '../entities/distribution-matrix.entity';
import { DocumentNumberingService } from '../../document-numbering/services/document-numbering.service';
import { DeliveryMethod, RecipientType } from '../../common/enums/review.enums';

describe('TransmittalCreatorService', () => {
  let service: TransmittalCreatorService;
  let matrixRepo: { findOne: jest.Mock };
  let dataSource: {
    manager: { findOne: jest.Mock };
    query: jest.Mock;
    createQueryRunner: jest.Mock;
  };

  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      create: jest.fn((_: unknown, data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    },
  };

  const basePayload = {
    rfaPublicId: 'rfa-uuid-001',
    rfaRevisionPublicId: 'rev-uuid-001',
    projectId: 5,
    documentTypeId: 2,
    documentTypeCode: 'SHOP_DRAWING',
    responseCode: '1A',
  };

  beforeEach(async () => {
    matrixRepo = { findOne: jest.fn() };
    dataSource = {
      manager: { findOne: jest.fn() },
      query: jest.fn().mockResolvedValue([]),
      createQueryRunner: jest.fn(() => mockQueryRunner),
    };
    jest.clearAllMocks();
    // re-set defaults after clearAllMocks
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);
    mockQueryRunner.manager.create.mockImplementation(
      (_: unknown, data: unknown) => data
    );
    mockQueryRunner.manager.save.mockImplementation((entity: unknown) =>
      Promise.resolve(entity)
    );
    dataSource.query.mockResolvedValue([]);
    dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransmittalCreatorService,
        {
          provide: getRepositoryToken(DistributionMatrix),
          useValue: matrixRepo,
        },
        { provide: DataSource, useValue: dataSource },
        {
          provide: DocumentNumberingService,
          useValue: {
            generateNextNumber: jest
              .fn()
              .mockResolvedValue({ number: 'TRN-0001', auditId: 1 }),
          },
        },
      ],
    }).compile();
    service = module.get<TransmittalCreatorService>(TransmittalCreatorService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFromDistribution — early returns', () => {
    it('ควรคืน empty result เมื่อ documentTypeId missing', async () => {
      const result = await service.createFromDistribution({
        ...basePayload,
        documentTypeId: undefined,
      });
      expect(result.transmittalPublicIds).toEqual([]);
      expect(result.notificationTargets).toEqual([]);
      expect(matrixRepo.findOne).not.toHaveBeenCalled();
    });

    it('ควรคืน empty result เมื่อ matrix ไม่ถูกพบ', async () => {
      matrixRepo.findOne.mockResolvedValue(null);
      const result = await service.createFromDistribution(basePayload);
      expect(result.transmittalPublicIds).toEqual([]);
      expect(result.notificationTargets).toEqual([]);
    });

    it('ควรคืน empty result เมื่อ matrix ไม่มี recipients', async () => {
      matrixRepo.findOne.mockResolvedValue({
        id: 1,
        recipients: [],
        conditions: undefined,
      });
      const result = await service.createFromDistribution(basePayload);
      expect(result.transmittalPublicIds).toEqual([]);
    });

    it('ควรคืน empty result เมื่อ responseCode ไม่อยู่ใน conditions.codes', async () => {
      matrixRepo.findOne.mockResolvedValue({
        id: 1,
        recipients: [{ id: 1 }],
        conditions: { codes: ['1B', '2'] },
      });
      const result = await service.createFromDistribution(basePayload);
      expect(result.transmittalPublicIds).toEqual([]);
    });

    it('ควรคืน empty result เมื่อ responseCode อยู่ใน excludeCodes', async () => {
      matrixRepo.findOne.mockResolvedValue({
        id: 1,
        recipients: [{ id: 1 }],
        conditions: { excludeCodes: ['1A'] },
      });
      const result = await service.createFromDistribution(basePayload);
      expect(result.transmittalPublicIds).toEqual([]);
    });

    it('ควรคืน empty result เมื่อ source revision ไม่ถูกพบ', async () => {
      matrixRepo.findOne.mockResolvedValue({
        id: 1,
        recipients: [{ id: 1 }],
        conditions: undefined,
      });
      dataSource.manager.findOne.mockResolvedValue(null);
      const result = await service.createFromDistribution(basePayload);
      expect(result.transmittalPublicIds).toEqual([]);
    });

    it('ควรคืน empty result เมื่อ source revision ไม่มี correspondence', async () => {
      matrixRepo.findOne.mockResolvedValue({
        id: 1,
        recipients: [{ id: 1 }],
        conditions: undefined,
      });
      dataSource.manager.findOne.mockResolvedValue({ correspondence: null });
      const result = await service.createFromDistribution(basePayload);
      expect(result.transmittalPublicIds).toEqual([]);
    });
  });

  describe('createFromDistribution — response code filter pass-through', () => {
    it('ควรผ่านเงื่อนไขเมื่อ conditions.codes มี responseCode ตรง', async () => {
      matrixRepo.findOne.mockResolvedValue({
        id: 1,
        recipients: [
          {
            recipientType: RecipientType.ORGANIZATION,
            recipientPublicId: 'org-uuid-1',
            deliveryMethod: DeliveryMethod.EMAIL,
          },
        ],
        conditions: { codes: ['1A'] },
      });
      // source revision
      dataSource.manager.findOne
        .mockResolvedValueOnce({
          correspondence: {
            id: 100,
            publicId: 'corr-uuid-100',
            correspondenceNumber: 'RFA-001',
            originatorId: 10,
          },
        })
        // organization lookup
        .mockResolvedValueOnce({ id: 20, publicId: 'org-uuid-1' })
        // user lookup for notification targets (none since ORG)
        // CorrespondenceType
        .mockResolvedValueOnce({ id: 30, typeCode: 'TRN' })
        // CorrespondenceStatus
        .mockResolvedValueOnce({ id: 40, statusCode: 'DRAFT' });
      dataSource.query.mockResolvedValue([]);
      mockQueryRunner.manager.save.mockImplementation((entity) =>
        Promise.resolve({ ...entity, id: 999, publicId: 'trn-uuid-new' })
      );

      const result = await service.createFromDistribution(basePayload);
      expect(result.transmittalPublicIds).toHaveLength(1);
      expect(result.transmittalPublicIds[0]).toBe('trn-uuid-new');
    });
  });

  describe('createFromDistribution — no organization recipients resolved', () => {
    it('ควรคืน notificationTargets แต่ไม่สร้าง transmittal เมื่อไม่มี org recipients', async () => {
      matrixRepo.findOne.mockResolvedValue({
        id: 1,
        recipients: [
          {
            recipientType: RecipientType.ORGANIZATION,
            recipientPublicId: 'org-uuid-1',
            deliveryMethod: DeliveryMethod.IN_APP,
          },
        ],
        conditions: undefined,
      });
      dataSource.manager.findOne
        .mockResolvedValueOnce({
          correspondence: {
            id: 100,
            publicId: 'corr-uuid-100',
            correspondenceNumber: 'RFA-001',
            originatorId: 10,
          },
        })
        // organization lookup returns null (IN_APP returns undefined directly)
        .mockResolvedValueOnce(null);

      const result = await service.createFromDistribution(basePayload);
      expect(result.transmittalPublicIds).toEqual([]);
      // IN_APP recipients don't resolve to org, so notificationTargets empty too
      expect(result.notificationTargets).toEqual([]);
    });
  });

  describe('createFromDistribution — existing transmittal found', () => {
    it('ควรใช้ existing publicId เมื่อเจอ transmittal เดิม', async () => {
      matrixRepo.findOne.mockResolvedValue({
        id: 1,
        recipients: [
          {
            recipientType: RecipientType.ORGANIZATION,
            recipientPublicId: 'org-uuid-1',
            deliveryMethod: DeliveryMethod.EMAIL,
          },
        ],
        conditions: undefined,
      });
      dataSource.manager.findOne
        .mockResolvedValueOnce({
          correspondence: {
            id: 100,
            publicId: 'corr-uuid-100',
            correspondenceNumber: 'RFA-001',
            originatorId: 10,
          },
        })
        .mockResolvedValueOnce({ id: 20, publicId: 'org-uuid-1' });
      dataSource.query.mockResolvedValue([{ publicId: 'existing-trn-uuid' }]);

      const result = await service.createFromDistribution(basePayload);
      expect(result.transmittalPublicIds).toEqual(['existing-trn-uuid']);
      // ไม่ควรสร้างใหม่
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });
  });

  describe('createFromDistribution — create draft transmittal', () => {
    beforeEach(() => {
      matrixRepo.findOne.mockResolvedValue({
        id: 1,
        recipients: [
          {
            recipientType: RecipientType.ORGANIZATION,
            recipientPublicId: 'org-uuid-1',
            deliveryMethod: DeliveryMethod.EMAIL,
          },
        ],
        conditions: undefined,
      });
      dataSource.manager.findOne
        .mockResolvedValueOnce({
          correspondence: {
            id: 100,
            publicId: 'corr-uuid-100',
            correspondenceNumber: 'RFA-001',
            originatorId: 10,
          },
        })
        .mockResolvedValueOnce({ id: 20, publicId: 'org-uuid-1' })
        .mockResolvedValueOnce({ id: 30, typeCode: 'TRN' })
        .mockResolvedValueOnce({ id: 40, statusCode: 'DRAFT' });
      dataSource.query.mockResolvedValue([]);
    });

    it('ควรสร้าง transmittal ใหม่และคืน publicId', async () => {
      mockQueryRunner.manager.save.mockImplementation((entity) =>
        Promise.resolve({ ...entity, id: 999, publicId: 'trn-uuid-new' })
      );

      const result = await service.createFromDistribution(basePayload);
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result.transmittalPublicIds).toEqual(['trn-uuid-new']);
    });

    it('ควร rollback เมื่อ save ล้มเหลว', async () => {
      mockQueryRunner.manager.save.mockRejectedValueOnce(
        new Error('DB write failed')
      );

      await expect(service.createFromDistribution(basePayload)).rejects.toThrow(
        'DB write failed'
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('ควรคืน undefined เมื่อไม่มี CorrespondenceType', async () => {
      dataSource.manager.findOne
        .mockReset()
        .mockResolvedValueOnce({
          correspondence: {
            id: 100,
            publicId: 'corr-uuid-100',
            correspondenceNumber: 'RFA-001',
            originatorId: 10,
          },
        })
        .mockResolvedValueOnce({ id: 20, publicId: 'org-uuid-1' })
        .mockResolvedValueOnce(null) // CorrespondenceType
        .mockResolvedValueOnce({ id: 40, statusCode: 'DRAFT' });

      const result = await service.createFromDistribution(basePayload);
      expect(result.transmittalPublicIds).toEqual([]);
    });

    it('ควรคืน undefined เมื่อไม่มี CorrespondenceStatus', async () => {
      dataSource.manager.findOne
        .mockReset()
        .mockResolvedValueOnce({
          correspondence: {
            id: 100,
            publicId: 'corr-uuid-100',
            correspondenceNumber: 'RFA-001',
            originatorId: 10,
          },
        })
        .mockResolvedValueOnce({ id: 20, publicId: 'org-uuid-1' })
        .mockResolvedValueOnce({ id: 30, typeCode: 'TRN' })
        .mockResolvedValueOnce(null); // CorrespondenceStatus

      const result = await service.createFromDistribution(basePayload);
      expect(result.transmittalPublicIds).toEqual([]);
    });

    it('ควรคืน undefined เมื่อ sourceCorrespondence ไม่มี originatorId', async () => {
      dataSource.manager.findOne
        .mockReset()
        .mockResolvedValueOnce({
          correspondence: {
            id: 100,
            publicId: 'corr-uuid-100',
            correspondenceNumber: 'RFA-001',
            originatorId: undefined,
          },
        })
        .mockResolvedValueOnce({ id: 20, publicId: 'org-uuid-1' })
        .mockResolvedValueOnce({ id: 30, typeCode: 'TRN' })
        .mockResolvedValueOnce({ id: 40, statusCode: 'DRAFT' });

      const result = await service.createFromDistribution(basePayload);
      expect(result.transmittalPublicIds).toEqual([]);
    });
  });

  describe('createFromDistribution — notification targets (USER recipients)', () => {
    it('ควร resolve notificationTargets สำหรับ USER recipients', async () => {
      matrixRepo.findOne.mockResolvedValue({
        id: 1,
        recipients: [
          {
            recipientType: RecipientType.USER,
            recipientPublicId: 'user-uuid-1',
            deliveryMethod: DeliveryMethod.EMAIL,
          },
        ],
        conditions: undefined,
      });
      dataSource.manager.findOne
        .mockResolvedValueOnce({
          correspondence: {
            id: 100,
            publicId: 'corr-uuid-100',
            correspondenceNumber: 'RFA-001',
            originatorId: 10,
          },
        })
        // resolveRecipientOrganizationId → USER path
        .mockResolvedValueOnce({ user_id: 50, primaryOrganizationId: 20 })
        // resolveNotificationTargets → USER path
        .mockResolvedValueOnce({ user_id: 50, primaryOrganizationId: 20 })
        // CorrespondenceType
        .mockResolvedValueOnce({ id: 30, typeCode: 'TRN' })
        // CorrespondenceStatus
        .mockResolvedValueOnce({ id: 40, statusCode: 'DRAFT' });
      dataSource.query.mockResolvedValue([]);
      mockQueryRunner.manager.save.mockImplementation((entity) =>
        Promise.resolve({ ...entity, id: 999, publicId: 'trn-uuid-new' })
      );

      const result = await service.createFromDistribution(basePayload);
      expect(result.notificationTargets).toHaveLength(1);
      expect(result.notificationTargets[0].userId).toBe(50);
      expect(result.notificationTargets[0].deliveryMethod).toBe(
        DeliveryMethod.EMAIL
      );
    });

    it('ควรข้าม USER recipient เมื่อไม่พบ user', async () => {
      matrixRepo.findOne.mockResolvedValue({
        id: 1,
        recipients: [
          {
            recipientType: RecipientType.USER,
            recipientPublicId: 'user-uuid-missing',
            deliveryMethod: DeliveryMethod.EMAIL,
          },
        ],
        conditions: undefined,
      });
      dataSource.manager.findOne
        .mockResolvedValueOnce({
          correspondence: {
            id: 100,
            publicId: 'corr-uuid-100',
            correspondenceNumber: 'RFA-001',
            originatorId: 10,
          },
        })
        // resolveRecipientOrganizationId → USER path returns null
        .mockResolvedValueOnce(null)
        // resolveNotificationTargets → USER path returns null
        .mockResolvedValueOnce(null);

      const result = await service.createFromDistribution(basePayload);
      expect(result.notificationTargets).toEqual([]);
      expect(result.transmittalPublicIds).toEqual([]);
    });
  });

  describe('createFromDistribution — TEAM/ROLE recipients', () => {
    it('ควรข้าม recipient ที่เป็น TEAM และคืน empty org ids', async () => {
      matrixRepo.findOne.mockResolvedValue({
        id: 1,
        recipients: [
          {
            recipientType: RecipientType.TEAM,
            recipientPublicId: 'team-uuid-1',
            deliveryMethod: DeliveryMethod.EMAIL,
          },
        ],
        conditions: undefined,
      });
      dataSource.manager.findOne.mockResolvedValueOnce({
        correspondence: {
          id: 100,
          publicId: 'corr-uuid-100',
          correspondenceNumber: 'RFA-001',
          originatorId: 10,
        },
      });

      const result = await service.createFromDistribution(basePayload);
      expect(result.transmittalPublicIds).toEqual([]);
    });
  });
});
