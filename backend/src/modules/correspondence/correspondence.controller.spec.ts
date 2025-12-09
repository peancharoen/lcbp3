import { Test, TestingModule } from '@nestjs/testing';
import { CorrespondenceController } from './correspondence.controller';
import { CorrespondenceService } from './correspondence.service';
import { CorrespondenceWorkflowService } from './correspondence-workflow.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';

describe('CorrespondenceController', () => {
  let controller: CorrespondenceController;
  let mockCorrespondenceService: Partial<CorrespondenceService>;
  let mockWorkflowService: Partial<CorrespondenceWorkflowService>;

  beforeEach(async () => {
    mockCorrespondenceService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getReferences: jest.fn(),
      addReference: jest.fn(),
      removeReference: jest.fn(),
    };

    mockWorkflowService = {
      submitWorkflow: jest.fn(),
      processAction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CorrespondenceController],
      providers: [
        {
          provide: CorrespondenceService,
          useValue: mockCorrespondenceService,
        },
        {
          provide: CorrespondenceWorkflowService,
          useValue: mockWorkflowService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CorrespondenceController>(CorrespondenceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return correspondences', async () => {
      const mockResult = [{ id: 1 }];
      (mockCorrespondenceService.findAll as jest.Mock).mockResolvedValue(
        mockResult
      );

      const result = await controller.findAll({});

      expect(mockCorrespondenceService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('create', () => {
    it('should create a correspondence', async () => {
      const mockCorr = { id: 1, correspondenceNumber: 'TEST-001' };
      (mockCorrespondenceService.create as jest.Mock).mockResolvedValue(
        mockCorr
      );

      const mockReq = { user: { user_id: 1 } };
      const createDto = {
        projectId: 1,
        typeId: 1,
        title: 'Test Subject',
      };

      const result = await controller.create(
        createDto as Parameters<typeof controller.create>[0],
        mockReq as Parameters<typeof controller.create>[1]
      );

      expect(mockCorrespondenceService.create).toHaveBeenCalledWith(
        createDto,
        mockReq.user
      );
    });
  });

  describe('submit', () => {
    it('should submit a correspondence to workflow', async () => {
      const mockResult = { instanceId: 'inst-1', currentState: 'IN_REVIEW' };
      (mockWorkflowService.submitWorkflow as jest.Mock).mockResolvedValue(
        mockResult
      );

      const mockReq = { user: { user_id: 1 } };
      const result = await controller.submit(
        1,
        { note: 'Test note' },
        mockReq as Parameters<typeof controller.submit>[2]
      );

      expect(mockWorkflowService.submitWorkflow).toHaveBeenCalledWith(
        1,
        1,
        'Test note'
      );
      expect(result).toEqual(mockResult);
    });
  });
});
