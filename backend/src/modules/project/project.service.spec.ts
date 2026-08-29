// File: backend/src/modules/project/project.service.spec.ts
// Change Log:
// - 2026-09-15: Extended with create, findOne, findOneByUuid, update, remove, findContracts tests + error paths

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectService } from './project.service';
import { Project } from './entities/project.entity';
import { OrganizationService } from '../organization/organization.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockProjectRepository: Record<string, jest.Mock>;
  let mockOrganizationService: Record<string, jest.Mock>;

  const createMockQB = (result: [unknown[], number] = [[], 0]) => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  });

  beforeEach(async () => {
    mockProjectRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(() => createMockQB()),
    };

    mockOrganizationService = {
      findAllActive: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
        {
          provide: OrganizationService,
          useValue: mockOrganizationService,
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a project when code does not exist', async () => {
      const dto = {
        projectCode: 'PROJ-001',
        projectName: 'Test Project',
      };
      mockProjectRepository.findOne.mockResolvedValue(null);
      mockProjectRepository.create.mockReturnValue({ id: 1, ...dto });
      mockProjectRepository.save.mockResolvedValue({ id: 1, ...dto });

      const result = await service.create(dto);

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { projectCode: 'PROJ-001' },
      });
      expect(mockProjectRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 1, ...dto });
    });

    it('should throw ConflictException when project code already exists', async () => {
      const dto = { projectCode: 'DUP', projectName: 'Dup' };
      mockProjectRepository.findOne.mockResolvedValue({ id: 1, ...dto });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockProjectRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated projects with default params', async () => {
      const mockProjects = [
        { id: 1, projectCode: 'P1', projectName: 'Project 1' },
      ];
      const qb = createMockQB([mockProjects, 1]);
      mockProjectRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockProjects);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should apply isActive filter when provided', async () => {
      const qb = createMockQB();
      mockProjectRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ isActive: true, page: 1, limit: 20 });

      expect(qb.andWhere).toHaveBeenCalledWith('project.isActive = :isActive', {
        isActive: true,
      });
    });

    it('should apply search filter when provided', async () => {
      const qb = createMockQB();
      mockProjectRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ search: 'test', page: 1, limit: 20 });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(project.projectCode LIKE :search OR project.projectName LIKE :search)',
        { search: '%test%' }
      );
    });

    it('should always filter out sandbox projects', async () => {
      const qb = createMockQB();
      mockProjectRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ page: 1, limit: 20 });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'project.isSandbox = :isSandbox',
        { isSandbox: false }
      );
    });
  });

  describe('findOne', () => {
    it('should return project when found', async () => {
      const mockProject = { id: 1, projectCode: 'P1', contracts: [] };
      mockProjectRepository.findOne.mockResolvedValue(mockProject);

      const result = await service.findOne(1);

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['contracts'],
      });
      expect(result).toEqual(mockProject);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneByUuid', () => {
    it('should return project when found by publicId', async () => {
      const mockProject = {
        id: 1,
        publicId: 'uuid-123',
        contracts: [],
      };
      mockProjectRepository.findOne.mockResolvedValue(mockProject);

      const result = await service.findOneByUuid('uuid-123');

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { publicId: 'uuid-123' },
        relations: ['contracts'],
      });
      expect(result).toEqual(mockProject);
    });

    it('should throw NotFoundException when project not found by publicId', async () => {
      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneByUuid('bad-uuid')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('update', () => {
    it('should update project successfully', async () => {
      const mockProject = {
        id: 1,
        publicId: 'uuid-123',
        isSandbox: false,
        projectName: 'Old',
      };
      mockProjectRepository.findOne.mockResolvedValue(mockProject);
      mockProjectRepository.merge.mockReturnValue({
        ...mockProject,
        projectName: 'New',
      });
      mockProjectRepository.save.mockResolvedValue({
        ...mockProject,
        projectName: 'New',
      });

      const result = await service.update('uuid-123', {
        projectName: 'New',
      } as never);

      expect(mockProjectRepository.merge).toHaveBeenCalled();
      expect(mockProjectRepository.save).toHaveBeenCalled();
      expect(result.projectName).toBe('New');
    });

    it('should throw BusinessException when changing isActive of sandbox project', async () => {
      const mockProject = {
        id: 1,
        publicId: 'uuid-123',
        isSandbox: true,
      };
      mockProjectRepository.findOne.mockResolvedValue(mockProject);

      await expect(
        service.update('uuid-123', { isActive: false } as never)
      ).rejects.toThrow(BusinessException);
      expect(mockProjectRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft remove project', async () => {
      const mockProject = { id: 1, publicId: 'uuid-123' };
      mockProjectRepository.findOne.mockResolvedValue(mockProject);
      mockProjectRepository.softRemove.mockResolvedValue(undefined);

      const result = await service.remove('uuid-123');

      expect(mockProjectRepository.softRemove).toHaveBeenCalledWith(
        mockProject
      );
      expect(result).toBeUndefined();
    });

    it('should throw NotFoundException when project not found for removal', async () => {
      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('bad-uuid')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findContracts', () => {
    it('should return contracts from project', async () => {
      const mockContracts = [
        { id: 1, contractNumber: 'C-001' },
        { id: 2, contractNumber: 'C-002' },
      ];
      mockProjectRepository.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-123',
        contracts: mockContracts,
      });

      const result = await service.findContracts('uuid-123');

      expect(result).toEqual(mockContracts);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(service.findContracts('bad-uuid')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findAllOrganizations', () => {
    it('should return all organizations', async () => {
      const mockOrgs = [{ organization_id: 1, name: 'Test Org' }];
      mockOrganizationService.findAllActive.mockResolvedValue(mockOrgs);

      const result = await service.findAllOrganizations();

      expect(mockOrganizationService.findAllActive).toHaveBeenCalled();
      expect(result).toEqual(mockOrgs);
    });
  });
});
