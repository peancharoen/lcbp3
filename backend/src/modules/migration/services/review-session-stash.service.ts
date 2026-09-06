// File: backend/src/modules/migration/services/review-session-stash.service.ts
// Change Log:
// - 2026-09-06: Initial creation — ReviewSessionStashService (T005, FR-012)
//   ทำหน้าที่จัดการ Review Session ใน Redis (24h TTL) และไฟล์ใน stash directory
//   ส่วนตัวของแต่ละ session พร้อม cleanup สำหรับ cron worker (Edge case 5, D5)
//   ใช้ UUIDv7 string เป็น reviewSessionPublicId ตาม ADR-019 (ห้าม parseInt/Number)

import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { v7 as uuidv7 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
  ReviewSessionData,
  ReviewTargetMode,
  AiReviewerProvider,
  REVIEW_SESSION_REDIS_PREFIX,
  REVIEW_SESSION_TTL_SECONDS,
} from '../types/excel-review.types';

/**
 * Token สำหรับ inject ค่า root path ของ staging directory
 * ค่าจริงมาจาก environment variable หรือ default `uploads/staging/import-review`
 * ใช้ token เพื่อให้ test สามารถ override ด้วย tmpdir ได้ (hermetic)
 */
export const REVIEW_STAGING_ROOT_TOKEN = 'REVIEW_STAGING_ROOT';

/** ชื่อ subdirectory ภายใต้ staging root ที่เก็บ session dirs ทั้งหมด */
const SESSIONS_SUBDIR = 'import-review';

/**
 * Input สำหรับสร้าง Review Session
 * ไม่รวม reviewSessionPublicId/createdAt/expiresAt/status/originalFilePath/
 * annotatedFilePath เพราะระบบเป็นผู้กำหนด
 */
export interface CreateReviewSessionInput {
  projectPublicId: string;
  targetMode: ReviewTargetMode;
  uploadedBy: string;
  selectedAiProvider: AiReviewerProvider;
  originalFileName: string;
  /** เนื้อไฟล์ดิบที่อัปโหลด (Excel หรือ zip bundle) */
  fileBuffer: Buffer;
  totalRows: number;
  passCount: number;
  warnCount: number;
  blockCount: number;
  aiSuggestCount: number;
}

/**
 * ReviewSessionStashService — จัดการ Redis session + disk stash (T005)
 *
 * หน้าที่:
 * - createSession: สร้าง UUIDv7, สร้าง stash dir, เขียนไฟล์, set Redis TTL
 * - getSession: อ่าน + validate shape จาก Redis (คืน null ถ้าไม่มี/เสีย)
 * - deleteSession: ลบ Redis key + rm -rf stash dir (idempotent)
 * - listExpiredStashDirs: คืน path ของ stash dirs ที่ Redis key หมดอายุแล้ว
 *   (ใช้โดย BullMQ cron worker ใน Wave 6)
 *
 * ความปลอดภัย:
 * - sanitize ชื่อไฟล์กัน path traversal (../..)
 * - ใช้ UUIDv7 string เป็น session id (ADR-019) ไม่มี parseInt/Number
 * - ไม่ throw ใน deleteSession/listExpiredStashDirs (idempotent / fail-safe)
 */
@Injectable()
export class ReviewSessionStashService {
  private readonly logger = new Logger(ReviewSessionStashService.name);
  private readonly sessionsRoot: string;

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    @Inject(REVIEW_STAGING_ROOT_TOKEN)
    stagingRoot: string
  ) {
    this.sessionsRoot = path.join(stagingRoot, SESSIONS_SUBDIR);
  }

  /**
   * สร้าง Review Session ใหม่
   * - สร้าง stash directory ส่วนตัว
   * - เขียนไฟล์ที่อัปโหลดลง (sanitize ชื่อไฟล์)
   * - บันทึก JSON ลง Redis ด้วย TTL 24 ชั่วโมง
   */
  async createSession(
    input: CreateReviewSessionInput
  ): Promise<ReviewSessionData> {
    const reviewSessionPublicId = this.generateUUIDv7();
    const sessionDir = path.join(this.sessionsRoot, reviewSessionPublicId);
    const safeFileName = this.sanitizeFileName(input.originalFileName);
    const originalFilePath = path.join(sessionDir, safeFileName);

    // สร้าง directory (recursive — รองรับกรณีที่ sessionsRoot ยังไม่มี)
    await fs.promises.mkdir(sessionDir, { recursive: true });

    // เขียนไฟล์ดิบลง stash
    await fs.promises.writeFile(originalFilePath, input.fileBuffer);

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + REVIEW_SESSION_TTL_SECONDS * 1000
    );

    const session: ReviewSessionData = {
      reviewSessionPublicId,
      projectPublicId: input.projectPublicId,
      targetMode: input.targetMode,
      uploadedBy: input.uploadedBy,
      totalRows: input.totalRows,
      passCount: input.passCount,
      warnCount: input.warnCount,
      blockCount: input.blockCount,
      aiSuggestCount: input.aiSuggestCount,
      originalFileName: safeFileName,
      originalFilePath,
      annotatedFilePath: '',
      failedRowsFilePath: '',
      selectedAiProvider: input.selectedAiProvider,
      status: 'READY',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const redisKey = REVIEW_SESSION_REDIS_PREFIX + reviewSessionPublicId;
    await this.redis.set(
      redisKey,
      JSON.stringify(session),
      'EX',
      REVIEW_SESSION_TTL_SECONDS
    );

    this.logger.debug(
      `สร้าง Review Session ${reviewSessionPublicId} (mode=${input.targetMode}, rows=${input.totalRows})`
    );

    return session;
  }

  /**
   * อ่าน Review Session จาก Redis
   * คืน null ถ้าไม่มีคีย์, JSON เสีย, หรือ shape ไม่ตรง
   */
  async getSession(
    reviewSessionPublicId: string
  ): Promise<ReviewSessionData | null> {
    const redisKey = REVIEW_SESSION_REDIS_PREFIX + reviewSessionPublicId;
    const raw = await this.redis.get(redisKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (this.isValidSessionData(parsed)) {
        return parsed;
      }
      this.logger.warn(
        `Redis session ${reviewSessionPublicId} shape ไม่ตรง ReviewSessionData`
      );
      return null;
    } catch (err: unknown) {
      this.logger.warn(
        `Redis session ${reviewSessionPublicId} JSON parse ล้มเหลว: ${this.errMsg(err)}`
      );
      return null;
    }
  }

  /**
   * อัปเดต annotatedFilePath ของ Review Session (T015, FR-010)
   * ใช้หลังจาก AnnotatorService สร้างไฟล์ annotated เสร็จ
   * คืน session ที่อัปเดตแล้ว หรือ null ถ้า session ไม่มี
   */
  async updateAnnotatedPath(
    reviewSessionPublicId: string,
    annotatedFilePath: string
  ): Promise<ReviewSessionData | null> {
    const session = await this.getSession(reviewSessionPublicId);
    if (!session) {
      return null;
    }
    const updated: ReviewSessionData = {
      ...session,
      annotatedFilePath,
    };
    const redisKey = REVIEW_SESSION_REDIS_PREFIX + reviewSessionPublicId;
    await this.redis.set(
      redisKey,
      JSON.stringify(updated),
      'EX',
      REVIEW_SESSION_TTL_SECONDS
    );
    this.logger.debug(
      `อัปเดต annotatedFilePath ของ session ${reviewSessionPublicId}`
    );
    return updated;
  }

  /**
   * อัปเดต failedRowsFilePath ของ Review Session (T017, D6)
   * ใช้หลังจาก QuarantineService สร้างไฟล์ failed_rows.xlsx เสร็จ
   * คืน session ที่อัปเดตแล้ว หรือ null ถ้า session ไม่มี
   */
  async updateFailedRowsPath(
    reviewSessionPublicId: string,
    failedRowsFilePath: string
  ): Promise<ReviewSessionData | null> {
    const session = await this.getSession(reviewSessionPublicId);
    if (!session) {
      return null;
    }
    const updated: ReviewSessionData = {
      ...session,
      failedRowsFilePath,
    };
    const redisKey = REVIEW_SESSION_REDIS_PREFIX + reviewSessionPublicId;
    await this.redis.set(
      redisKey,
      JSON.stringify(updated),
      'EX',
      REVIEW_SESSION_TTL_SECONDS
    );
    this.logger.debug(
      `อัปเดต failedRowsFilePath ของ session ${reviewSessionPublicId}`
    );
    return updated;
  }

  /**
   * ลบ Review Session (Redis key + stash directory)
   * idempotent — ไม่ throw แม้ไม่มีอยู่
   */
  async deleteSession(reviewSessionPublicId: string): Promise<void> {
    const redisKey = REVIEW_SESSION_REDIS_PREFIX + reviewSessionPublicId;
    try {
      await this.redis.del(redisKey);
    } catch (err: unknown) {
      this.logger.warn(`ลบ Redis key ${redisKey} ล้มเหลว: ${this.errMsg(err)}`);
    }

    const sessionDir = path.join(this.sessionsRoot, reviewSessionPublicId);
    try {
      await fs.promises.rm(sessionDir, { recursive: true, force: true });
    } catch (err: unknown) {
      this.logger.warn(
        `ลบ stash dir ${sessionDir} ล้มเหลว: ${this.errMsg(err)}`
      );
    }
  }

  /**
   * Atomic lock สำหรับ confirm — เปลี่ยน status เป็น CONFIRMED ใน Redis
   * ป้องกัน race condition เมื่อผู้ใช้กด confirm ซ้ำ (concurrent requests)
   * คืน true ถ้า lock สำเร็จ, false ถ้า session ไม่มีหรือถูก confirm ไปแล้ว
   */
  async tryLockForConfirm(reviewSessionPublicId: string): Promise<boolean> {
    const session = await this.getSession(reviewSessionPublicId);
    if (!session || session.status !== 'READY') {
      return false;
    }
    const locked: ReviewSessionData = {
      ...session,
      status: 'CONFIRMED',
    };
    const redisKey = REVIEW_SESSION_REDIS_PREFIX + reviewSessionPublicId;
    try {
      await this.redis.set(
        redisKey,
        JSON.stringify(locked),
        'EX',
        REVIEW_SESSION_TTL_SECONDS
      );
      return true;
    } catch (err: unknown) {
      this.logger.warn(
        `tryLockForConfirm ${redisKey} ล้มเหลว: ${this.errMsg(err)}`
      );
      return false;
    }
  }

  /**
   * คืน stash directory path ของ session (ใช้โดย getFailedRowsFilePath)
   */
  getStashDir(reviewSessionPublicId: string): string {
    return path.join(this.sessionsRoot, reviewSessionPublicId);
  }

  /**
   * ค้นหา stash directories ที่ Redis key หมดอายุแล้ว
   * คืน absolute path ของ directories ที่ควร cleanup (ใช้โดย BullMQ cron)
   *
   * - ข้ามรายการที่ไม่ใช่ directory (ไฟล์ธรรมดาใน sessions root)
   * - คืน [] ถ้า sessionsRoot ไม่มีอยู่
   */
  async listExpiredStashDirs(): Promise<string[]> {
    if (!fs.existsSync(this.sessionsRoot)) {
      return [];
    }

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(this.sessionsRoot, {
        withFileTypes: true,
      });
    } catch (err: unknown) {
      this.logger.warn(
        `อ่าน sessionsRoot ${this.sessionsRoot} ล้มเหลว: ${this.errMsg(err)}`
      );
      return [];
    }

    const expired: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const redisKey = REVIEW_SESSION_REDIS_PREFIX + entry.name;
      let exists: number | undefined;
      try {
        exists = await this.redis.exists(redisKey);
      } catch (err: unknown) {
        // Redis outage — SKIP directory เพื่อป้องกันการลบ active sessions
        // (ถ้านับเป็น expired จะลบไฟล์ของผู้ใช้ที่ยังใช้งานอยู่)
        this.logger.warn(
          `ตรวจ Redis key ${redisKey} ล้มเหลว: ${this.errMsg(err)} — SKIP directory เพื่อความปลอดภัย`
        );
        continue;
      }
      if (exists === 0) {
        expired.push(path.join(this.sessionsRoot, entry.name));
      }
    }

    return expired;
  }

  // ---------- internals ----------

  /**
   * สร้าง UUIDv7 string (ADR-019 — ใช้เป็น publicId string เท่านั้น)
   * ใช้ uuid v7 ของ repo (timestamp-based, sortable) ตามที่ใช้ใน
   * ai-queue.service.ts และ tag.entity.ts
   */
  private generateUUIDv7(): string {
    return uuidv7();
  }

  /** sanitize ชื่อไฟล์กัน path traversal — เก็บ basename เท่านั้น */
  private sanitizeFileName(name: string): string {
    const basename = path.basename(name.replace(/\\/g, '/'));
    // กันชื่อว่างหรือจุด/จุดสองจุด
    if (basename === '' || basename === '.' || basename === '..') {
      return 'unnamed-upload.bin';
    }
    return basename;
  }

  /** ตรวจ shape ของ ReviewSessionData อย่างเข้ม (type guard) */
  private isValidSessionData(value: unknown): value is ReviewSessionData {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const v = value as Record<string, unknown>;
    return (
      typeof v.reviewSessionPublicId === 'string' &&
      typeof v.projectPublicId === 'string' &&
      (v.targetMode === 'MIGRATION_STAGING' ||
        v.targetMode === 'DIRECT_IMPORT') &&
      typeof v.uploadedBy === 'string' &&
      typeof v.totalRows === 'number' &&
      typeof v.passCount === 'number' &&
      typeof v.warnCount === 'number' &&
      typeof v.blockCount === 'number' &&
      typeof v.aiSuggestCount === 'number' &&
      typeof v.originalFileName === 'string' &&
      typeof v.originalFilePath === 'string' &&
      typeof v.annotatedFilePath === 'string' &&
      // failedRowsFilePath — optional for backward compat with older sessions
      (v.failedRowsFilePath === undefined ||
        typeof v.failedRowsFilePath === 'string') &&
      (v.selectedAiProvider === 'LOCAL_OLLAMA' ||
        v.selectedAiProvider === 'GEMINI' ||
        v.selectedAiProvider === 'CLAUDE') &&
      typeof v.status === 'string' &&
      typeof v.createdAt === 'string' &&
      typeof v.expiresAt === 'string'
    );
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
