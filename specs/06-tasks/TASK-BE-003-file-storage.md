# Task: File Storage Service (Two-Phase)

**Status:** Not Started
**Priority:** P1 (High)
**Estimated Effort:** 4-5 days
**Dependencies:** TASK-BE-001 (Database), TASK-BE-002 (Auth)
**Owner:** Backend Team

---

## 📋 Overview

สร้าง FileStorageService ที่ใช้ Two-Phase Storage Pattern (Temp → Permanent) พร้อม Virus Scanning และ File Validation

---

## 🎯 Objectives

- ✅ Two-Phase Upload System
- ✅ Virus Scanning Integration (ClamAV)
- ✅ File Type Validation
- ✅ Automated Cleanup Job
- ✅ File Metadata Management

---

## 📝 Acceptance Criteria

1. **Phase 1 - Temp Upload:**

   - ✅ Upload file → Scan virus → Save to temp/
   - ✅ Generate temp_id and return to client
   - ✅ Set expiration (24 hours)
   - ✅ Calculate SHA-256 checksum

2. **Phase 2 - Commit:**

   - ✅ Move temp file → permanent/{YYYY}/{MM}/
   - ✅ Update attachment record (is_temporary=false)
   - ✅ Link to parent entity (correspondence, rfa, etc.)
   - ✅ Transaction-safe (rollback on error)

3. **Cleanup:**
   - ✅ Cron job runs every 6 hours
   - ✅ Delete expired temp files
   - ✅ Delete orphan files (no DB record)

---

## 🛠️ Implementation Steps

### 1. File Storage Service

```typescript
// File: backend/src/common/file-storage/file-storage.service.ts
import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileStorageService {
  private readonly TEMP_DIR: string;
  private readonly PERMANENT_DIR: string;
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  constructor(
    private config: ConfigService,
    private virusScanner: VirusScannerService,
    @InjectRepository(Attachment)
    private attachmentRepo: Repository<Attachment>
  ) {
    this.TEMP_DIR = path.join(config.get('STORAGE_PATH'), 'temp');
    this.PERMANENT_DIR = path.join(config.get('STORAGE_PATH'), 'permanent');
    this.ensureDirectories();
  }

  async uploadToTemp(
    file: Express.Multer.File,
    userId: number
  ): Promise<UploadResult> {
    // 1. Validate file
    this.validateFile(file);

    // 2. Virus scan
    const scanResult = await this.virusScanner.scan(file.buffer);
    if (scanResult.isInfected) {
      throw new BadRequestException(`Virus detected: ${scanResult.virusName}`);
    }

    // 3. Generate identifiers
    const tempId = uuidv4();
    const storedFilename = `${tempId}_${this.sanitizeFilename(
      file.originalname
    )}`;
    const tempPath = path.join(this.TEMP_DIR, storedFilename);

    // 4. Calculate checksum
    const checksum = this.calculateChecksum(file.buffer);

    // 5. Save to temp directory
    await fs.writeFile(tempPath, file.buffer);

    // 6. Create attachment record
    const attachment = await this.attachmentRepo.save({
      original_filename: file.originalname,
      stored_filename: storedFilename,
      file_path: tempPath,
      mime_type: file.mimetype,
      file_size: file.size,
      checksum,
      is_temporary: true,
      temp_id: tempId,
      expires_at: new Date(Date.now() + 24 * 3600 * 1000), // 24h
      uploaded_by_user_id: userId,
    });

    return {
      temp_id: tempId,
      filename: file.originalname,
      size: file.size,
      mime_type: file.mimetype,
      expires_at: attachment.expires_at,
    };
  }

  async commitFiles(
    tempIds: string[],
    entityId: number,
    entityType: string,
    manager: EntityManager
  ): Promise<Attachment[]> {
    const commitedAttachments = [];

    for (const tempId of tempIds) {
      // 1. Get temp attachment
      const tempAttachment = await manager.findOne(Attachment, {
        where: { temp_id: tempId, is_temporary: true },
      });

      if (!tempAttachment) {
        throw new NotFoundException(`Temp file not found: ${tempId}`);
      }

      if (tempAttachment.expires_at < new Date()) {
        throw new BadRequestException(`Temp file expired: ${tempId}`);
      }

      // 2. Generate permanent path
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const permanentDir = path.join(this.PERMANENT_DIR, year, month);
      await fs.ensureDir(permanentDir);

      const permanentFilename = `${uuidv4()}_${
        tempAttachment.original_filename
      }`;
      const permanentPath = path.join(permanentDir, permanentFilename);

      // 3. Move file (atomic operation)
      await fs.move(tempAttachment.file_path, permanentPath, {
        overwrite: false,
      });

      // 4. Update attachment record
      await manager.update(
        Attachment,
        { id: tempAttachment.id },
        {
          file_path: permanentPath,
          stored_filename: permanentFilename,
          is_temporary: false,
          temp_id: null,
          expires_at: null,
        }
      );

      commitedAttachments.push({ ...tempAttachment, file_path: permanentPath });
    }

    return commitedAttachments;
  }

  private validateFile(file: Express.Multer.File): void {
    // File type validation
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'application/zip',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }

    // Size validation
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('File too large (max 50MB)');
    }

    // Magic number validation
    this.validateMagicNumber(file.buffer, file.mimetype);
  }

  private validateMagicNumber(buffer: Buffer, mimetype: string): void {
    const signatures = {
      'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
      'image/png': [0x89, 0x50, 0x4e, 0x47], // PNG
      'image/jpeg': [0xff, 0xd8, 0xff], // JPEG
    };

    const signature = signatures[mimetype];
    if (signature) {
      for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
          throw new BadRequestException('File content does not match type');
        }
      }
    }
  }

  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private async ensureDirectories(): Promise<void> {
    await fs.ensureDir(this.TEMP_DIR);
    await fs.ensureDir(this.PERMANENT_DIR);
  }
}
```

### 2. Virus Scanner Service

```typescript
// File: backend/src/common/file-storage/virus-scanner.service.ts
import { Injectable } from '@nestjs/common';
import NodeClam from 'clamscan';

@Injectable()
export class VirusScannerService {
  private clamScan: NodeClam;

  async onModuleInit() {
    this.clamScan = await new NodeClam().init({
      clamdscan: {
        host: process.env.CLAMAV_HOST || 'localhost',
        port: process.env.CLAMAV_PORT || 3310,
      },
    });
  }

  async scan(buffer: Buffer): Promise<ScanResult> {
    const { isInfected, viruses } = await this.clamScan.scanStream(buffer);

    return {
      isInfected,
      virusName: viruses.length > 0 ? viruses[0] : null,
    };
  }
}
```

### 3. Cleanup Job

```typescript
// File: backend/src/common/file-storage/file-cleanup.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class FileCleanupService {
  constructor(
    @InjectRepository(Attachment)
    private attachmentRepo: Repository<Attachment>,
    private logger: Logger
  ) {}

  @Cron('0 */6 * * *') // Every 6 hours
  async cleanupExpiredFiles(): Promise<void> {
    this.logger.log('Starting expired file cleanup...');

    const expiredFiles = await this.attachmentRepo.find({
      where: {
        is_temporary: true,
        expires_at: LessThan(new Date()),
      },
    });

    let deleted = 0;
    for (const file of expiredFiles) {
      try {
        // Delete physical file
        await fs.remove(file.file_path);

        // Delete DB record
        await this.attachmentRepo.remove(file);

        deleted++;
      } catch (error) {
        this.logger.error(`Failed to delete file ${file.temp_id}:`, error);
      }
    }

    this.logger.log(`Cleaned up ${deleted} expired files`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOrphanFiles(): Promise<void> {
    // Find files in filesystem without DB records
    this.logger.log('Starting orphan file cleanup...');

    // Implementation...
  }
}
```

### 4. Controller

```typescript
// File: backend/src/common/file-storage/file-storage.controller.ts
@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class FileStorageController {
  constructor(private fileStorage: FileStorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User
  ): Promise<UploadResult> {
    return this.fileStorage.uploadToTemp(file, user.user_id);
  }

  @Get('temp/:tempId/download')
  async downloadTemp(@Param('tempId') tempId: string, @Res() res: Response) {
    const attachment = await this.attachmentRepo.findOne({
      where: { temp_id: tempId, is_temporary: true },
    });

    if (!attachment) {
      throw new NotFoundException('File not found');
    }

    res.download(attachment.file_path, attachment.original_filename);
  }

  @Delete('temp/:tempId')
  async deleteTempFile(@Param('tempId') tempId: string): Promise<void> {
    // Delete temp file
  }
}
```

---

## ✅ Testing & Verification

### 1. Unit Tests

```typescript
describe('FileStorageService', () => {
  it('should upload file to temp successfully', async () => {
    const mockFile = createMockFile('test.pdf', 'application/pdf');
    const result = await service.uploadToTemp(mockFile, 1);

    expect(result.temp_id).toBeDefined();
    expect(result.expires_at).toBeDefined();
  });

  it('should reject infected files', async () => {
    virusScanner.scan = jest.fn().mockResolvedValue({
      isInfected: true,
      virusName: 'EICAR-Test-File',
    });

    const mockFile = createMockFile('virus.exe', 'application/octet-stream');

    await expect(service.uploadToTemp(mockFile, 1)).rejects.toThrow(
      'Virus detected'
    );
  });

  it('should commit temp files to permanent', async () => {
    const tempIds = ['temp-id-1', 'temp-id-2'];

    const committed = await service.commitFiles(
      tempIds,
      1,
      'correspondence',
      manager
    );

    expect(committed).toHaveLength(2);
    expect(committed[0].is_temporary).toBe(false);
  });
});
```

### 2. Integration Tests

```bash
# Upload file
curl -X POST http://localhost:3000/attachments/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@test.pdf"

# Response: { "temp_id": "...", "expires_at": "..." }

# Create correspondence with temp file
curl -X POST http://localhost:3000/correspondences \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test",
    "project_id": 1,
    "temp_file_ids": ["<temp_id>"]
  }'
```

---

## 📚 Related Documents

- [ADR-003: Two-Phase File Storage](../05-decisions/ADR-003-file-storage-approach.md)
- [Backend Guidelines - File Storage](../03-implementation/backend-guidelines.md#file-storage)

---

## 📦 Deliverables

- [ ] FileStorageService
- [ ] VirusScannerService (ClamAV integration)
- [ ] FileCleanupService (Cron jobs)
- [ ] FileStorageController
- [ ] AttachmentEntity
- [ ] Unit Tests (85% coverage)
- [ ] Integration Tests
- [ ] Documentation

---

## 🚨 Risks & Mitigation

| Risk                | Impact   | Mitigation                       |
| ------------------- | -------- | -------------------------------- |
| ClamAV service down | High     | Queue scans, allow bypass in dev |
| Disk space full     | Critical | Monitoring + alerts              |
| File move failure   | Medium   | Atomic operations + retry logic  |
| Orphan files        | Low      | Cleanup job + monitoring         |

---

## 📌 Notes

- ClamAV requires separate Docker container
- Temp files expire after 24 hours
- Cleanup job runs every 6 hours
- Maximum file size: 50MB
- Supported types: PDF, DOCX, XLSX, PNG, JPEG, ZIP
