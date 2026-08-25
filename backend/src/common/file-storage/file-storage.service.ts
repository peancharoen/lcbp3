// File: backend/src/common/file-storage/file-storage.service.ts
// Change Log:
// - 2026-08-06: เพิ่ม ALLOWED_UPLOAD_MIME_TYPES constant สำหรับ FR-004 (PDF, DOCX, DWG, XLSX, ZIP)
// - 2026-08-17: Phase 2.3 — เพิ่ม magic bytes validation ใน upload และ importStagingFile
//   เพื่อป้องกัน MIME spoofing (Issue #3, ADR-016)
// - 2026-08-25: ใช้ fs.copy แทน fs.move เมื่อ source อยู่ใน LEGACY_NAS_PATH (read-only NAS — D157)
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Attachment } from './entities/attachment.entity';
import { ForbiddenException } from '@nestjs/common'; // ✅ Import เพิ่ม
import {
  QUEUE_AI_BATCH,
  QUEUE_AI_REALTIME,
} from '../../modules/common/constants/queue.constants';
import { validateFileType } from './file-magic-bytes.util';
import { ClamAVService } from '../clamav/clamav.service';

/**
 * รายการ MIME types ที่อนุญาตสำหรับ upload (FR-004)
 * PDF, DOCX, DWG, XLSX, ZIP รวมภาพทั่วไป
 */
export const ALLOWED_UPLOAD_MIME_TYPES: readonly string[] = [
  // PDF
  'application/pdf',
  // DOCX
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  // XLSX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  // ZIP
  'application/zip',
  'application/x-zip-compressed',
  // DWG (FR-004 — เพิ่มการรองรับ DWG สำหรับ migration)
  'image/vnd.dwg',
  'application/acad',
  'application/x-acad',
  'application/dwg',
  'drawing/dwg',
  // รูปภาพทั่วไป
  'image/jpeg',
  'image/png',
  // octet-stream (fallback สำหรับ DWG ที่ browser รายงานไม่สม่ำเสมอ)
  'application/octet-stream',
] as const;

/** Regex สำหรับ FileTypeValidator ใน controller — ครอบคลุม MIME ทั้งหมดข้างต้น */
export const ALLOWED_UPLOAD_FILE_TYPE_REGEX =
  /(pdf|msword|openxmlformats|zip|octet-stream|image|jpeg|png|vnd\.dwg|acad|dwg|drawing)/;

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly tempDir: string;
  private readonly permanentDir: string;

  constructor(
    @InjectRepository(Attachment)
    private attachmentRepository: Repository<Attachment>,
    private configService: ConfigService,
    @Optional() @InjectQueue('rag-ocr') private readonly ragOcrQueue?: Queue,
    @Optional()
    @InjectQueue(QUEUE_AI_REALTIME)
    private readonly aiRealtimeQueue?: Queue,
    @Optional()
    @InjectQueue(QUEUE_AI_BATCH)
    private readonly aiBatchQueue?: Queue,
    @Optional()
    private readonly clamavService?: ClamAVService
  ) {
    // ใช้ env vars จาก docker-compose สำหรับ Production
    // ถ้าไม่ได้กำหนดจะ fallback เป็น ./uploads/temp และ ./uploads/permanent
    this.tempDir =
      this.configService.get<string>('UPLOAD_TEMP_DIR') ||
      path.join(process.cwd(), 'uploads', 'temp');
    this.permanentDir =
      this.configService.get<string>('UPLOAD_PERMANENT_DIR') ||
      path.join(process.cwd(), 'uploads', 'permanent');

    // สร้างโฟลเดอร์ temp และ permanent รอไว้เลยถ้ายังไม่มี
    fs.ensureDirSync(this.tempDir);
    fs.ensureDirSync(this.permanentDir);
  }

  /**
   * Phase 1: Upload (บันทึกไฟล์ลง Temp)
   * Idempotent: ถ้าไฟล์ checksum เดิมยังอยู่ใน temp (ไม่หมดอายุ) จะคืน record เดิมแทน
   * ป้องกัน orphan files จาก n8n retry
   */
  async upload(file: Express.Multer.File, userId: number): Promise<Attachment> {
    // Fix: แปลงชื่อไฟล์จาก Latin1 → UTF-8 (Multer/busboy decodes as Latin1 by default)
    const originalFilename = this.fixMulterFilename(file.originalname);

    // Phase 2.3: Magic bytes validation — ตรวจสอบไฟล์จริง ไม่ trust client MIME
    const fileTypeResult = validateFileType(
      file.buffer,
      originalFilename,
      file.mimetype
    );
    if (!fileTypeResult.valid) {
      this.logger.warn(
        `Magic bytes validation failed for "${originalFilename}": ${fileTypeResult.reason}`
      );
      throw new BadRequestException(
        `File type validation failed: ${fileTypeResult.reason}`
      );
    }

    // 1. คำนวณ Checksum (SHA-256) เพื่อความปลอดภัยและความถูกต้องของไฟล์
    const checksum = this.calculateChecksum(file.buffer);

    // 2. Checksum-based dedup — ถ้า temp attachment เดิมยังไม่หมดอายุ คืน record เดิมทันที
    const existing = await this.attachmentRepository
      .createQueryBuilder('a')
      .where('a.checksum = :checksum', { checksum })
      .andWhere('a.isTemporary = :isTemp', { isTemp: true })
      .andWhere('a.uploadedByUserId = :userId', { userId })
      .andWhere('a.expiresAt > :now', { now: new Date() })
      .getOne();
    if (existing) {
      this.logger.log(
        `Dedup upload: returning existing temp attachment publicId=${existing.publicId} checksum=${checksum}`
      );
      return existing;
    }

    const fileExt = path.extname(originalFilename);
    const storedFilename = `${uuidv4()}${fileExt}`;
    const tempPath = path.join(this.tempDir, storedFilename);

    // 3. บันทึกไฟล์ลง Disk (Temp Folder)
    try {
      await fs.writeFile(tempPath, file.buffer);
    } catch (error) {
      this.logger.error(`Failed to write file: ${tempPath}`, error);
      throw new BadRequestException('File upload failed');
    }

    // 3.5 ADR-016: ClamAV virus scan — สแกนไฟล์ก่อนสร้าง attachment record
    // หาก ClamAV ไม่ available จะข้ามการสแกน (graceful degradation)
    if (this.clamavService) {
      const scanResult = await this.clamavService.scanFile(tempPath);
      if (scanResult.isInfected) {
        // ลบไฟล์ที่ติดไวรัสทิ้งทันที
        await fs.unlink(tempPath).catch(() => undefined);
        const virusNames = scanResult.viruses?.join(', ') ?? 'UNKNOWN';
        this.logger.warn(
          `Virus detected in uploaded file "${originalFilename}": ${virusNames}`
        );
        throw new BadRequestException(
          `ไฟล์ที่อัปโหลดติดไวรัส (${virusNames}) — กรุณาสแกนไฟล์ด้วย antivirus ก่อนอัปโหลด`
        );
      }
    }

    // 4. สร้าง Record ใน Database
    const attachment = this.attachmentRepository.create({
      originalFilename,
      storedFilename: storedFilename,
      filePath: tempPath, // เก็บ path ปัจจุบันไปก่อน
      mimeType: file.mimetype,
      fileSize: file.size,
      isTemporary: true,
      tempId: uuidv4(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // หมดอายุใน 24 ชม.
      checksum: checksum,
      uploadedByUserId: userId,
    });

    return this.attachmentRepository.save(attachment);
  }

  /**
   * Phase 2: Commit (ย้ายไฟล์จาก Temp -> Permanent)
   * เมธอดนี้จะถูกเรียกโดย Service อื่น (เช่น CorrespondenceService) เมื่อกด Save
   */
  /**
   * Phase 2: Commit (ย้ายไฟล์จาก Temp -> Permanent)
   * เมธอดนี้จะถูกเรียกโดย Service อื่น (เช่น CorrespondenceService) เมื่อกด Save
   * Updated [Phase 2]: Support issueDate and documentType for organized storage
   */
  async commit(
    tempIds: string[],
    options?: {
      issueDate?: Date;
      documentType?: string;
      ragMeta?: {
        docType: string;
        docNumber: string | null;
        revision: string | null;
        projectCode: string;
        projectPublicId: string;
        classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
      };
    }
  ): Promise<Attachment[]> {
    if (!tempIds || tempIds.length === 0) {
      return [];
    }

    const attachments = await this.attachmentRepository.find({
      where: { tempId: In(tempIds), isTemporary: true },
    });

    if (attachments.length !== tempIds.length) {
      // แจ้งเตือนแต่อาจจะไม่ throw ถ้าต้องการให้ process ต่อไปได้บางส่วน (ขึ้นอยู่กับ business logic)
      // แต่เพื่อความปลอดภัยควรแจ้งว่าไฟล์ไม่ครบ
      this.logger.warn(
        `Expected ${tempIds.length} files to commit, but found ${attachments.length}`
      );
      throw new NotFoundException('Some files not found or already committed');
    }

    const committedAttachments: Attachment[] = [];
    // Use issueDate if provided, otherwise default to current date
    const refDate = options?.issueDate
      ? new Date(options.issueDate)
      : new Date();

    // Validate Date (in case invalid string passed)
    const effectiveDate = isNaN(refDate.getTime()) ? new Date() : refDate;

    const year = effectiveDate.getFullYear().toString();
    const month = (effectiveDate.getMonth() + 1).toString().padStart(2, '0');

    // Construct Path: permanent/{DocumentType}/{YYYY}/{MM}/filename
    const docTypeFolder = options?.documentType || 'General';

    // โฟลเดอร์ถาวรแยกตาม Type/ปี/เดือน
    const permanentDir = path.join(
      this.permanentDir,
      docTypeFolder,
      year,
      month
    );
    await fs.ensureDir(permanentDir);

    for (const att of attachments) {
      const oldPath = att.filePath;
      const newPath = path.join(permanentDir, att.storedFilename);

      try {
        // ย้ายไฟล์
        if (await fs.pathExists(oldPath)) {
          await fs.move(oldPath, newPath, { overwrite: true });

          // อัปเดตข้อมูลใน DB
          att.filePath = newPath;
          att.isTemporary = false;
          att.tempId = undefined; // เคลียร์ tempId
          att.expiresAt = undefined; // เคลียร์วันหมดอายุ
          att.referenceDate = effectiveDate; // Save reference date

          const saved = await this.attachmentRepository.save(att);
          committedAttachments.push(saved);

          if (this.ragOcrQueue && options?.ragMeta) {
            await this.ragOcrQueue
              .add(
                'ocr',
                {
                  attachmentPublicId: saved.publicId,
                  filePath: saved.filePath,
                  ...options.ragMeta,
                },
                { jobId: saved.publicId }
              )
              .catch((err: unknown) => {
                this.logger.error(
                  `Failed to enqueue rag-ocr for ${saved.publicId}`,
                  err instanceof Error ? err.stack : String(err)
                );
              });
          }

          if (options?.ragMeta?.projectPublicId) {
            await this.enqueueAiJobsForCommittedAttachment(
              saved,
              options.ragMeta.projectPublicId
            );
          }
        } else {
          this.logger.error(`File missing during commit: ${oldPath}`);
          throw new NotFoundException(
            `File not found on disk: ${att.originalFilename}`
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to move file from ${oldPath} to ${newPath}`,
          error
        );
        throw new BadRequestException(
          `Failed to commit file: ${att.originalFilename}`
        );
      }
    }

    return committedAttachments;
  }

  /**
   * ADR-021: Preview File by publicId (Content-Disposition: inline)
   * ดึงไฟล์มาเป็น Stream สำหรับแสดงผลใน Browser โดยตรง (ใช้กับ FilePreviewModal)
   */
  async preview(
    publicId: string
  ): Promise<{ stream: fs.ReadStream; attachment: Attachment }> {
    const attachment = await this.attachmentRepository.findOne({
      where: { publicId },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment not found`);
    }

    const filePath = attachment.filePath;
    if (!fs.existsSync(filePath)) {
      this.logger.error(`Preview file missing on disk: ${filePath}`);
      throw new NotFoundException('File not found on server storage');
    }

    const stream = fs.createReadStream(filePath);
    return { stream, attachment };
  }

  /**
   * Download File
   * ดึงไฟล์มาเป็น Stream เพื่อส่งกลับไปให้ Controller
   */
  async download(
    id: number
  ): Promise<{ stream: fs.ReadStream; attachment: Attachment }> {
    // 1. ค้นหาข้อมูลไฟล์จาก DB
    const attachment = await this.attachmentRepository.findOne({
      where: { id },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment #${id} not found`);
    }

    // 2. ตรวจสอบว่าไฟล์มีอยู่จริงบน Disk หรือไม่
    const filePath = attachment.filePath;
    if (!fs.existsSync(filePath)) {
      this.logger.error(`File missing on disk: ${filePath}`);
      throw new NotFoundException('File not found on server storage');
    }

    // 3. สร้าง Read Stream (มีประสิทธิภาพกว่าการโหลดทั้งไฟล์เข้า Memory)
    const stream = fs.createReadStream(filePath);

    return { stream, attachment };
  }

  /**
   * แก้ปัญหา Multer/busboy ถอดรหัสชื่อไฟล์เป็น Latin1 แทน UTF-8
   * ทำให้ภาษาไทยกลายเป็น mojibake (เช่น ผรม → 脿赂聹脿赂拢脿赂隆)
   * วิธีแก้: แปลง latin1 bytes กลับเป็น UTF-8
   */
  private fixMulterFilename(originalname: string): string {
    try {
      const decoded = Buffer.from(originalname, 'latin1').toString('utf8');
      // ตรวจสอบว่า decoded string มี valid UTF-8 characters
      // ถ้า originalname เป็น ASCII อยู่แล้ว ผลลัพธ์จะเหมือนเดิม
      return decoded;
    } catch {
      return originalname;
    }
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async enqueueAiJobsForCommittedAttachment(
    attachment: Attachment,
    projectPublicId: string
  ): Promise<void> {
    const commonPayload = {
      documentPublicId: attachment.publicId,
      projectPublicId,
      payload: { pdfPath: attachment.filePath },
    };
    const suggestResult = await this.aiRealtimeQueue
      ?.add(
        'ai-suggest',
        {
          ...commonPayload,
          jobType: 'ai-suggest',
          idempotencyKey: `suggest:${attachment.publicId}`,
        },
        { jobId: `suggest:${attachment.publicId}` }
      )
      .then(() => true)
      .catch((err: unknown) => {
        this.logger.warn(
          `AI job queue failed, document saved without AI: ${attachment.publicId} (${err instanceof Error ? err.message : String(err)})`
        );
        return false;
      });
    const embedResult = await this.aiBatchQueue
      ?.add(
        'embed-document',
        {
          ...commonPayload,
          jobType: 'embed-document',
          idempotencyKey: `embed:${attachment.publicId}`,
        },
        { jobId: `embed:${attachment.publicId}` }
      )
      .then(() => true)
      .catch((err: unknown) => {
        this.logger.warn(
          `AI job queue failed, document saved without AI: ${attachment.publicId} (${err instanceof Error ? err.message : String(err)})`
        );
        return false;
      });
    if (suggestResult === false || embedResult === false) {
      await this.attachmentRepository.update(
        { publicId: attachment.publicId },
        { aiProcessingStatus: 'FAILED' }
      );
    }
  }

  /**
   * ✅ NEW: Import Staging File (For Legacy Migration)
   * ย้ายไฟล์จาก staging_ai ไปยัง permanent storage โดยตรง
   */
  async importStagingFile(
    sourceFilePath: string,
    userId: number,
    options?: { issueDate?: Date; documentType?: string }
  ): Promise<Attachment> {
    // ADR-016: Path Traversal Guard — ตรวจสอบว่า sourceFilePath อยู่ภายใต้
    // staging directory (tempDir, MIGRATION_STAGING_DIR, หรือ LEGACY_NAS_PATH) เท่านั้น
    // LEGACY_NAS_PATH เพิ่มเพื่อรองรับการ import ไฟล์ PDF จาก NAS โดยตรง
    // (legacy ingestion เก็บ path ใน details.source_file_path ซึ่งอาจอยู่ใน NAS mount)
    const resolvedSource = path.resolve(sourceFilePath);
    const allowedStagingRoots = [
      path.resolve(this.tempDir),
      path.resolve(
        this.configService.get<string>('MIGRATION_STAGING_DIR') ||
          path.join(process.cwd(), 'uploads', 'staging')
      ),
      path.resolve(
        this.configService.get<string>('LEGACY_NAS_PATH') ||
          '/mnt/legacy-staging'
      ),
    ];
    // Note: constants สำหรับ staging dir อยู่ใน migration.constants.ts
    // file-storage เป็น common module จึงไม่ import migration constants โดยตรง
    // (avoid circular dependency between common/ and modules/)
    const isWithinAllowed = allowedStagingRoots.some(
      (root) =>
        resolvedSource === root || resolvedSource.startsWith(root + path.sep)
    );
    if (!isWithinAllowed) {
      this.logger.warn(
        `Path traversal blocked in importStagingFile: "${sourceFilePath}" resolves outside allowed staging dirs`
      );
      throw new BadRequestException(
        'Invalid staging file path — access denied (path traversal guard)'
      );
    }

    if (!(await fs.pathExists(resolvedSource))) {
      this.logger.error(`Staging file not found: ${resolvedSource}`);
      throw new NotFoundException(`Source file not found: ${resolvedSource}`);
    }

    // 1. Get file stats & checksum
    const stats = await fs.stat(resolvedSource);
    const fileExt = path.extname(resolvedSource);
    const originalFilename = path.basename(resolvedSource);
    const storedFilename = `${uuidv4()}${fileExt}`;

    // Determine mime type basic
    let mimeType = 'application/octet-stream';
    if (fileExt.toLowerCase() === '.pdf') mimeType = 'application/pdf';
    else if (fileExt.toLowerCase() === '.xlsx')
      mimeType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const fileBuffer = await fs.readFile(resolvedSource);

    // Phase 2.3: Magic bytes validation — ตรวจสอบไฟล์จริงก่อน commit
    const fileTypeResult = validateFileType(
      fileBuffer,
      originalFilename,
      mimeType
    );
    if (!fileTypeResult.valid) {
      this.logger.warn(
        `Magic bytes validation failed for staging file "${originalFilename}": ${fileTypeResult.reason}`
      );
      throw new BadRequestException(
        `Staging file type validation failed: ${fileTypeResult.reason}`
      );
    }
    // Override MIME ด้วยค่าที่ตรวจพบจริง (ถ้ามี)
    if (fileTypeResult.detectedMimeType) {
      mimeType = fileTypeResult.detectedMimeType;
    }

    const checksum = this.calculateChecksum(fileBuffer);

    // 2. Generate Permanent Path
    const refDate = options?.issueDate || new Date();
    const effectiveDate = isNaN(refDate.getTime()) ? new Date() : refDate;
    const year = effectiveDate.getFullYear().toString();
    const month = (effectiveDate.getMonth() + 1).toString().padStart(2, '0');
    const docTypeFolder = options?.documentType || 'General';

    const permanentDir = path.join(
      this.permanentDir,
      docTypeFolder,
      year,
      month
    );
    await fs.ensureDir(permanentDir);

    const newPath = path.join(permanentDir, storedFilename);

    // 3. Copy/Move File — ใช้ copy แทน move เมื่อ source อยู่ใน LEGACY_NAS_PATH (read-only NAS mount)
    // เพื่อป้องกัน EROFS error ตอน fs.move พยายาม unlink source file (D157)
    const legacyNasPath = path.resolve(
      this.configService.get<string>('LEGACY_NAS_PATH') || '/mnt/legacy-staging'
    );
    const isFromLegacyNas =
      resolvedSource === legacyNasPath ||
      resolvedSource.startsWith(legacyNasPath + path.sep);

    try {
      if (isFromLegacyNas) {
        // Read-only mount: copy แทน move (ไม่ต้องลบ source)
        await fs.copy(resolvedSource, newPath, { overwrite: true });
      } else {
        // Writable staging: move (ลบ source หลัง copy)
        await fs.move(resolvedSource, newPath, { overwrite: true });
      }
    } catch (error) {
      this.logger.error(
        `Failed to copy/move staging file to ${newPath}`,
        error
      );
      throw new BadRequestException('Failed to process staging file');
    }

    // 4. Create Database Record
    const attachment = this.attachmentRepository.create({
      originalFilename,
      storedFilename,
      filePath: newPath,
      mimeType,
      fileSize: stats.size,
      isTemporary: false,
      referenceDate: effectiveDate,
      checksum,
      uploadedByUserId: userId,
    });

    return this.attachmentRepository.save(attachment);
  }

  /**
   * ✅ NEW: Delete File
   * ลบไฟล์ออกจาก Disk และ Database
   */
  async delete(id: number, userId: number): Promise<void> {
    // 1. ค้นหาไฟล์
    const attachment = await this.attachmentRepository.findOne({
      where: { id },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment #${id} not found`);
    }

    // 2. ตรวจสอบความเป็นเจ้าของ (Security Check)
    // อนุญาตให้ลบถ้าเป็นคนอัปโหลดเอง
    // (ในอนาคตอาจเพิ่มเงื่อนไข OR User เป็น Admin/Document Control)
    if (attachment.uploadedByUserId !== userId) {
      this.logger.warn(
        `User ${userId} tried to delete file ${id} owned by ${attachment.uploadedByUserId}`
      );
      throw new ForbiddenException('You are not allowed to delete this file');
    }

    // 3. ลบไฟล์ออกจาก Disk
    try {
      if (await fs.pathExists(attachment.filePath)) {
        await fs.remove(attachment.filePath);
      } else {
        this.logger.warn(
          `File not found on disk during deletion: ${attachment.filePath}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete file from disk: ${attachment.filePath}`,
        error
      );
      throw new BadRequestException('Failed to delete file from storage');
    }

    // 4. ลบ Record ออกจาก Database
    await this.attachmentRepository.remove(attachment);

    this.logger.log(`File deleted: ${id} by user ${userId}`);
  }
}
