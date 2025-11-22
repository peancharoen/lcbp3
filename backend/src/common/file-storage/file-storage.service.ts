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

    // สร้างโฟลเดอร์รอไว้เลยถ้ายังไม่มี
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
    const attachments = await this.attachmentRepository.find({
      where: { tempId: In(tempIds), isTemporary: true },
    });

    if (attachments.length !== tempIds.length) {
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
        await fs.move(oldPath, newPath, { overwrite: true });

        // อัปเดตข้อมูลใน DB
        att.filePath = newPath;
        att.isTemporary = false;
        att.tempId = undefined; // เคลียร์ tempId
        att.expiresAt = undefined; // เคลียร์วันหมดอายุ

        committedAttachments.push(await this.attachmentRepository.save(att));
      } catch (error) {
        this.logger.error(
          `Failed to move file from ${oldPath} to ${newPath}`,
          error,
        );
        // ถ้า error ตัวนึง ควรจะ rollback หรือ throw error (ในที่นี้ throw เพื่อให้ Transaction ของผู้เรียกจัดการ)
        throw new BadRequestException(
          `Failed to commit file: ${att.originalFilename}`,
        );
      }
    }

    return committedAttachments;
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}
