// File: backend/src/modules/ai/prompts/ai-prompts.service.ts
// Change Log
// - 2026-05-25: Created AiPromptsService for dynamic prompt management (ADR-029)
// - 2026-05-25: Fixed BusinessException and NotFoundException constructor signatures
// - 2026-05-25: Cast getRawOne() to resolve TypeScript type assertion error in ESLint

import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { AiPrompt } from './ai-prompts.entity';
import { AuditLog } from '../../../common/entities/audit-log.entity';
import { CreateAiPromptDto } from './dto/create-ai-prompt.dto';
import { ContextConfigDto } from '../dto/context-config.dto';
import {
  BusinessException,
  ValidationException,
  NotFoundException,
} from '../../../common/exceptions';

/**
 * Service สำหรับจัดการ Prompt Versioning และการดึงข้อมูล Prompt ล่าสุดที่พร้อมใช้งาน
 */
@Injectable()
export class AiPromptsService {
  private readonly logger = new Logger(AiPromptsService.name);
  private readonly cachePrefix = 'ai:prompt:active:';

  constructor(
    @InjectRepository(AiPrompt)
    private readonly aiPromptRepo: Repository<AiPrompt>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly dataSource: DataSource
  ) {}

  /**
   * ค้นหาและเตรียมข้อมูล Master Data อ้างอิงโครงการ (Context Resolution)
   * ดึงโครงการ, องค์กร, สาขางาน, ประเภทเอกสาร, และแท็ก
   * พร้อมทั้งทำหน้าที่เป็น Gatekeeper ป้องกันความสอดคล้องความปลอดภัย (ADR-030)
   * @param activePrompt Prompt version ที่ใช้งานอยู่
   * @param overrideProjectPublicId UUID โครงการสำหรับ override (optional)
   * @param overrideContractPublicId UUID สัญญาสำหรับ override (optional)
   * @returns Master data context ที่กรองแล้ว
   */
  async resolveContext(
    activePrompt: AiPrompt,
    overrideProjectPublicId?: string,
    overrideContractPublicId?: string
  ): Promise<Record<string, unknown>> {
    const config = activePrompt.contextConfig || {};
    const filter =
      (config.filter as Record<string, number | string | null | undefined>) ||
      {};
    let targetProjectId: number | null = filter.projectId
      ? Number(filter.projectId)
      : null;
    const targetContractId: number | null = filter.contractId
      ? Number(filter.contractId)
      : null;

    // 1. Logic ตรวจสอบ Override และทำหน้าที่ Gatekeeper ป้องกัน Cross-project data leak
    if (overrideProjectPublicId) {
      // ค้นหาโครงการเป้าหมายตาม UUID สาธารณะ
      const foundProject = await this.dataSource.manager
        .createQueryBuilder()
        .select('p.id', 'id')
        .from('projects', 'p')
        .where('p.uuid = :uuid', { uuid: overrideProjectPublicId })
        .andWhere('p.deleted_at IS NULL')
        .getRawOne<{ id: number }>();

      if (!foundProject) {
        throw new NotFoundException('Project', overrideProjectPublicId);
      }

      const overrideProjectId = Number(foundProject.id);

      // ตรวจสอบความสอดคล้องระดับโครงการ (Gatekeeper Rule)
      if (targetProjectId !== null && targetProjectId !== overrideProjectId) {
        throw new ForbiddenException(
          `Cross-project boundary violation: Template is restricted to project ID ${targetProjectId} but requested override is ${overrideProjectId}`
        );
      }

      // หากผ่านการคัดกรอง หรือเป็น Global template ให้ใช้ค่า override project ID นี้
      targetProjectId = overrideProjectId;
    }

    let overrideContractProjectId: number | null = null;
    let overrideContractId: number | null = null;
    if (overrideContractPublicId) {
      const foundContract = await this.dataSource.manager
        .createQueryBuilder()
        .select(['c.id as id', 'c.project_id as projectId'])
        .from('contracts', 'c')
        .where('c.uuid = :uuid', { uuid: overrideContractPublicId })
        .getRawOne<{ id: number; projectId: number }>();

      if (!foundContract) {
        throw new NotFoundException('Contract', overrideContractPublicId);
      }

      overrideContractId = Number(foundContract.id);
      overrideContractProjectId = Number(foundContract.projectId);

      if (
        targetContractId !== null &&
        targetContractId !== overrideContractId
      ) {
        throw new ForbiddenException(
          `Cross-contract boundary violation: Template is restricted to contract ID ${targetContractId} but requested override is ${overrideContractId}`
        );
      }

      if (
        targetProjectId !== null &&
        overrideContractProjectId !== targetProjectId
      ) {
        throw new ForbiddenException(
          `Cross-project boundary violation: Contract belongs to project ID ${overrideContractProjectId} but requested project is ${targetProjectId}`
        );
      }
    }
    const targetContractIdResolved =
      overrideContractId !== null ? overrideContractId : targetContractId;
    if (targetProjectId === null && overrideContractProjectId !== null) {
      targetProjectId = overrideContractProjectId;
    }

    // 2. ดึง Master Data ภายใต้ Project/Contract scope ที่จำกัด
    const projectsQuery = this.dataSource.manager
      .createQueryBuilder()
      .select([
        'p.project_code as projectCode',
        'p.uuid as uuid',
        'p.project_name as projectName',
      ])
      .from('projects', 'p')
      .where('p.deleted_at IS NULL');
    if (targetProjectId) {
      projectsQuery.andWhere('p.id = :projectId', {
        projectId: targetProjectId,
      });
    }
    const projects = await projectsQuery.getRawMany<{
      projectCode: string;
      uuid: string;
      projectName: string;
    }>();

    const orgsQuery = this.dataSource.manager
      .createQueryBuilder()
      .select([
        'o.organization_code as organizationCode',
        'o.uuid as uuid',
        'o.organization_name as organizationName',
      ])
      .from('organizations', 'o')
      .where('o.deleted_at IS NULL');
    if (targetProjectId) {
      // ค้นหาองค์กรที่ผูกอยู่ในโครงการนั้นๆ
      orgsQuery
        .innerJoin('project_organizations', 'po', 'po.organization_id = o.id')
        .andWhere('po.project_id = :projectId', { projectId: targetProjectId });
    }
    const organizations = await orgsQuery.getRawMany<{
      organizationCode: string;
      uuid: string;
      organizationName: string;
    }>();

    const disciplinesQuery = this.dataSource.manager
      .createQueryBuilder()
      .select([
        'd.discipline_code as disciplineCode',
        'd.code_name_th as codeNameTh',
      ])
      .from('disciplines', 'd')
      .where('d.is_active = 1');
    if (targetContractIdResolved) {
      disciplinesQuery.andWhere('d.contract_id = :contractId', {
        contractId: targetContractIdResolved,
      });
    } else if (targetProjectId) {
      // ดึงจากสัญญาทั้งหมดที่อยู่ภายใต้โครงการเป้าหมาย
      disciplinesQuery
        .innerJoin('contracts', 'c', 'c.id = d.contract_id')
        .andWhere('c.project_id = :projectId', { projectId: targetProjectId });
    }
    const disciplines = await disciplinesQuery.getRawMany<{
      disciplineCode: string;
      codeNameTh: string;
    }>();

    const correspondenceTypes = await this.dataSource.manager
      .createQueryBuilder()
      .select(['t.type_code as typeCode', 't.type_name as typeName'])
      .from('correspondence_types', 't')
      .where('t.is_active = 1')
      .andWhere('t.deleted_at IS NULL')
      .getRawMany<{ typeCode: string; typeName: string }>();

    const tagsQuery = this.dataSource.manager
      .createQueryBuilder()
      .select(['tg.tag_name as tagName', 'tg.color_code as colorCode'])
      .from('tags', 'tg')
      .where('tg.deleted_at IS NULL');
    if (targetProjectId) {
      tagsQuery.andWhere(
        '(tg.project_id = :projectId OR tg.project_id IS NULL)',
        { projectId: targetProjectId }
      );
    } else {
      tagsQuery.andWhere('tg.project_id IS NULL');
    }
    const tags = await tagsQuery.getRawMany<{
      tagName: string;
      colorCode: string;
    }>();

    return {
      availableProjects: projects.map((p) => ({
        code: p.projectCode,
        uuid: p.uuid,
        name: p.projectName,
      })),
      availableOrganizations: organizations.map((o) => ({
        code: o.organizationCode,
        uuid: o.uuid,
        name: o.organizationName,
      })),
      availableDisciplines: disciplines.map((d) => ({
        code: d.disciplineCode,
        name: d.codeNameTh,
      })),
      availableCorrespondenceTypes: correspondenceTypes.map((t) => ({
        code: t.typeCode,
        name: t.typeName,
      })),
      availableTags: tags.map((t) => ({
        name: tgName(t.tagName),
        color: t.colorCode,
      })),
    };
  }

  /**
   * ดึงรายการเวอร์ชันทั้งหมดของ prompt_type ที่กำหนด
   * @param promptType ประเภทของ prompt (เช่น 'ocr_extraction')
   * @returns รายการ prompt versions เรียงตาม versionNumber ล่าสุดก่อน
   */
  async findAll(promptType: string): Promise<AiPrompt[]> {
    return this.aiPromptRepo.find({
      where: { promptType },
      order: { versionNumber: 'DESC' },
    });
  }

  /**
   * ดึง Active prompt จาก Redis cache หรือ DB fallback
   * @param promptType ประเภทของ prompt
   * @returns Prompt version ที่เปิดใช้งานอยู่ หรือ null หากไม่พบ
   */
  async getActive(promptType: string): Promise<AiPrompt | null> {
    const cacheKey = `${this.cachePrefix}${promptType}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as AiPrompt;
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Redis unavailable, falling back to DB query: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    const prompt = await this.aiPromptRepo.findOne({
      where: { promptType, isActive: true },
    });
    if (prompt) {
      try {
        await this.redis.setex(cacheKey, 60, JSON.stringify(prompt));
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to set Redis cache: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    return prompt;
  }

  /**
   * ดึง Prompt version ตาม versionNumber ที่ระบุ
   * @param promptType ประเภทของ prompt
   * @param versionNumber เลข version ที่ต้องการ
   * @returns Prompt version ที่ตรงกับ versionNumber หรือ null หากไม่พบ
   */
  async findByVersion(
    promptType: string,
    versionNumber: number
  ): Promise<AiPrompt | null> {
    return this.aiPromptRepo.findOne({
      where: { promptType, versionNumber },
    });
  }

  /**
   * ค้นหา prompt ที่มีผลใช้งานจริง และแทนที่ placeholder {{ocr_text}} ด้วยข้อความ OCR
   * @param promptType ประเภทของ prompt
   * @param ocrText ข้อความที่สกัดจาก OCR
   * @returns Prompt ที่แทนที่ placeholder แล้ว พร้อม version number
   * @throws BusinessException หากไม่พบ active prompt
   */
  async resolveActive(
    promptType: string,
    ocrText: string
  ): Promise<{ resolvedPrompt: string; versionNumber: number }> {
    const prompt = await this.getActive(promptType);
    if (!prompt) {
      throw new BusinessException(
        'NO_ACTIVE_PROMPT',
        `No active prompt found for type: ${promptType}`,
        'ไม่พบ Prompt Version ที่เปิดใช้งานในระบบ'
      );
    }
    const resolvedPrompt = prompt.template.replace('{{ocr_text}}', ocrText);
    return { resolvedPrompt, versionNumber: prompt.versionNumber };
  }

  /**
   * สร้าง Prompt Version ใหม่พร้อมการตรวจสอบ placeholder และ character limit
   * @param promptType ประเภทของ prompt
   * @param dto ข้อมูล template และ contextConfig
   * @param userId ID ของผู้สร้าง
   * @returns Prompt version ที่สร้างใหม่
   * @throws ValidationException หาก template ไม่มี placeholder หรือเกิน character limit
   */
  async create(
    promptType: string,
    dto: CreateAiPromptDto,
    userId: number
  ): Promise<AiPrompt> {
    if (promptType === 'ocr_extraction') {
      if (!dto.template.includes('{{ocr_text}}')) {
        throw new ValidationException(
          'template ต้องมี {{ocr_text}} placeholder'
        );
      }
    } else if (promptType === 'rag_query_prompt') {
      if (
        !dto.template.includes('{{query}}') ||
        !dto.template.includes('{{context}}')
      ) {
        throw new ValidationException(
          'template ต้องมี {{query}} และ {{context}} placeholder'
        );
      }
    } else if (promptType === 'rag_prep_prompt') {
      if (!dto.template.includes('{{text}}')) {
        throw new ValidationException('template ต้องมี {{text}} placeholder');
      }
    } else if (promptType === 'classification_prompt') {
      if (!dto.template.includes('{{document_text}}')) {
        throw new ValidationException(
          'template ต้องมี {{document_text}} placeholder'
        );
      }
    }
    if (dto.template.length > 4000) {
      throw new ValidationException('Template exceeds 4,000 character limit');
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const maxVersionResult = await queryRunner.manager
        .createQueryBuilder(AiPrompt, 'prompt')
        .select('MAX(prompt.versionNumber)', 'max')
        .where('prompt.promptType = :promptType', { promptType })
        .setLock('pessimistic_write')
        .getRawOne<{ max: number | string | null }>();
      const nextVersion =
        (maxVersionResult?.max ? Number(maxVersionResult.max) : 0) + 1;
      const newPrompt = this.aiPromptRepo.create({
        publicId: randomUUID(),
        promptType,
        versionNumber: nextVersion,
        template: dto.template,
        fieldSchema: null,
        contextConfig: dto.contextConfig || null,
        isActive: false,
        createdBy: userId,
      });
      const savedPrompt = await queryRunner.manager.save(newPrompt);
      await queryRunner.commitTransaction();
      await this.saveAuditLog(
        'AI_PROMPT_CREATED',
        String(savedPrompt.id),
        { promptType, versionNumber: nextVersion, userId },
        userId
      );
      return savedPrompt;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * เปิดใช้งานเวอร์ชันที่กำหนด และยกเลิกการใช้งานเวอร์ชันอื่นทั้งหมดภายใต้ prompt_type เดียวกัน
   * @param promptType ประเภทของ prompt
   * @param versionNumber เลขเวอร์ชันที่ต้องการเปิดใช้งาน
   * @param userId ID ของผู้ดำเนินการ
   * @returns Prompt version ที่เปิดใช้งานแล้ว
   * @throws NotFoundException หากไม่พบ prompt version
   */
  async activate(
    promptType: string,
    versionNumber: number,
    userId: number
  ): Promise<AiPrompt> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const promptToActivate = await queryRunner.manager.findOne(AiPrompt, {
        where: { promptType, versionNumber },
        lock: { mode: 'pessimistic_write' },
      });
      if (!promptToActivate) {
        throw new NotFoundException('AiPrompt', versionNumber.toString());
      }
      await queryRunner.manager.find(AiPrompt, {
        where: { promptType, isActive: true },
        lock: { mode: 'pessimistic_write' },
      });
      await queryRunner.manager.update(
        AiPrompt,
        { promptType, isActive: true },
        { isActive: false }
      );
      promptToActivate.isActive = true;
      promptToActivate.activatedAt = new Date();
      const activatedPrompt = await queryRunner.manager.save(promptToActivate);
      await queryRunner.commitTransaction();
      try {
        const cacheKey = `${this.cachePrefix}${promptType}`;
        await this.redis.del(cacheKey);
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to clear Redis cache after activation: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      await this.saveAuditLog(
        'AI_PROMPT_ACTIVATED',
        String(activatedPrompt.id),
        { promptType, versionNumber, userId },
        userId
      );
      return activatedPrompt;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * ลบเวอร์ชันที่ไม่ได้ใช้งาน (ห้ามลบเวอร์ชันที่เป็น active)
   * @param promptType ประเภทของ prompt
   * @param versionNumber เลขเวอร์ชันที่ต้องการลบ
   * @param userId ID ของผู้ดำเนินการ
   * @throws NotFoundException หากไม่พบ prompt version
   * @throws BusinessException หากพยายามลบ active version
   */
  async delete(
    promptType: string,
    versionNumber: number,
    userId: number
  ): Promise<void> {
    const prompt = await this.aiPromptRepo.findOne({
      where: { promptType, versionNumber },
    });
    if (!prompt) {
      throw new NotFoundException('AiPrompt', versionNumber.toString());
    }
    if (prompt.isActive) {
      throw new BusinessException(
        'CANNOT_DELETE_ACTIVE_PROMPT',
        'Cannot delete active prompt version',
        'ไม่สามารถลบ active version ได้'
      );
    }
    await this.aiPromptRepo.remove(prompt);
    await this.saveAuditLog(
      'AI_PROMPT_DELETED',
      String(prompt.id),
      { promptType, versionNumber, userId },
      userId
    );
  }

  /**
   * อัปเดต manual note ของเวอร์ชันที่กำหนด
   * @param promptType ประเภทของ prompt
   * @param versionNumber เลขเวอร์ชัน
   * @param note ข้อความ note หรือ null หากต้องการลบ
   * @returns Prompt version ที่อัปเดตแล้ว
   * @throws NotFoundException หากไม่พบ prompt version
   */
  async updateNote(
    promptType: string,
    versionNumber: number,
    note: string | null
  ): Promise<AiPrompt> {
    const prompt = await this.aiPromptRepo.findOne({
      where: { promptType, versionNumber },
    });
    if (!prompt) {
      throw new NotFoundException('AiPrompt', versionNumber.toString());
    }
    prompt.manualNote = note;
    return this.aiPromptRepo.save(prompt);
  }

  /**
   * บันทึกผลทดสอบของเวอร์ชันหลังจากรัน OCR Sandbox
   * @param promptType ประเภทของ prompt
   * @param versionNumber เลขเวอร์ชัน
   * @param resultJson ผลลัพธ์การทดสอบในรูป JSON
   */
  async saveTestResult(
    promptType: string,
    versionNumber: number,
    resultJson: Record<string, unknown>
  ): Promise<void> {
    const prompt = await this.aiPromptRepo.findOne({
      where: { promptType, versionNumber },
    });
    if (prompt) {
      prompt.testResultJson = resultJson;
      prompt.lastTestedAt = new Date();
      await this.aiPromptRepo.save(prompt);
    }
  }

  /**
   * ดึง Context Config ของ Prompt Version ที่กำหนด
   */
  async getContextConfig(
    promptType: string,
    versionNumber: number
  ): Promise<Record<string, unknown> | null> {
    const prompt = await this.aiPromptRepo.findOne({
      where: { promptType, versionNumber },
    });
    if (!prompt) {
      throw new NotFoundException('AiPrompt', versionNumber.toString());
    }
    return prompt.contextConfig;
  }

  /**
   * อัปเดต Context Config ของ Prompt Version ที่กำหนด พร้อมทั้งตรวจเช็คความถูกต้องของโครงการและสัญญาใน DB
   */
  async updateContextConfig(
    promptType: string,
    versionNumber: number,
    dto: ContextConfigDto
  ): Promise<Record<string, unknown>> {
    const prompt = await this.aiPromptRepo.findOne({
      where: { promptType, versionNumber },
    });
    if (!prompt) {
      throw new NotFoundException('AiPrompt', versionNumber.toString());
    }

    // Validation (T027): ตรวจสอบโครงการ/สัญญาใน DB
    if (dto.filter?.projectId) {
      const projectExists = (await this.dataSource.manager
        .createQueryBuilder()
        .select('p.id')
        .from('projects', 'p')
        .where('p.uuid = :uuid', { uuid: dto.filter.projectId })
        .andWhere('p.deleted_at IS NULL')
        .getRawOne()) as unknown;
      if (!projectExists) {
        throw new NotFoundException('Project', dto.filter.projectId);
      }
    }

    if (dto.filter?.contractId) {
      const contractExists = (await this.dataSource.manager
        .createQueryBuilder()
        .select('c.id')
        .from('contracts', 'c')
        .where('c.uuid = :uuid', { uuid: dto.filter.contractId })
        .getRawOne()) as unknown;
      if (!contractExists) {
        throw new NotFoundException('Contract', dto.filter.contractId);
      }
    }

    // บันทึกลง DB
    const newContextConfig = {
      filter: dto.filter || null,
      pageSize: dto.pageSize,
      language: dto.language,
      outputLanguage: dto.outputLanguage,
    };
    prompt.contextConfig = newContextConfig;
    await this.aiPromptRepo.save(prompt);

    return newContextConfig;
  }

  /**
   * บันทึกข้อมูลการปฏิบัติการของผู้ใช้ลงในตารางหลัก audit_logs
   */
  private async saveAuditLog(
    action: string,
    entityId: string,
    detailsJson: Record<string, unknown>,
    userId?: number
  ): Promise<void> {
    try {
      const auditLog = this.auditLogRepo.create({
        action,
        severity: 'INFO',
        entityType: 'AiPrompt',
        entityId,
        detailsJson,
        userId,
      });
      await this.auditLogRepo.save(auditLog);
    } catch (err: unknown) {
      this.logger.error(
        `Failed to save audit log: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

/** Helper function to sanitize tag name */
function tgName(name: unknown): string {
  return typeof name === 'string' ? name.trim() : '';
}
