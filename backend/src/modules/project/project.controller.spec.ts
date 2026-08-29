// File: backend/src/modules/project/project.controller.spec.ts
// Change Log:
// - 2026-09-15: Extended with create, findOne, update, remove, findContracts endpoint tests + error paths

import { Test, TestingModule } from '@nestjs/testing';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SearchProjectDto } from './dto/search-project.dto';

describe('ProjectController', () => {
  let controller: ProjectController;
  let mockProjectService: Partial<ProjectService>;

  beforeEach(async () => {
    mockProjectService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findOneByUuid: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findContracts: jest.fn(),
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

  describe('create', () => {
    it('should call projectService.create with DTO', async () => {
      const dto: CreateProjectDto = {
        projectCode: 'PROJ-001',
        projectName: 'Test Project',
      } as CreateProjectDto;
      const mockResult = { id: 1, ...dto };
      (mockProjectService.create as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.create(dto);

      expect(mockProjectService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResult);
    });

    it('should propagate error when create fails', async () => {
      const dto = { projectCode: 'DUP' } as CreateProjectDto;
      (mockProjectService.create as jest.Mock).mockRejectedValue(
        new Error('Project Code already exists')
      );

      await expect(controller.create(dto)).rejects.toThrow(
        'Project Code already exists'
      );
    });
  });

  describe('findAll', () => {
    it('should call projectService.findAll with search DTO', async () => {
      const searchDto: SearchProjectDto = { page: 1, limit: 10 };
      const mockResult = { data: [], meta: { total: 0, page: 1, limit: 10 } };
      (mockProjectService.findAll as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.findAll(searchDto);

      expect(mockProjectService.findAll).toHaveBeenCalledWith(searchDto);
      expect(result).toEqual(mockResult);
    });

    it('should call findAll with empty search DTO', async () => {
      const mockResult = { data: [], meta: {} };
      (mockProjectService.findAll as jest.Mock).mockResolvedValue(mockResult);

      await controller.findAll({} as SearchProjectDto);

      expect(mockProjectService.findAll).toHaveBeenCalledWith(
        {} as SearchProjectDto
      );
    });
  });

  describe('findAllOrgs', () => {
    it('should call projectService.findAllOrganizations', async () => {
      const mockOrgs = [{ organization_id: 1, name: 'Test Org' }];
      (mockProjectService.findAllOrganizations as jest.Mock).mockResolvedValue(
        mockOrgs
      );

      const result = await controller.findAllOrgs();

      expect(mockProjectService.findAllOrganizations).toHaveBeenCalled();
      expect(result).toEqual(mockOrgs);
    });

    it('should propagate error when findAllOrganizations fails', async () => {
      (mockProjectService.findAllOrganizations as jest.Mock).mockRejectedValue(
        new Error('DB error')
      );

      await expect(controller.findAllOrgs()).rejects.toThrow('DB error');
    });
  });

  describe('findContracts', () => {
    it('should call projectService.findContracts with uuid', async () => {
      const mockContracts = [
        { id: 1, contractNumber: 'C-001' },
        { id: 2, contractNumber: 'C-002' },
      ];
      (mockProjectService.findContracts as jest.Mock).mockResolvedValue(
        mockContracts
      );

      const result = await controller.findContracts('uuid-123');

      expect(mockProjectService.findContracts).toHaveBeenCalledWith('uuid-123');
      expect(result).toEqual(mockContracts);
    });

    it('should propagate error when findContracts fails', async () => {
      (mockProjectService.findContracts as jest.Mock).mockRejectedValue(
        new Error('Project not found')
      );

      await expect(controller.findContracts('bad-uuid')).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('findOne', () => {
    it('should call projectService.findOneByUuid with uuid', async () => {
      const mockProject = { id: 1, publicId: 'uuid-123', projectCode: 'P1' };
      (mockProjectService.findOneByUuid as jest.Mock).mockResolvedValue(
        mockProject
      );

      const result = await controller.findOne('uuid-123');

      expect(mockProjectService.findOneByUuid).toHaveBeenCalledWith('uuid-123');
      expect(result).toEqual(mockProject);
    });

    it('should propagate error when project not found', async () => {
      (mockProjectService.findOneByUuid as jest.Mock).mockRejectedValue(
        new Error('Project not found')
      );

      await expect(controller.findOne('bad-uuid')).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('update', () => {
    it('should call projectService.update with uuid and DTO', async () => {
      const dto: UpdateProjectDto = { projectName: 'Updated' };
      const mockResult = { id: 1, projectName: 'Updated' };
      (mockProjectService.update as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.update('uuid-123', dto);

      expect(mockProjectService.update).toHaveBeenCalledWith('uuid-123', dto);
      expect(result).toEqual(mockResult);
    });

    it('should propagate error when update fails', async () => {
      (mockProjectService.update as jest.Mock).mockRejectedValue(
        new Error('Sandbox locked')
      );

      await expect(
        controller.update('uuid-123', { projectName: 'X' } as UpdateProjectDto)
      ).rejects.toThrow('Sandbox locked');
    });
  });

  describe('remove', () => {
    it('should call projectService.remove with uuid', async () => {
      (mockProjectService.remove as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.remove('uuid-123');

      expect(mockProjectService.remove).toHaveBeenCalledWith('uuid-123');
      expect(result).toBeUndefined();
    });

    it('should propagate error when remove fails', async () => {
      (mockProjectService.remove as jest.Mock).mockRejectedValue(
        new Error('Cannot delete')
      );

      await expect(controller.remove('uuid-123')).rejects.toThrow(
        'Cannot delete'
      );
    });
  });
});
