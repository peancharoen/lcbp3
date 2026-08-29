// File: src/modules/review-team/review-team.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ ReviewTeamService (FR-001, FR-002)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ReviewTeamService } from './review-team.service';
import { ReviewTeam } from './entities/review-team.entity';
import { ReviewTeamMember } from './entities/review-team-member.entity';
import { User } from '../user/entities/user.entity';
import { Discipline } from '../master/entities/discipline.entity';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import {
  CreateReviewTeamDto,
  UpdateReviewTeamDto,
  AddTeamMemberDto,
  SearchReviewTeamDto,
} from './dto/shared/review-team.dto';
import { ReviewTeamMemberRole } from '../common/enums/review.enums';

describe('ReviewTeamService', () => {
  let service: ReviewTeamService;

  const mockTeamRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockMemberRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const mockUserRepo = {
    findOne: jest.fn(),
  };
  const mockDisciplineRepo = {
    findOne: jest.fn(),
  };
  const mockUuidResolver = {
    resolveProjectId: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewTeamService,
        {
          provide: getRepositoryToken(ReviewTeam),
          useValue: mockTeamRepo,
        },
        {
          provide: getRepositoryToken(ReviewTeamMember),
          useValue: mockMemberRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(Discipline),
          useValue: mockDisciplineRepo,
        },
        {
          provide: UuidResolverService,
          useValue: mockUuidResolver,
        },
      ],
    }).compile();

    service = module.get<ReviewTeamService>(ReviewTeamService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    const mockQB = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    it('ควรคืน teams ทั้งหมดโดยไม่มี filter', async () => {
      const teams = [{ id: 1, name: 'Team A' }];
      mockQB.getMany.mockResolvedValue(teams);
      mockTeamRepo.createQueryBuilder.mockReturnValue(mockQB);

      const result = await service.findAll({});

      expect(result).toEqual(teams);
    });

    it('ควรกรองด้วย projectPublicId, isActive และ search', async () => {
      mockQB.getMany.mockResolvedValue([]);
      mockTeamRepo.createQueryBuilder.mockReturnValue(mockQB);

      const dto: SearchReviewTeamDto = {
        projectPublicId: 'uuid-proj-1',
        isActive: true,
        search: 'Team',
      };

      await service.findAll(dto);

      expect(mockQB.innerJoin).toHaveBeenCalledWith('team.project', 'project');
      expect(mockQB.where).toHaveBeenCalledWith('project.uuid = :uuid', {
        uuid: 'uuid-proj-1',
      });
      expect(mockQB.andWhere).toHaveBeenCalledWith(
        'team.is_active = :isActive',
        { isActive: true }
      );
      expect(mockQB.andWhere).toHaveBeenCalledWith('team.name LIKE :search', {
        search: '%Team%',
      });
    });
  });

  describe('findByPublicId', () => {
    it('ควรคืน team ตาม publicId', async () => {
      const team = { id: 1, publicId: 'uuid-001', name: 'Team A' };
      mockTeamRepo.findOne.mockResolvedValue(team);

      const result = await service.findByPublicId('uuid-001');

      expect(result).toEqual(team);
      expect(mockTeamRepo.findOne).toHaveBeenCalledWith({
        where: { publicId: 'uuid-001' },
        relations: ['members', 'members.user', 'members.discipline', 'project'],
      });
    });

    it('ควร throw NotFoundException เมื่อไม่พบ', async () => {
      mockTeamRepo.findOne.mockResolvedValue(null);

      await expect(service.findByPublicId('not-found')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findDefaultForRfaType', () => {
    it('ควรคืน teams ที่เป็น default สำหรับ RFA type นั้น', async () => {
      const teams: Partial<ReviewTeam>[] = [
        { id: 1, defaultForRfaTypes: ['SDW', 'DDW'], isActive: true },
        { id: 2, defaultForRfaTypes: ['DDW'], isActive: true },
      ];
      mockTeamRepo.find.mockResolvedValue(teams);

      const result = await service.findDefaultForRfaType('SDW', 1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('ควรคืน empty array เมื่อไม่มี team ที่ match', async () => {
      const teams: Partial<ReviewTeam>[] = [
        { id: 1, defaultForRfaTypes: ['DDW'], isActive: true },
      ];
      mockTeamRepo.find.mockResolvedValue(teams);

      const result = await service.findDefaultForRfaType('SDW', 1);

      expect(result).toHaveLength(0);
    });

    it('ควรจัดการเมื่อ defaultForRfaTypes เป็น undefined', async () => {
      const teams: Partial<ReviewTeam>[] = [
        { id: 1, defaultForRfaTypes: undefined, isActive: true },
      ];
      mockTeamRepo.find.mockResolvedValue(teams);

      const result = await service.findDefaultForRfaType('SDW', 1);

      expect(result).toHaveLength(0);
    });
  });

  describe('create', () => {
    it('ควรสร้าง review team ใหม่', async () => {
      const dto: CreateReviewTeamDto = {
        name: 'Team A',
        description: 'Test team',
        projectPublicId: 'uuid-proj-1',
        defaultForRfaTypes: ['SDW'],
      };
      const created = { id: 1, name: 'Team A', projectId: 1, isActive: true };
      mockTeamRepo.create.mockReturnValue(created);
      mockTeamRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(mockUuidResolver.resolveProjectId).toHaveBeenCalledWith(
        'uuid-proj-1'
      );
      expect(mockTeamRepo.create).toHaveBeenCalledWith({
        name: 'Team A',
        description: 'Test team',
        projectId: 1,
        defaultForRfaTypes: ['SDW'],
        isActive: true,
      });
      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    it('ควรอัปเดต team ได้', async () => {
      const team = {
        id: 1,
        publicId: 'uuid-001',
        name: 'Old',
        description: 'Old desc',
        isActive: true,
      };
      mockTeamRepo.findOne.mockResolvedValue(team);
      mockTeamRepo.save.mockImplementation(
        (entity: Record<string, unknown>) => ({
          ...entity,
          name: 'New',
        })
      );

      const dto: UpdateReviewTeamDto = {
        name: 'New',
        isActive: false,
      };

      const result = await service.update('uuid-001', dto);

      expect(result.name).toBe('New');
      expect(result.isActive).toBe(false);
    });
  });

  describe('addMember', () => {
    const dto: AddTeamMemberDto = {
      userPublicId: 'uuid-user-1',
      disciplineId: 5,
      role: ReviewTeamMemberRole.REVIEWER,
    };

    it('ควรเพิ่มสมาชิกใน team ได้', async () => {
      mockTeamRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-team-1',
      });
      mockUserRepo.findOne.mockResolvedValue({
        user_id: 10,
        publicId: 'uuid-user-1',
      });
      mockDisciplineRepo.findOne.mockResolvedValue({ id: 5 });
      mockMemberRepo.findOne.mockResolvedValue(null);
      const created = { id: 100, teamId: 1, userId: 10, disciplineId: 5 };
      mockMemberRepo.create.mockReturnValue(created);
      mockMemberRepo.save.mockResolvedValue(created);

      const result = await service.addMember('uuid-team-1', dto);

      expect(result).toEqual(created);
      expect(mockMemberRepo.create).toHaveBeenCalledWith({
        teamId: 1,
        userId: 10,
        disciplineId: 5,
        role: ReviewTeamMemberRole.REVIEWER,
        priorityOrder: 0,
      });
    });

    it('ควรใช้ priorityOrder ที่ส่งมา', async () => {
      const dtoWithPriority: AddTeamMemberDto = {
        ...dto,
        priorityOrder: 5,
      };
      mockTeamRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-team-1',
      });
      mockUserRepo.findOne.mockResolvedValue({ user_id: 10 });
      mockDisciplineRepo.findOne.mockResolvedValue({ id: 5 });
      mockMemberRepo.findOne.mockResolvedValue(null);
      const created = { id: 100 };
      mockMemberRepo.create.mockReturnValue(created);
      mockMemberRepo.save.mockResolvedValue(created);

      await service.addMember('uuid-team-1', dtoWithPriority);

      expect(mockMemberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ priorityOrder: 5 })
      );
    });

    it('ควร throw NotFoundException เมื่อไม่พบ user', async () => {
      mockTeamRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-team-1',
      });
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.addMember('uuid-team-1', dto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('ควร throw NotFoundException เมื่อไม่พบ discipline', async () => {
      mockTeamRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-team-1',
      });
      mockUserRepo.findOne.mockResolvedValue({ user_id: 10 });
      mockDisciplineRepo.findOne.mockResolvedValue(null);

      await expect(service.addMember('uuid-team-1', dto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('ควร throw BadRequestException เมื่อ member ซ้ำ', async () => {
      mockTeamRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-team-1',
      });
      mockUserRepo.findOne.mockResolvedValue({ user_id: 10 });
      mockDisciplineRepo.findOne.mockResolvedValue({ id: 5 });
      mockMemberRepo.findOne.mockResolvedValue({ id: 100 });

      await expect(service.addMember('uuid-team-1', dto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('removeMember', () => {
    it('ควรลบสมาชิกได้', async () => {
      mockTeamRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-team-1',
      });
      const member = { id: 100, publicId: 'uuid-member-1', teamId: 1 };
      mockMemberRepo.findOne.mockResolvedValue(member);
      mockMemberRepo.remove.mockResolvedValue(undefined);

      await service.removeMember('uuid-team-1', 'uuid-member-1');

      expect(mockMemberRepo.remove).toHaveBeenCalledWith(member);
    });

    it('ควร throw NotFoundException เมื่อไม่พบ member', async () => {
      mockTeamRepo.findOne.mockResolvedValue({
        id: 1,
        publicId: 'uuid-team-1',
      });
      mockMemberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.removeMember('uuid-team-1', 'not-found')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('ควรตั้ง isActive = false และ save', async () => {
      const team = { id: 1, publicId: 'uuid-001', isActive: true };
      mockTeamRepo.findOne.mockResolvedValue(team);
      mockTeamRepo.save.mockResolvedValue({ ...team, isActive: false });

      await service.deactivate('uuid-001');

      expect(mockTeamRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false })
      );
    });
  });
});
