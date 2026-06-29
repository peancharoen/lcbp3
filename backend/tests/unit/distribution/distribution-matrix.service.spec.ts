// File: tests/unit/distribution/distribution-matrix.service.spec.ts
// Change Log
// - 2026-05-14: Add regression coverage for Distribution Matrix public-ID handling.
import { DistributionMatrixService } from '../../../src/modules/distribution/distribution-matrix.service';
import { DistributionMatrix } from '../../../src/modules/distribution/entities/distribution-matrix.entity';
import { DistributionRecipient } from '../../../src/modules/distribution/entities/distribution-recipient.entity';
import { Project } from '../../../src/modules/project/entities/project.entity';
import { ResponseCode } from '../../../src/modules/response-code/entities/response-code.entity';
import {
  DeliveryMethod,
  RecipientType,
} from '../../../src/modules/common/enums/review.enums';
import { Repository } from 'typeorm';

type RepositoryMock<T extends object> = {
  find: jest.MockedFunction<(options: unknown) => Promise<T[]>>;
  findOne: jest.MockedFunction<(options: unknown) => Promise<T | null>>;
  create: jest.MockedFunction<(payload: Partial<T>) => T>;
  save: jest.MockedFunction<(payload: T) => Promise<T>>;
  remove: jest.MockedFunction<(payload: T) => Promise<T>>;
};

const createRepositoryMock = <T extends object>(): RepositoryMock<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((payload: Partial<T>): T => payload as T),
  save: jest.fn((payload: T): Promise<T> => Promise.resolve(payload)),
  remove: jest.fn((payload: T): Promise<T> => Promise.resolve(payload)),
});

describe('DistributionMatrixService', () => {
  const matrixRepo = createRepositoryMock<DistributionMatrix>();
  const recipientRepo = createRepositoryMock<DistributionRecipient>();
  const projectRepo = createRepositoryMock<Project>();
  const responseCodeRepo = createRepositoryMock<ResponseCode>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a schema-aligned matrix by resolving public IDs internally', async () => {
    const service = new DistributionMatrixService(
      matrixRepo as unknown as Repository<DistributionMatrix>,
      recipientRepo as unknown as Repository<DistributionRecipient>,
      projectRepo as unknown as Repository<Project>,
      responseCodeRepo as unknown as Repository<ResponseCode>
    );
    matrixRepo.findOne.mockResolvedValue({
      id: 7,
      publicId: '019505a1-7c3e-7000-8000-000000000001',
    } as unknown as DistributionMatrix);
    projectRepo.findOne.mockResolvedValue({
      id: 7,
      publicId: '019505a1-7c3e-7000-8000-000000000001',
    } as Project);
    responseCodeRepo.findOne.mockResolvedValue({
      id: 9,
      publicId: '019505a1-7c3e-7000-8000-000000000002',
    } as ResponseCode);

    await service.create({
      name: 'Shop Drawing Distribution',
      projectPublicId: '019505a1-7c3e-7000-8000-000000000001',
      documentTypeId: 3,
      responseCodePublicId: '019505a1-7c3e-7000-8000-000000000002',
      conditions: { codes: ['1A', '1B'], excludeCodes: ['3'] },
    });

    expect(matrixRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Shop Drawing Distribution',
        projectId: 7,
        documentTypeId: 3,
        responseCodeId: 9,
        conditions: { codes: ['1A', '1B'], excludeCodes: ['3'] },
      })
    );
  });

  it('adds recipients with recipientPublicId instead of internal recipient ids', async () => {
    const service = new DistributionMatrixService(
      matrixRepo as unknown as Repository<DistributionMatrix>,
      recipientRepo as unknown as Repository<DistributionRecipient>,
      projectRepo as unknown as Repository<Project>,
      responseCodeRepo as unknown as Repository<ResponseCode>
    );
    matrixRepo.findOne.mockResolvedValue({
      id: 11,
      publicId: '019505a1-7c3e-7000-8000-000000000003',
    } as DistributionMatrix);

    await service.addRecipient('019505a1-7c3e-7000-8000-000000000003', {
      recipientType: RecipientType.ORGANIZATION,
      recipientPublicId: '019505a1-7c3e-7000-8000-000000000004',
      deliveryMethod: DeliveryMethod.BOTH,
      sequence: 1,
    });

    expect(recipientRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        matrixId: 11,
        recipientType: RecipientType.ORGANIZATION,
        recipientPublicId: '019505a1-7c3e-7000-8000-000000000004',
        deliveryMethod: DeliveryMethod.BOTH,
        sequence: 1,
      })
    );
  });
});
