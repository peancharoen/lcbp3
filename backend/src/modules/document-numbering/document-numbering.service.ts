import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, OptimisticLockVersionMismatchError } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Redlock from 'redlock';
import { DocumentNumberCounter } from './entities/document-number-counter.entity.js';
import { DocumentNumberFormat } from './entities/document-number-format.entity.js';

@Injectable()
export class DocumentNumberingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentNumberingService.name);
  private redisClient!: Redis;
  private redlock!: Redlock;

  constructor(
    @InjectRepository(DocumentNumberCounter)
    private counterRepo: Repository<DocumentNumberCounter>,
    @InjectRepository(DocumentNumberFormat)
    private formatRepo: Repository<DocumentNumberFormat>,
    private configService: ConfigService,
  ) {}

  // 1. เริ่มต้นเชื่อมต่อ Redis และ Redlock เมื่อ Module ถูกโหลด
  onModuleInit() {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
      password: this.configService.get<string>('REDIS_PASSWORD'),
    });

    this.redlock = new Redlock([this.redisClient], {
      driftFactor: 0.01,
      retryCount: 10, // ลองใหม่ 10 ครั้งถ้า Lock ไม่สำเร็จ
      retryDelay: 200, // รอ 200ms ก่อนลองใหม่
      retryJitter: 200,
    });

    this.logger.log('Redis & Redlock initialized for Document Numbering');
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  /**
   * ฟังก์ชันหลักสำหรับขอเลขที่เอกสารถัดไป
   * @param projectId ID โครงการ
   * @param orgId ID องค์กรผู้ส่ง
   * @param typeId ID ประเภทเอกสาร
   * @param year ปีปัจจุบัน (ค.ศ.)
   * @param replacements ค่าที่จะเอาไปแทนที่ใน Template (เช่น { ORG_CODE: 'TEAM' })
   */
  async generateNextNumber(
    projectId: number,
    orgId: number,
    typeId: number,
    year: number,
    replacements: Record<string, string> = {},
  ): Promise<string> {
    const resourceKey = `doc_num:${projectId}:${typeId}:${year}`;
    const ttl = 5000; // Lock จะหมดอายุใน 5 วินาที (ป้องกัน Deadlock)

    let lock;
    try {
      // 🔒 Step 1: Redis Lock (Distributed Lock)
      // ป้องกันไม่ให้ Process อื่นเข้ามายุ่งกับ Counter ตัวนี้พร้อมกัน
      lock = await this.redlock.acquire([resourceKey], ttl);

      // 🔄 Step 2: Optimistic Locking Loop (Safety Net)
      // เผื่อ Redis Lock หลุด หรือมีคนแทรกได้จริงๆ DB จะช่วยกันไว้อีกชั้น
      const maxRetries = 3;
      for (let i = 0; i < maxRetries; i++) {
        try {
          // 2.1 ดึง Counter ปัจจุบัน
          let counter = await this.counterRepo.findOne({
            where: { projectId, originatorId: orgId, typeId, year },
          });

          // ถ้ายังไม่มี ให้สร้างใหม่ (เริ่มที่ 0)
          if (!counter) {
            counter = this.counterRepo.create({
              projectId,
              originatorId: orgId,
              typeId,
              year,
              lastNumber: 0,
            });
          }

          // 2.2 บวกเลข
          counter.lastNumber += 1;

          // 2.3 บันทึก (จุดนี้ TypeORM จะเช็ค Version ให้เอง)
          await this.counterRepo.save(counter);

          // 2.4 ถ้าบันทึกผ่าน -> สร้าง String ตาม Format
          return await this.formatNumber(
            projectId,
            typeId,
            counter.lastNumber,
            replacements,
          );
        } catch (err) {
          // ถ้า Version ชนกัน (Optimistic Lock Error) ให้วนลูปทำใหม่
          if (err instanceof OptimisticLockVersionMismatchError) {
            this.logger.warn(
              `Optimistic Lock Hit! Retrying... (${i + 1}/${maxRetries})`,
            );
            continue;
          }
          throw err; // ถ้าเป็น Error อื่น ให้โยนออกไปเลย
        }
      }

      throw new InternalServerErrorException(
        'Failed to generate document number after retries',
      );
    } catch (err) {
      this.logger.error('Error generating document number', err);
      throw err;
    } finally {
      // 🔓 Step 3: Release Redis Lock เสมอ (ไม่ว่าจะสำเร็จหรือล้มเหลว)
      if (lock) {
        await lock.release().catch(() => {}); // ignore error if lock expired
      }
    }
  }

  // Helper: แปลงเลขเป็น String ตาม Template (เช่น {ORG}-{SEQ:004})
  private async formatNumber(
    projectId: number,
    typeId: number,
    seq: number,
    replacements: Record<string, string>,
  ): Promise<string> {
    // 1. หา Template
    const format = await this.formatRepo.findOne({
      where: { projectId, correspondenceTypeId: typeId },
    });

    // ถ้าไม่มี Template ให้ใช้ Default: {SEQ}
    let template = format ? format.formatTemplate : '{SEQ:4}';

    // 2. แทนที่ค่าต่างๆ (ORG_CODE, TYPE_CODE, YEAR)
    for (const [key, value] of Object.entries(replacements)) {
      template = template.replace(new RegExp(`{${key}}`, 'g'), value);
    }

    // 3. แทนที่ SEQ (รองรับรูปแบบ {SEQ:4} คือเติม 0 ข้างหน้าให้ครบ 4 หลัก)
    template = template.replace(/{SEQ(?::(\d+))?}/g, (_, digits) => {
      const pad = digits ? parseInt(digits, 10) : 0;
      return seq.toString().padStart(pad, '0');
    });

    return template;
  }
}
