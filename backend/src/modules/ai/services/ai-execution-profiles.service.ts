// File: backend/src/modules/ai/services/ai-execution-profiles.service.ts
// Change Log:
// - 2026-06-15: Initial creation of AiExecutionProfilesService for execution profile CRUD operations (T044)
// - 2026-06-15: Enhanced error handling following ADR-007 layered classification (T054)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiExecutionProfile } from '../entities/ai-execution-profile.entity';
import { CreateExecutionProfileDto } from '../dto/create-execution-profile.dto';
import { UpdateExecutionProfileDto } from '../dto/update-execution-profile.dto';
import {
  BusinessException,
  NotFoundException,
} from '../../../common/exceptions';

/**
 * บริการจัดการโปรไฟล์การทำงานของโมเดล AI (Execution Profile)
 * ใช้สำหรับจัดการพารามิเตอร์ Runtime Parameters ที่ใช้กับทุกงาน AI
 */
@Injectable()
export class AiExecutionProfilesService {
  private readonly logger = new Logger(AiExecutionProfilesService.name);

  constructor(
    @InjectRepository(AiExecutionProfile)
    private readonly profileRepo: Repository<AiExecutionProfile>
  ) {}

  /**
   * ดึงรายการโปรไฟล์ทั้งหมด
   */
  async findAll(): Promise<AiExecutionProfile[]> {
    try {
      return this.profileRepo.find({
        order: { createdAt: 'ASC' },
      });
    } catch (err: unknown) {
      this.logger.error(
        `Failed to fetch execution profiles: ${err instanceof Error ? err.message : String(err)}`
      );
      throw new BusinessException(
        'FETCH_PROFILES_FAILED',
        'Failed to fetch execution profiles',
        'ไม่สามารถดึงข้อมูลโปรไฟล์ได้ กรุณาลองใหม่'
      );
    }
  }

  /**
   * ดึงโปรไฟล์ตาม ID
   */
  async findOneById(id: number): Promise<AiExecutionProfile> {
    try {
      const profile = await this.profileRepo.findOne({ where: { id } });
      if (!profile) {
        throw new NotFoundException('AiExecutionProfile', id.toString());
      }
      return profile;
    } catch (err: unknown) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(
        `Failed to fetch execution profile ${id}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw new BusinessException(
        'FETCH_PROFILE_FAILED',
        'Failed to fetch execution profile',
        'ไม่สามารถดึงข้อมูลโปรไฟล์ได้ กรุณาลองใหม่'
      );
    }
  }

  /**
   * ดึงโปรไฟล์ที่ active อยู่
   */
  async findActive(): Promise<AiExecutionProfile | null> {
    try {
      return this.profileRepo.findOne({
        where: { isActive: true },
        order: { createdAt: 'DESC' },
      });
    } catch (err: unknown) {
      this.logger.error(
        `Failed to fetch active execution profile: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  /**
   * สร้างโปรไฟล์ใหม่
   */
  async create(
    dto: CreateExecutionProfileDto,
    userId: number
  ): Promise<AiExecutionProfile> {
    try {
      // ตรวจสอบว่า profileName ซ้ำหรือไม่
      const existing = await this.profileRepo.findOne({
        where: { profileName: dto.profileName },
      });
      if (existing) {
        throw new BusinessException(
          'PROFILE_NAME_EXISTS',
          `Profile name "${dto.profileName}" already exists`,
          'ชื่อโปรไฟล์ซ้ำ กรุณาใช้ชื่ออื่น'
        );
      }

      const profile = this.profileRepo.create({
        ...dto,
        numCtx: dto.ctxSize,
        updatedBy: userId,
      });

      return this.profileRepo.save(profile);
    } catch (err: unknown) {
      if (err instanceof BusinessException) {
        throw err;
      }
      this.logger.error(
        `Failed to create execution profile: ${err instanceof Error ? err.message : String(err)}`
      );
      throw new BusinessException(
        'CREATE_PROFILE_FAILED',
        'Failed to create execution profile',
        'ไม่สามารถสร้างโปรไฟล์ได้ กรุณาลองใหม่'
      );
    }
  }

  /**
   * อัปเดตโปรไฟล์
   */
  async update(
    id: number,
    dto: UpdateExecutionProfileDto,
    userId: number
  ): Promise<AiExecutionProfile> {
    try {
      const profile = await this.findOneById(id);

      Object.assign(profile, {
        ...dto,
        numCtx: dto.ctxSize,
        updatedBy: userId,
      });

      return this.profileRepo.save(profile);
    } catch (err: unknown) {
      if (
        err instanceof BusinessException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      this.logger.error(
        `Failed to update execution profile ${id}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw new BusinessException(
        'UPDATE_PROFILE_FAILED',
        'Failed to update execution profile',
        'ไม่สามารถอัปเดตโปรไฟล์ได้ กรุณาลองใหม่'
      );
    }
  }

  /**
   * ลบโปรไฟล์
   */
  async delete(id: number): Promise<void> {
    try {
      const profile = await this.findOneById(id);

      // ป้องกันการลบโปรไฟล์ที่ active อยู่
      if (profile.isActive) {
        throw new BusinessException(
          'CANNOT_DELETE_ACTIVE_PROFILE',
          'Cannot delete active execution profile',
          'ไม่สามารถลบโปรไฟล์ที่กำลังใช้งานได้ กรุณาปิดใช้งานก่อน'
        );
      }

      await this.profileRepo.remove(profile);
    } catch (err: unknown) {
      if (
        err instanceof BusinessException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      this.logger.error(
        `Failed to delete execution profile ${id}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw new BusinessException(
        'DELETE_PROFILE_FAILED',
        'Failed to delete execution profile',
        'ไม่สามารถลบโปรไฟล์ได้ กรุณาลองใหม่'
      );
    }
  }

  /**
   * ตั้งค่าโปรไฟล์เป็น active (เปลี่ยนจาก active เดิมถ้ามี)
   */
  async setActive(id: number, userId: number): Promise<AiExecutionProfile> {
    try {
      const profile = await this.findOneById(id);

      // ปิด active ของโปรไฟล์อื่นทั้งหมด
      await this.profileRepo.update(
        { isActive: true },
        { isActive: false, updatedBy: userId }
      );

      // เปิด active ของโปรไฟล์ที่เลือก
      profile.isActive = true;
      profile.updatedBy = userId;

      return this.profileRepo.save(profile);
    } catch (err: unknown) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(
        `Failed to set active execution profile ${id}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw new BusinessException(
        'SET_ACTIVE_FAILED',
        'Failed to set active execution profile',
        'ไม่สามารถตั้งค่าโปรไฟล์เป็น active ได้ กรุณาลองใหม่'
      );
    }
  }
}
