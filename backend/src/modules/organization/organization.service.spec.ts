// File: backend/src/modules/organization/organization.service.spec.ts
// Change Log:
// - 2026-06-20: Initial creation — unit tests สำหรับ OrganizationService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

/**
 * Helper สร้าง mock QueryBuilder ที่ support chaining
 */
function createMockQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
  return qb;
}

describe('OrganizationService', () => {
  let service: OrganizationService;
  let mockOrgRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockOrgRepo = {
      findOne: jest.fn(),
      create: jest.fn((data: unknown) => data),
      save: jest.fn(),
      remove: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: getRepositoryToken(Organization),
          useValue: mockOrgRepo,
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new organization', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);
      const dto: CreateOrganizationDto = {
        organizationCode: 'ITD',
        organizationName: 'Italian-Thai Development',
      };
      const savedOrg = { id: 1, ...dto };
      mockOrgRepo.save.mockResolvedValue(savedOrg);

      const result = await service.create(dto);

      expect(mockOrgRepo.findOne).toHaveBeenCalledWith({
        where: { organizationCode: 'ITD' },
      });
      expect(mockOrgRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(savedOrg);
    });

    it('should throw ConflictException when code already exists', async () => {
      mockOrgRepo.findOne.mockResolvedValue({
        id: 1,
        organizationCode: 'ITD',
      });

      await expect(
        service.create({
          organizationCode: 'ITD',
          organizationName: 'Test',
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated organizations with defaults', async () => {
      const mockOrgs = [{ id: 1, organizationCode: 'ITD' }];
      const qb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([mockOrgs, 1]),
      });
      mockOrgRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll();

      expect(result.data).toEqual(mockOrgs);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(100);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should apply search filter', async () => {
      const qb = createMockQueryBuilder();
      mockOrgRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ search: 'ITD' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(org.organizationCode LIKE :search OR org.organizationName LIKE :search)',
        { search: '%ITD%' }
      );
    });

    it('should apply roleId filter', async () => {
      const qb = createMockQueryBuilder();
      mockOrgRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ roleId: 3 });

      expect(qb.andWhere).toHaveBeenCalledWith('org.roleId = :roleId', {
        roleId: 3,
      });
    });

    it('should apply projectId filter with inner join', async () => {
      const qb = createMockQueryBuilder();
      mockOrgRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ projectId: 5 });

      expect(qb.innerJoin).toHaveBeenCalledWith(
        'project_organizations',
        'po',
        'po.organization_id = org.id AND po.project_id = :projectId',
        { projectId: 5 }
      );
    });

    it('should use custom page and limit', async () => {
      const qb = createMockQueryBuilder();
      mockOrgRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('should calculate totalPages correctly', async () => {
      const qb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 25]),
      });
      mockOrgRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });

    it('should apply all filters together', async () => {
      const qb = createMockQueryBuilder();
      mockOrgRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ search: 'test', roleId: 2, projectId: 5 });

      expect(qb.andWhere).toHaveBeenCalledTimes(2);
      expect(qb.innerJoin).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return an organization by id', async () => {
      const mockOrg = { id: 1, organizationCode: 'ITD' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);

      const result = await service.findOne(1);

      expect(mockOrgRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockOrg);
    });

    it('should throw NotFoundException when not found', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneByUuid', () => {
    it('should return an organization by publicId', async () => {
      const mockOrg = { id: 1, publicId: 'uuid-1', organizationCode: 'ITD' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);

      const result = await service.findOneByUuid('uuid-1');

      expect(mockOrgRepo.findOne).toHaveBeenCalledWith({
        where: { publicId: 'uuid-1' },
      });
      expect(result).toEqual(mockOrg);
    });

    it('should throw NotFoundException when not found', async () => {
      mockOrgRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneByUuid('nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('update', () => {
    it('should update and save an organization', async () => {
      const existingOrg = {
        id: 1,
        publicId: 'uuid-1',
        organizationCode: 'ITD',
        organizationName: 'Old Name',
      };
      mockOrgRepo.findOne.mockResolvedValue(existingOrg);
      mockOrgRepo.save.mockResolvedValue({
        ...existingOrg,
        organizationName: 'New Name',
      });

      const dto: UpdateOrganizationDto = { organizationName: 'New Name' };
      const result = await service.update('uuid-1', dto);

      expect(mockOrgRepo.save).toHaveBeenCalled();
      expect(result.organizationName).toBe('New Name');
    });
  });

  describe('remove', () => {
    it('should remove an organization', async () => {
      const mockOrg = { id: 1, publicId: 'uuid-1' };
      mockOrgRepo.findOne.mockResolvedValue(mockOrg);
      mockOrgRepo.remove.mockResolvedValue(undefined);

      await service.remove('uuid-1');

      expect(mockOrgRepo.remove).toHaveBeenCalledWith(mockOrg);
    });
  });

  describe('findAllActive', () => {
    it('should return all active organizations', async () => {
      const mockOrgs = [
        { id: 1, organizationCode: 'ITD', isActive: true },
        { id: 2, organizationCode: 'ITC', isActive: true },
      ];
      mockOrgRepo.find.mockResolvedValue(mockOrgs);

      const result = await service.findAllActive();

      expect(mockOrgRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { organizationCode: 'ASC' },
      });
      expect(result).toEqual(mockOrgs);
    });
  });
});
