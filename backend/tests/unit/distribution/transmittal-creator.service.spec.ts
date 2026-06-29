// File: tests/unit/distribution/transmittal-creator.service.spec.ts
// Change Log
// - 2026-05-14: Add regression coverage for Distribution Matrix response-code filtering.
import { TransmittalCreatorService } from '../../../src/modules/distribution/services/transmittal-creator.service';
import { DistributionMatrix } from '../../../src/modules/distribution/entities/distribution-matrix.entity';
import { DistributionRecipient } from '../../../src/modules/distribution/entities/distribution-recipient.entity';
import { DocumentNumberingService } from '../../../src/modules/document-numbering/services/document-numbering.service';
import { DataSource, Repository } from 'typeorm';

type MatrixRepositoryMock = {
  findOne: jest.MockedFunction<
    (options: unknown) => Promise<DistributionMatrix | null>
  >;
};

describe('TransmittalCreatorService', () => {
  const matrixRepo: MatrixRepositoryMock = {
    findOne: jest.fn(),
  };
  const dataSource = {
    manager: {
      findOne: jest.fn(),
    },
    query: jest.fn(),
    createQueryRunner: jest.fn(),
  };
  const numberingService = {
    generateNextNumber: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips distribution when the response code is excluded', async () => {
    const service = new TransmittalCreatorService(
      matrixRepo as unknown as Repository<DistributionMatrix>,
      dataSource as unknown as DataSource,
      numberingService as unknown as DocumentNumberingService
    );
    matrixRepo.findOne.mockResolvedValue({
      conditions: { excludeCodes: ['3', '4'] },
      recipients: [{} as DistributionRecipient],
    } as DistributionMatrix);

    const result = await service.createFromDistribution({
      rfaPublicId: '019505a1-7c3e-7000-8000-000000000001',
      rfaRevisionPublicId: '019505a1-7c3e-7000-8000-000000000002',
      projectId: 1,
      documentTypeId: 2,
      responseCode: '3',
    });

    expect(result).toEqual({
      transmittalPublicIds: [],
      notificationTargets: [],
    });
  });
});
