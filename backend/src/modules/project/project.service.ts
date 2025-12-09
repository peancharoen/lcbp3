import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';

// Entities
import { Project } from './entities/project.entity';
import { Organization } from './entities/organization.entity';

// DTOs
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { SearchProjectDto } from './dto/search-project.dto.js';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>
  ) {}

  // --- CRUD Operations ---

  async create(createDto: CreateProjectDto) {
    // 1. เช็คชื่อ/รหัสซ้ำ (ถ้าจำเป็น)
    const existing = await this.projectRepository.findOne({
      where: { projectCode: createDto.projectCode },
    });
    if (existing) {
      throw new ConflictException(
        `Project Code "${createDto.projectCode}" already exists`
      );
    }

    // 2. สร้าง Project
    const project = this.projectRepository.create(createDto);
    return this.projectRepository.save(project);
  }

  async findAll(searchDto: SearchProjectDto) {
    const { search, isActive, page = 1, limit = 20 } = searchDto;
    const skip = (page - 1) * limit;

    // สร้าง Query Builder
    const query = this.projectRepository.createQueryBuilder('project');

    if (isActive !== undefined) {
      query.andWhere('project.isActive = :isActive', { isActive });
    }

    if (search) {
      query.andWhere(
        '(project.projectCode LIKE :search OR project.projectName LIKE :search)',
        { search: `%${search}%` }
      );
    }

    query.orderBy('project.created_at', 'DESC');
    query.skip(skip).take(limit);

    const [items, total] = await query.getManyAndCount();

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: ['contracts'], // ดึงสัญญาที่เกี่ยวข้องมาด้วย
    });

    if (!project) {
      throw new NotFoundException(`Project ID ${id} not found`);
    }

    return project;
  }

  async update(id: number, updateDto: UpdateProjectDto) {
    const project = await this.findOne(id);

    // Merge ข้อมูลใหม่ใส่ข้อมูลเดิม
    this.projectRepository.merge(project, updateDto);

    return this.projectRepository.save(project);
  }

  async remove(id: number) {
    const project = await this.findOne(id);
    // ใช้ Soft Delete
    return this.projectRepository.softRemove(project);
  }

  async findContracts(projectId: number) {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['contracts'],
    });

    if (!project) {
      throw new NotFoundException(`Project ID ${projectId} not found`);
    }

    return project.contracts;
  }

  // --- Organization Helper ---

  async findAllOrganizations() {
    return this.organizationRepository.find({
      where: { isActive: true },
      order: { organizationCode: 'ASC' },
    });
  }
}
