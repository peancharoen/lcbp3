// File: src/modules/review-team/review-team.service.ts
// Change Log:
// - 2026-05-13: Resolve project public IDs with UuidResolverService and align discipline lookup with INT discipline IDs.
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class ReviewTeamService {
  private readonly logger = new Logger(ReviewTeamService.name);

  constructor(
    @InjectRepository(ReviewTeam)
    private readonly teamRepo: Repository<ReviewTeam>,
    @InjectRepository(ReviewTeamMember)
    private readonly memberRepo: Repository<ReviewTeamMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Discipline)
    private readonly disciplineRepo: Repository<Discipline>,
    private readonly uuidResolver: UuidResolverService
  ) {}

  /**
   * ดึง Review Teams ตาม project (FR-001)
   */
  async findAll(dto: SearchReviewTeamDto): Promise<ReviewTeam[]> {
    const qb = this.teamRepo
      .createQueryBuilder('team')
      .leftJoinAndSelect('team.members', 'member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('member.discipline', 'discipline');

    if (dto.projectPublicId) {
      qb.innerJoin('team.project', 'project').where('project.uuid = :uuid', {
        uuid: dto.projectPublicId,
      });
    }

    if (dto.isActive !== undefined) {
      qb.andWhere('team.is_active = :isActive', { isActive: dto.isActive });
    }

    if (dto.search) {
      qb.andWhere('team.name LIKE :search', { search: `%${dto.search}%` });
    }

    return qb.orderBy('team.created_at', 'DESC').getMany();
  }

  /**
   * ดึง Review Team เดียวตาม publicId (ADR-019)
   */
  async findByPublicId(publicId: string): Promise<ReviewTeam> {
    const team = await this.teamRepo.findOne({
      where: { publicId },
      relations: ['members', 'members.user', 'members.discipline', 'project'],
    });

    if (!team) {
      throw new NotFoundException(`Review Team not found: ${publicId}`);
    }

    return team;
  }

  /**
   * ดึง Teams ที่เป็น Default สำหรับ RFA type นั้นๆ (FR-002)
   */
  async findDefaultForRfaType(
    rfaTypeCode: string,
    projectId: number
  ): Promise<ReviewTeam[]> {
    const teams = await this.teamRepo.find({
      where: { projectId, isActive: true },
      relations: ['members'],
    });

    return teams.filter(
      (t: ReviewTeam) => t.defaultForRfaTypes?.includes(rfaTypeCode) ?? false
    );
  }

  /**
   * สร้าง Review Team ใหม่
   */
  async create(dto: CreateReviewTeamDto): Promise<ReviewTeam> {
    const projectId = await this.uuidResolver.resolveProjectId(
      dto.projectPublicId
    );

    const team = this.teamRepo.create({
      name: dto.name,
      description: dto.description,
      projectId,
      defaultForRfaTypes: dto.defaultForRfaTypes,
      isActive: true,
    });

    return this.teamRepo.save(team);
  }

  /**
   * อัปเดต Review Team
   */
  async update(
    publicId: string,
    dto: UpdateReviewTeamDto
  ): Promise<ReviewTeam> {
    const team = await this.findByPublicId(publicId);

    if (dto.name !== undefined) team.name = dto.name;
    if (dto.description !== undefined) team.description = dto.description;
    if (dto.defaultForRfaTypes !== undefined)
      team.defaultForRfaTypes = dto.defaultForRfaTypes;
    if (dto.isActive !== undefined) team.isActive = dto.isActive;

    return this.teamRepo.save(team);
  }

  /**
   * เพิ่มสมาชิกใน Review Team (FR-001)
   */
  async addMember(
    teamPublicId: string,
    dto: AddTeamMemberDto
  ): Promise<ReviewTeamMember> {
    const team = await this.findByPublicId(teamPublicId);

    // ตรวจสอบ User
    const user = await this.userRepo.findOne({
      where: { publicId: dto.userPublicId },
    });
    if (!user)
      throw new NotFoundException(`User not found: ${dto.userPublicId}`);

    // ตรวจสอบ Discipline
    const discipline = await this.disciplineRepo.findOne({
      where: { id: dto.disciplineId },
    });
    if (!discipline)
      throw new NotFoundException(`Discipline not found: ${dto.disciplineId}`);

    // ตรวจสอบซ้ำ
    const existing = await this.memberRepo.findOne({
      where: {
        teamId: team.id,
        userId: user.user_id,
        disciplineId: discipline.id,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `User ${dto.userPublicId} is already a member of this team for discipline ${dto.disciplineId}`
      );
    }

    const member = this.memberRepo.create({
      teamId: team.id,
      userId: user.user_id,
      disciplineId: discipline.id,
      role: dto.role,
      priorityOrder: dto.priorityOrder ?? 0,
    });

    return this.memberRepo.save(member);
  }

  /**
   * ลบสมาชิกออกจาก Review Team
   */
  async removeMember(
    teamPublicId: string,
    memberPublicId: string
  ): Promise<void> {
    const team = await this.findByPublicId(teamPublicId);
    const member = await this.memberRepo.findOne({
      where: { publicId: memberPublicId, teamId: team.id },
    });

    if (!member) {
      throw new NotFoundException(`Member not found: ${memberPublicId}`);
    }

    await this.memberRepo.remove(member);
  }

  /**
   * ลบ Review Team (soft delete ด้วย isActive = false)
   */
  async deactivate(publicId: string): Promise<void> {
    const team = await this.findByPublicId(publicId);
    team.isActive = false;
    await this.teamRepo.save(team);
  }
}
