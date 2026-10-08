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
import { ReminderHistory } from './entities/reminder-history.entity';
import {
  ReminderRuleRecipient,
  ReminderRecipientType,
} from './entities/reminder-rule-recipient.entity';
import {
  CreateReminderRuleDto,
  ReminderRecipientDto,
} from './dto/create-reminder-rule.dto';
import { Project } from '../project/entities/project.entity';
import { ReviewTask } from '../review-team/entities/review-task.entity';

export { CreateReminderRuleDto };

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectRepository(ReminderRule)
    private readonly ruleRepo: Repository<ReminderRule>,
    @InjectRepository(ReminderHistory)
    private readonly historyRepo: Repository<ReminderHistory>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ReviewTask)
    private readonly taskRepo: Repository<ReviewTask>,
    @InjectRepository(ReminderRuleRecipient)
    private readonly recipientRepo: Repository<ReminderRuleRecipient>
  ) {}

  async findAll(projectId?: number): Promise<ReminderRule[]> {
    if (projectId !== undefined) {
      return this.ruleRepo.find({
        where: [{ projectId }, { projectId: undefined }],
        relations: ['recipients'],
        order: { escalationLevel: 'ASC', daysBeforeDue: 'DESC' },
      });
    }
    return this.ruleRepo.find({
      relations: ['recipients'],
      order: { escalationLevel: 'ASC' },
    });
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
    const rule = await this.ruleRepo.findOne({
      where: { publicId },
      relations: ['recipients'],
    });
    if (!rule)
      throw new NotFoundException(`ReminderRule not found: ${publicId}`);
    return rule;
  }

  async findHistoryByTaskPublicId(
    taskPublicId: string
  ): Promise<ReminderHistory[]> {
    const task = await this.taskRepo.findOne({
      where: { publicId: taskPublicId },
    });
    if (!task) throw new NotFoundException('Task', taskPublicId);

    return this.historyRepo.find({
      where: { taskId: task.id },
      relations: ['user'],
      order: { sentAt: 'DESC' },
    });
  }

  async create(dto: CreateReminderRuleDto): Promise<ReminderRule> {
    // recipients/notifyRoles ไม่ใช่คอลัมน์ของ rule — แยกออกเป็น child rows
    const { recipients, notifyRoles, ...ruleData } = dto;
    const rule = this.ruleRepo.create(ruleData as Partial<ReminderRule>);
    const saved = await this.ruleRepo.save(rule);
    const rows = this.buildRecipientRows(saved.id, recipients, notifyRoles);
    if (rows.length > 0) {
      await this.recipientRepo.save(rows);
    }
    return this.findOne(saved.publicId);
  }

  async update(
    publicId: string,
    dto: Partial<CreateReminderRuleDto>
  ): Promise<ReminderRule> {
    const rule = await this.findOne(publicId);
    const { recipients, notifyRoles, ...ruleData } = dto;
    Object.assign(rule, ruleData);
    await this.ruleRepo.save(rule);

    // ส่ง recipients หรือ notifyRoles มา = replace ทั้งชุด
    if (recipients !== undefined || notifyRoles !== undefined) {
      await this.recipientRepo.delete({ ruleId: rule.id });
      const rows = this.buildRecipientRows(rule.id, recipients, notifyRoles);
      if (rows.length > 0) {
        await this.recipientRepo.save(rows);
      }
    }
    return this.findOne(publicId);
  }

  /**
   * สร้าง recipient rows จาก structured recipients (preferred) หรือ legacy notifyRoles
   * notifyRoles mapping: ASSIGNEE→TASK_ASSIGNEE, MANAGER→TEAM_LEAD, PROJECT_MANAGER→PROJECT_MANAGER
   */
  private buildRecipientRows(
    ruleId: number,
    recipients?: ReminderRecipientDto[],
    notifyRoles?: string[]
  ): ReminderRuleRecipient[] {
    if (recipients !== undefined) {
      return recipients.map((r) =>
        this.recipientRepo.create({
          ruleId,
          recipientType: r.recipientType,
          recipientRef: r.recipientRef,
        })
      );
    }
    const legacyMap: Record<string, ReminderRecipientType> = {
      ASSIGNEE: ReminderRecipientType.TASK_ASSIGNEE,
      MANAGER: ReminderRecipientType.TEAM_LEAD,
      PROJECT_MANAGER: ReminderRecipientType.PROJECT_MANAGER,
    };
    return (notifyRoles ?? [])
      .filter((role) => {
        const mapped = legacyMap[role];
        if (!mapped) {
          this.logger.warn(`Unknown legacy notifyRole '${role}' — skipped`);
        }
        return !!mapped;
      })
      .map((role) =>
        this.recipientRepo.create({
          ruleId,
          recipientType: legacyMap[role],
        })
      );
  }

  async remove(publicId: string): Promise<void> {
    const rule = await this.findOne(publicId);
    await this.ruleRepo.remove(rule);
  }
}
