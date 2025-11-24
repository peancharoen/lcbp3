// File: src/common/file-storage/file-storage.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Attachment } from './entities/attachment.entity.js';
import { ForbiddenException } from '@nestjs/common'; // ✅ Import เพิ่ม

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly uploadRoot: string;

  constructor(
    @InjectRepository(Attachment)
    private attachmentRepository: Repository<Attachment>,
    private configService: ConfigService,
  ) {
    // ใช้ Path จริงถ้าอยู่บน Server (Production) หรือใช้ ./uploads ถ้าอยู่ Local
    this.uploadRoot =
      this.configService.get('NODE_ENV') === 'production'
        ? '/share/dms-data'
        : path.join(process.cwd(), 'uploads');

    // สร้างโฟลเดอร์ temp รอไว้เลยถ้ายังไม่มี
    fs.ensureDirSync(path.join(this.uploadRoot, 'temp'));
  }

  /**
   * Phase 1: Upload (บันทึกไฟล์ลง Temp)
   */
  async upload(file: Express.Multer.File, userId: number): Promise<Attachment> {
    const tempId = uuidv4();
    const fileExt = path.extname(file.originalname);
    const storedFilename = `${uuidv4()}${fileExt}`;
    const tempPath = path.join(this.uploadRoot, 'temp', storedFilename);

    // 1. คำนวณ Checksum (SHA-256) เพื่อความปลอดภัยและความถูกต้องของไฟล์
    const checksum = this.calculateChecksum(file.buffer);

    // 2. บันทึกไฟล์ลง Disk (Temp Folder)
    try {
      await fs.writeFile(tempPath, file.buffer);
    } catch (error) {
      this.logger.error(`Failed to write file: ${tempPath}`, error);
      throw new BadRequestException('File upload failed');
    }

    // 3. สร้าง Record ใน Database
    const attachment = this.attachmentRepository.create({
      originalFilename: file.originalname,
      storedFilename: storedFilename,
      filePath: tempPath, // เก็บ path ปัจจุบันไปก่อน
      mimeType: file.mimetype,
      fileSize: file.size,
      isTemporary: true,
      tempId: tempId,
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
  async commit(tempIds: string[]): Promise<Attachment[]> {
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
        `Expected ${tempIds.length} files to commit, but found ${attachments.length}`,
      );
      throw new NotFoundException('Some files not found or already committed');
    }

    const committedAttachments: Attachment[] = [];
    const today = new Date();
    const year = today.getFullYear().toString();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');

    // โฟลเดอร์ถาวรแยกตาม ปี/เดือน
    const permanentDir = path.join(this.uploadRoot, 'permanent', year, month);
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
          att.tempId = null as any; // เคลียร์ tempId (TypeORM อาจต้องการ null แทน undefined สำหรับ nullable)
          att.expiresAt = null as any; // เคลียร์วันหมดอายุ

          committedAttachments.push(await this.attachmentRepository.save(att));
        } else {
          this.logger.error(`File missing during commit: ${oldPath}`);
          throw new NotFoundException(
            `File not found on disk: ${att.originalFilename}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to move file from ${oldPath} to ${newPath}`,
          error,
        );
        throw new BadRequestException(
          `Failed to commit file: ${att.originalFilename}`,
        );
      }
    }

    return committedAttachments;
  }

  /**
   * Download File
   * ดึงไฟล์มาเป็น Stream เพื่อส่งกลับไปให้ Controller
   */
  async download(
    id: number,
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

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
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
        `User ${userId} tried to delete file ${id} owned by ${attachment.uploadedByUserId}`,
      );
      throw new ForbiddenException('You are not allowed to delete this file');
    }

    // 3. ลบไฟล์ออกจาก Disk
    try {
      if (await fs.pathExists(attachment.filePath)) {
        await fs.remove(attachment.filePath);
      } else {
        this.logger.warn(
          `File not found on disk during deletion: ${attachment.filePath}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete file from disk: ${attachment.filePath}`,
        error,
      );
      throw new BadRequestException('Failed to delete file from storage');
    }

    // 4. ลบ Record ออกจาก Database
    await this.attachmentRepository.remove(attachment);

    this.logger.log(`File deleted: ${id} by user ${userId}`);
  }
}
