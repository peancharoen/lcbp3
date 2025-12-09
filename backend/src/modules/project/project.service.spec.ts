import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectService } from './project.service';
import { Project } from './entities/project.entity';
import { Organization } from './entities/organization.entity';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockProjectRepository: Record<string, jest.Mock>;
  let mockOrganizationRepository: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockProjectRepository = {
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
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      })),
    };

    mockOrganizationRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: mockOrganizationRepository,
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated projects', async () => {
      const mockProjects = [
        {
          project_id: 1,
          project_code: 'PROJ-001',
          project_name: 'Test Project',
        },
      ];
      mockProjectRepository
        .createQueryBuilder()
        .getManyAndCount.mockResolvedValue([mockProjects, 1]);

      const result = await service.findAll({});

      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
    });
  });

  describe('findAllOrganizations', () => {
    it('should return all organizations', async () => {
      const mockOrgs = [{ organization_id: 1, name: 'Test Org' }];
      mockOrganizationRepository.find.mockResolvedValue(mockOrgs);

      const result = await service.findAllOrganizations();

      expect(mockOrganizationRepository.find).toHaveBeenCalled();
      expect(result).toEqual(mockOrgs);
    });
  });
});
