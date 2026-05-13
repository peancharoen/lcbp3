// File: src/modules/reminder/reminder.service.ts
// ReminderService — CRUD สำหรับ ReminderRule entities (T044)
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { validate as uuidValidate } from 'uuid';
import { ReminderRule } from './entities/reminder-rule.entity';
import { CreateReminderRuleDto } from './dto/create-reminder-rule.dto';
import { Project } from '../project/entities/project.entity';

export { CreateReminderRuleDto };

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectRepository(ReminderRule)
    private readonly ruleRepo: Repository<ReminderRule>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>
  ) {}

  async findAll(projectId?: number): Promise<ReminderRule[]> {
    if (projectId !== undefined) {
      return this.ruleRepo.find({
        where: [{ projectId }, { projectId: undefined }],
        order: { escalationLevel: 'ASC', daysBeforeDue: 'DESC' },
      });
    }
    return this.ruleRepo.find({ order: { escalationLevel: 'ASC' } });
  }

  async findAllByProjectPublicId(
    projectPublicId?: string
  ): Promise<ReminderRule[]> {
    if (!projectPublicId) return this.findAll();
    if (!uuidValidate(projectPublicId)) {
      throw new BadRequestException(`Invalid UUID format: ${projectPublicId}`);
    }
    const project = await this.projectRepo.findOne({
      where: { publicId: projectPublicId },
    });
    if (!project)
      throw new NotFoundException(`Project not found: ${projectPublicId}`);
    return this.findAll(project.id);
  }

  async findOne(publicId: string): Promise<ReminderRule> {
    const rule = await this.ruleRepo.findOne({ where: { publicId } });
    if (!rule)
      throw new NotFoundException(`ReminderRule not found: ${publicId}`);
    return rule;
  }

  async create(dto: CreateReminderRuleDto): Promise<ReminderRule> {
    const rule = this.ruleRepo.create(dto as Partial<ReminderRule>);
    return this.ruleRepo.save(rule);
  }

  async update(
    publicId: string,
    dto: Partial<CreateReminderRuleDto>
  ): Promise<ReminderRule> {
    const rule = await this.findOne(publicId);
    Object.assign(rule, dto);
    return this.ruleRepo.save(rule);
  }

  async remove(publicId: string): Promise<void> {
    const rule = await this.findOne(publicId);
    await this.ruleRepo.remove(rule);
  }
}
