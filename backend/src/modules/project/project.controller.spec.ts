import { Test, TestingModule } from '@nestjs/testing';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';

describe('ProjectController', () => {
  let controller: ProjectController;
  let mockProjectService: Partial<ProjectService>;

  beforeEach(async () => {
    mockProjectService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findAllOrganizations: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        {
          provide: ProjectService,
          useValue: mockProjectService,
        },
      ],
    })
      // Override guards to avoid dependency issues
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProjectController>(ProjectController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call projectService.findAll', async () => {
      const mockResult = { data: [], meta: {} };
      (mockProjectService.findAll as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.findAll({});

      expect(mockProjectService.findAll).toHaveBeenCalled();
    });
  });

  describe('findAllOrganizations', () => {
    it('should call projectService.findAllOrganizations', async () => {
      const mockOrgs = [{ organization_id: 1, name: 'Test Org' }];
      (mockProjectService.findAllOrganizations as jest.Mock).mockResolvedValue(
        mockOrgs
      );

      const result = await controller.findAllOrgs();

      expect(mockProjectService.findAllOrganizations).toHaveBeenCalled();
    });
  });
});
