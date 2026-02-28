import { Test, TestingModule } from '@nestjs/testing';
import { ManualOverrideService } from './manual-override.service';
import { CounterService } from './counter.service';
import { AuditService } from './audit.service';
import { ManualOverrideDto } from '../dto/manual-override.dto';

describe('ManualOverrideService', () => {
  let service: ManualOverrideService;
  let counterService: CounterService;
  let auditService: AuditService;

  const mockCounterService = {
    forceUpdateCounter: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManualOverrideService,
        { provide: CounterService, useValue: mockCounterService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ManualOverrideService>(ManualOverrideService);
    counterService = module.get<CounterService>(CounterService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should apply override and log audit', async () => {
    const dto: ManualOverrideDto = {
      projectId: 1,
      originatorOrganizationId: 2,
      recipientOrganizationId: 3,
      correspondenceTypeId: 4,
      subTypeId: 5,
      rfaTypeId: 6,
      disciplineId: 7,
      resetScope: 'YEAR_2024',
      newLastNumber: 999,
      reason: 'System sync',
      reference: 'TICKET-123',
    };
    const userId = 101;

    await service.applyOverride(dto, userId);

    expect(counterService.forceUpdateCounter).toHaveBeenCalledWith(dto, 999);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        generatedNumber: 'OVERRIDE-TO-999',
        operation: 'MANUAL_OVERRIDE',
        status: 'MANUAL',
        userId: userId,
        metadata: { reason: 'System sync', reference: 'TICKET-123' },
      })
    );
  });
});
