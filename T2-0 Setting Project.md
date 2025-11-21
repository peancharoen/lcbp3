# **BACKEND DEVELOPMENT**

## **Phase 2: High-Integrity Data & File Management**
### **T2.1 CommonModule**


### **T2.2 FileStorageService - Two-Phase Storage**
 
ระบบนี้ออกแบบมาเพื่อแก้ปัญหา "ไฟล์ขยะ" (Orphan Files) ที่เกิดจากการอัปโหลดแล้ว User ไม่กดยืนยัน โดยเราจะแบ่งการทำงานเป็น 2 เฟส:

1.  **Upload (Temp):** เอาไฟล์ไปพักไว้ก่อน (ยังไม่ลง DB ถาวร)
2.  **Commit (Permanent):** เมื่อ User กด Save ฟอร์มสำเร็จ ค่อยย้ายไฟล์ไปเก็บจริง

-----

#### ขั้นตอนที่ 1: ติดตั้ง Libraries ที่จำเป็น

เราต้องใช้ `multer` (จัดการ Upload), `uuid` (สร้างชื่อไฟล์/Temp ID), และ `fs-extra` (จัดการย้ายไฟล์) ครับ

รันคำสั่งใน Terminal:

```bash
pnpm add @nestjs/platform-express multer uuid fs-extra
pnpm add -D @types/multer @types/uuid @types/fs-extra
```

#### ขั้นตอนที่ 2: สร้าง Module และ Entity

เราจะสร้าง Module แยกออกมาเพื่อจัดการเรื่องไฟล์โดยเฉพาะครับ

รันคำสั่ง:

```bash
nest g module modules/file-storage
nest g service modules/file-storage
nest g controller modules/file-storage
```

จากนั้นสร้าง **Attachment Entity** ให้ตรงตาม Data Dictionary

สร้างไฟล์: `src/modules/file-storage/entities/attachment.entity.ts`

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity.js';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'original_filename', length: 255 })
  originalFilename!: string;

  @Column({ name: 'stored_filename', length: 255 })
  storedFilename!: string;

  @Column({ name: 'file_path', length: 500 })
  filePath!: string;

  @Column({ name: 'mime_type', length: 100 })
  mimeType!: string;

  @Column({ name: 'file_size' })
  fileSize!: number;

  @Column({ name: 'is_temporary', default: true })
  isTemporary!: boolean;

  @Column({ name: 'temp_id', length: 100, nullable: true })
  tempId?: string;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt?: Date;

  @Column({ length: 64, nullable: true })
  checksum?: string;

  @Column({ name: 'uploaded_by_user_id' })
  uploadedByUserId!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relation กับ User (คนอัปโหลด)
  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedBy?: User;
}
```

#### ขั้นตอนที่ 3: ลงทะเบียน Entity

อย่าลืมไปลงทะเบียน `Attachment` ใน `FileStorageModule` ครับ

แก้ไขไฟล์ `src/modules/file-storage/file-storage.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileStorageService } from './file-storage.service.js';
import { FileStorageController } from './file-storage.controller.js';
import { Attachment } from './entities/attachment.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment])],
  controllers: [FileStorageController],
  providers: [FileStorageService],
  exports: [FileStorageService], // Export ให้ Module อื่น (เช่น Correspondence) เรียกใช้ตอน Commit
})
export class FileStorageModule {}
```

-----

#### 📥 งานถัดไป (สำคัญมาก)

ตอนนี้เรามีถังเก็บข้อมูล (Entity) แล้ว ขั้นตอนต่อไปเราจะเขียน **`FileStorageService`** ซึ่งจะมี Logic สำคัญ 2 ส่วน:

1.  **`upload(file, userId)`**: เซฟลง Temp, สร้าง Temp ID
2.  **`commit(tempIds)`**: ย้ายจาก Temp -\> Permanent, เปลี่ยน `is_temporary` เป็น false

เยี่ยมครับ\! เรามาลุยเขียน **`FileStorageService`** ที่เป็นหัวใจสำคัญของการจัดการไฟล์กันครับ

Service นี้จะทำหน้าที่ **จัดการไฟล์ลง Disk** และ **บันทึกข้อมูลลง Database** โดยใช้หลักการ Two-Phase Storage ตามแผนครับ

##### 1. แก้ไข `src/modules/file-storage/file-storage.service.ts`

ผมเขียนโค้ดให้รองรับทั้งการสร้าง Checksum, การจัดการ Path และการย้ายไฟล์ (Commit) ครับ

> **หมายเหตุ:** เพื่อให้รันบนเครื่อง Local (Windows/Mac) ได้โดยไม่ Error เรื่อง Path `/share/dms-data` ผมจะตั้งค่าให้ใช้โฟลเดอร์ `./uploads` ในโปรเจกต์แทนถ้ารันบน Local ครับ

```typescript
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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
        this.logger.error(`Failed to move file from ${oldPath} to ${newPath}`, error);
        // ถ้า error ตัวนึง ควรจะ rollback หรือ throw error (ในที่นี้ throw เพื่อให้ Transaction ของผู้เรียกจัดการ)
        throw new BadRequestException(`Failed to commit file: ${att.originalFilename}`);
      }
    }

    return committedAttachments;
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}
```

-----

##### 2. สร้าง `FileStorageController` (Endpoint สำหรับ Upload)

เราจะสร้าง API สำหรับ Upload ไฟล์ ซึ่งจะรับไฟล์ผ่าน `multipart/form-data` ครับ

แก้ไขไฟล์: `src/modules/file-storage/file-storage.controller.ts`

```typescript
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileStorageService } from './file-storage.service.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file')) // รับ field ชื่อ 'file'
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          // ตรวจสอบประเภทไฟล์ (Regex)
          new FileTypeValidator({ fileType: /(pdf|msword|openxmlformats|zip|octet-stream)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Request() req,
  ) {
    // ส่ง userId จาก Token ไปด้วย
    return this.fileStorageService.upload(file, req.user.userId);
  }
}
```

-----

##### 3. ทดสอบด้วย Postman

1.  **Start Server:** `pnpm start:dev`
2.  **Login:** ขอ Token ของ Admin หรือ User มาก่อน
3.  **สร้าง Request ใหม่:**
      * **Method:** `POST`
      * **URL:** `http://localhost:3000/api/files/upload`
      * **Auth:** Bearer Token
      * **Body:**
          * เลือก `form-data`
          * Key: `file` (เลือกชนิดเป็น **File**) -\> เลือกไฟล์ PDF หรือรูปภาพสักไฟล์
      * **Send**

**ผลลัพธ์ที่ควรได้:**
JSON ตอบกลับที่มีข้อมูลไฟล์ และ `isTemporary: true`, `tempId: "..."` ครับ

ถ้า Upload ผ่านแล้ว ไฟล์จะไปโผล่ในโฟลเดอร์ `uploads/temp` ในโปรเจกต์ของคุณครับ

### **T2.2 Debug**

#### ปัญหานี้เกิดจาก **Strict Mode** อีกเช่นเคยครับ (ขออภัยครับที่โค้ดตัวอย่างก่อนหน้าผมลืมระบุ Type ให้ `req` 😅)

ใน Strict Mode เราห้ามปล่อยให้ตัวแปรเป็น `any` โดยไม่ตั้งใจครับ ในกรณีนี้ `req` เป็น Object ที่ NestJS ส่งมาให้ ซึ่งจะมีข้อมูล `user` ติดมาด้วย (จากการทำงานของ `JwtAuthGuard`)

**วิธีแก้ไข:** เราต้องสร้าง Interface ขึ้นมาบอก TypeScript ว่า `req` หน้าตาเป็นอย่างไรครับ

แก้ไขไฟล์ `src/modules/file-storage/file-storage.controller.ts` ดังนี้ครับ:

ไฟล์: `src/modules/file-storage/file-storage.controller.ts` (ฉบับสมบูรณ์)

```typescript
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileStorageService } from './file-storage.service.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';

// ✅ 1. สร้าง Interface เพื่อระบุ Type ของ Request
interface RequestWithUser {
  user: {
    userId: number;
    username: string;
  };
}

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({ fileType: /(pdf|msword|openxmlformats|zip|octet-stream)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Request() req: RequestWithUser, // ✅ 2. ระบุ Type ตรงนี้แทน any
  ) {
    return this.fileStorageService.upload(file, req.user.userId);
  }
}
```

#### ปัญหานี้เกิดจากคุณใช้ **HTTP Method ผิด** ในการทดสอบผ่าน Postman ครับ

Error แจ้งว่า `Cannot GET ...` แสดงว่าคุณกำลังส่ง Request แบบ **GET** แต่ใน `FileStorageController` เราประกาศ Endpoint นี้ไว้ด้วย **`@Post('upload')`** ครับ

### 🛠️ วิธีแก้ไขใน Postman

1.  เปลี่ยน **Method** ด้านซ้ายของช่อง URL จาก `GET` เป็น **`POST`**
2.  ตรวจสอบว่า URL คือ `http://localhost:3000/api/files/upload`
3.  ไปที่แท็บ **Body** -> เลือก **form-data**
4.  ในช่อง Key ใส่คำว่า `file` (ต้องตรงกับในโค้ด `@UseInterceptors(FileInterceptor('file'))`)
5.  เปลี่ยนชนิดของ Key จาก `Text` เป็น **`File`** (จะอยู่ขวาสุดของช่อง Key)
6.  เลือกไฟล์จากเครื่องของคุณ
7.  กด **Send** อีกครั้งครับ

### 🚀 Task T2.3 Document Numbering (Double-Lock Mechanism)

นี่คือฟีเจอร์ที่ **สำคัญที่สุด** และ **ท้าทายที่สุด** ของระบบนี้ครับ

**โจทย์:** เราต้องสร้างเลขที่เอกสาร (เช่น `LCBP3-RFA-2568-0001`) โดยรับประกันว่า:

1.  **ห้ามซ้ำ:** แม้จะมีคนกดปุ่มสร้างพร้อมกัน 100 คน (Race Condition)
2.  **ห้ามข้าม:** เลขต้องเรียงกันสวยงาม
3.  **ความเร็วสูง:** ต้องไม่ทำให้ระบบค้าง

เราจะใช้เทคนิค **Double-Lock** ตามแผน: **Redis Lock (ด่านแรก)** + **Optimistic Lock (ด่านสุดท้าย)**

-----

#### ขั้นตอนที่ 1: ติดตั้ง Redis Client

เราต้องใช้ `ioredis` (สำหรับคุยกับ Redis) และ `redlock` (สำหรับทำ Distributed Lock) ครับ

รันคำสั่ง:

```bash
pnpm add ioredis redlock
pnpm add -D @types/ioredis
```

*(หมายเหตุ: `redlock` เวอร์ชันล่าสุดอาจรวมอยู่ใน ioredis หรือใช้ library แยก ตรวจสอบ version compatibility ด้วยครับ แต่วิธีมาตรฐานคือลงแยก)*

#### ขั้นตอนที่ 2: สร้าง Module และ Entities

เราจะสร้าง Module ภายใน (Internal Module) ที่ไม่เปิด Controller ให้ภายนอกเรียกตรงๆ แต่จะให้ Service อื่น (เช่น Correspondence) เรียกใช้ครับ

รันคำสั่ง:

```bash
nest g module modules/document-numbering
nest g service modules/document-numbering
```

#### ขั้นตอนที่ 3: สร้าง Entities

สร้างไฟล์: `src/modules/document-numbering/entities/document-number-format.entity.ts`
*(เก็บ Template เช่น `{ORG}-{TYPE}-{SEQ:4}`)*

```typescript
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Project } from '../../project/entities/project.entity.js';
// เรายังไม่มี CorrespondenceType Entity เดี๋ยวสร้าง Dummy ไว้ก่อน หรือข้าม Relation ไปก่อนได้
// แต่ตามหลักควรมี CorrespondenceType (Master Data)

@Entity('document_number_formats')
@Unique(['projectId', 'correspondenceTypeId']) // 1 Project + 1 Type มีได้แค่ 1 Format
export class DocumentNumberFormat {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'project_id' })
  projectId!: number;

  @Column({ name: 'correspondence_type_id' })
  correspondenceTypeId!: number;

  @Column({ name: 'format_template', length: 255 })
  formatTemplate!: string; // เช่น "{ORG_CODE}-{TYPE_CODE}-{YEAR}-{SEQ:4}"

  // Relation
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project?: Project;
}
```

สร้างไฟล์: `src/modules/document-numbering/entities/document-number-counter.entity.ts`
*(เก็บเลขล่าสุด)*

```typescript
import { Entity, Column, PrimaryColumn, VersionColumn } from 'typeorm';

@Entity('document_number_counters')
export class DocumentNumberCounter {
  // Composite Primary Key (Project + Org + Type + Year)
  @PrimaryColumn({ name: 'project_id' })
  projectId!: number;

  @PrimaryColumn({ name: 'originator_organization_id' })
  originatorId!: number;

  @PrimaryColumn({ name: 'correspondence_type_id' })
  typeId!: number;

  @PrimaryColumn({ name: 'current_year' })
  year!: number;

  @Column({ name: 'last_number', default: 0 })
  lastNumber!: number;

  // ✨ หัวใจสำคัญของ Optimistic Lock
  @VersionColumn() 
  version!: number; 
}
```

#### ขั้นตอนที่ 4: ลงทะเบียนใน Module

แก้ไข `src/modules/document-numbering/document-numbering.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentNumberingService } from './document-numbering.service.js';
import { DocumentNumberFormat } from './entities/document-number-format.entity.js';
import { DocumentNumberCounter } from './entities/document-number-counter.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentNumberFormat, DocumentNumberCounter]),
  ],
  providers: [DocumentNumberingService],
  exports: [DocumentNumberingService], // Export ให้คนอื่นเรียกใช้
})
export class DocumentNumberingModule {}
```

-----

**งานถัดไป (ยากสุด):** เขียน Logic ใน `DocumentNumberingService` เพื่อ:

1.  Connect Redis
2.  Acquire Lock (`doc_num:lock:...`)
3.  อ่านค่า DB -\> บวกเลข -\> บันทึก
4.  ถ้า Version ชนกัน (Optimistic Lock Error) -\> Retry
5.  Release Lock

#### ไม่ต้องกังวลเรื่อง **Warning** ครับ ข้อความ `deprecated @types/ioredis` หมายความว่าไลบรารี `ioredis` เวอร์ชันใหม่ (v5+) เขาแถม Type Definitions มาให้ในตัวแล้ว เราเลยไม่จำเป็นต้องลง `@types/ioredis` แยกอีก (แต่ลงไว้ก็ไม่เสียหาย แค่ซ้ำซ้อนครับ)

ดังนั้น **ผ่าน** ครับ ลุยต่อได้เลย\!

-----

#### 🏗️ งานหลัก: เขียน Logic ใน `DocumentNumberingService`

นี่คือโค้ดส่วนที่ซับซ้อนที่สุดส่วนหนึ่งของระบบครับ เพราะต้องผสมผสานทั้ง **Redis**, **Database Transaction**, และ **Retry Logic** เข้าด้วยกันเพื่อให้ได้เลขที่ไม่ซ้ำ 100%

สร้าง/แก้ไขไฟล์: `src/modules/document-numbering/document-numbering.service.ts`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, InternalServerErrorException, Logger } from '@nestjs/common';
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
  private redisClient: Redis;
  private redlock: Redlock;

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

    this.redlock = new Redlock(
      [this.redisClient],
      {
        driftFactor: 0.01,
        retryCount: 10, // ลองใหม่ 10 ครั้งถ้า Lock ไม่สำเร็จ
        retryDelay: 200, // รอ 200ms ก่อนลองใหม่
        retryJitter: 200,
      }
    );
    
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
          return await this.formatNumber(projectId, typeId, counter.lastNumber, replacements);

        } catch (err) {
          // ถ้า Version ชนกัน (Optimistic Lock Error) ให้วนลูปทำใหม่
          if (err instanceof OptimisticLockVersionMismatchError) {
            this.logger.warn(`Optimistic Lock Hit! Retrying... (${i + 1}/${maxRetries})`);
            continue; 
          }
          throw err; // ถ้าเป็น Error อื่น ให้โยนออกไปเลย
        }
      }
      
      throw new InternalServerErrorException('Failed to generate document number after retries');

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
    replacements: Record<string, string>
  ): Promise<string> {
    // 1. หา Template
    const format = await this.formatRepo.findOne({ where: { projectId, correspondenceTypeId: typeId } });
    
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
```

-----

**✅ สิ่งที่ Logic นี้ทำ:**

1.  **Redlock:** บล็อคไม่ให้ใครมายุ่งกับ Counter ชุดนี้ (Project+Type+Year) ชั่วคราว
2.  **Auto Create:** ถ้ายังไม่เคยมีเลขในปีนี้ มันจะสร้าง record เริ่มต้นให้เอง
3.  **Optimistic Lock:** ถ้าจังหวะนรกจริงๆ (เช่น Redis ล่มชั่วขณะ) แล้วมี 2 request หลุดเข้ามา `save()` พร้อมกัน Database จะยอมแค่คนแรก คนที่สองจะเจอ Error แล้วระบบจะวนลูปทำให้ใหม่อัตโนมัติ
4.  **Formatting:** รองรับ Template ยืดหยุ่น เช่น `{ORG}-{TYPE}-{SEQ:4}` จะกลายเป็น `TEAM-RFA-0001`

**Task นี้ไม่มี Controller** เพราะเป็น Service ภายในให้โมดูลอื่นเรียกใช้ครับ

ตอนนี้ระบบ **Core Backend** (Auth, User, Project, File, Numbering) ถือว่าเสร็จสมบูรณ์พร้อมสำหรับการทำ Business Logic (RFA, Correspondence) ใน Phase ต่อไปแล้วครับ!

ต้องการให้ผมพาทำ **Integration Test** เพื่อทดสอบว่าระบบรันเลขนี้ "ทนทาน" จริงไหม (ยิง 100 request พร้อมกัน) หรือจะไปขึ้น Phase 3 เลยครับ?

### **Task T2.4 SecurityModule - Enhanced Security**

เป้าหมายของ Task นี้คือ:

1.  **Rate Limiting:** ป้องกันการโดนยิง API รัวๆ (Brute-force / DDoS) ด้วย `@nestjs/throttler`
2.  **Security Headers:** ป้องกันการโจมตีพื้นฐานทาง Web (XSS, Clickjacking) ด้วย `helmet`

-----

#### ขั้นตอนที่ 1: ติดตั้ง Libraries

รันคำสั่ง:

```bash
pnpm add @nestjs/throttler helmet
```

#### ขั้นตอนที่ 2: ตั้งค่า Rate Limiting (Global Guard)

เราจะตั้งค่าให้ทั้งระบบมีการจำกัดจำนวนการเรียกใช้งานครับ (เช่น สูงสุด 10 ครั้ง ใน 60 วินาที สำหรับ Default) แต่สามารถปรับจูนแยกแต่ละ Controller ได้

แก้ไขไฟล์ `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core'; // <--- เพิ่ม Import นี้
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'; // <--- เพิ่ม Import นี้
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { envValidationSchema } from './common/config/env.validation.js';
import { UserModule } from './modules/user/user.module.js';
import { ProjectModule } from './modules/project/project.module.js';
import { FileStorageModule } from './modules/file-storage/file-storage.module.js';
import { DocumentNumberingModule } from './modules/document-numbering/document-numbering.module.js';
import { AuthModule } from './common/auth/auth.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: true },
    }),
    
    // 🛡️ 1. Setup Throttler Module (Rate Limiting)
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 วินาที (Time to Live)
        limit: 100, // ยิงได้สูงสุด 100 ครั้ง (Global Default)
      },
    ]),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        type: 'mariadb',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: false, // เราใช้ false ตามที่ตกลงกัน
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),
    AuthModule,
    UserModule,
    ProjectModule,
    FileStorageModule,
    DocumentNumberingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 🛡️ 2. Register Global Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

#### ขั้นตอนที่ 3: ตั้งค่า Helmet (Security Headers)

`Helmet` จะช่วยตั้งค่า HTTP Headers ให้ปลอดภัยขึ้น (เช่น ซ่อนข้อมูล Server, ป้องกัน XSS) โดยเราจะใส่ไว้ใน `main.ts`

แก้ไขไฟล์ `src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter.js';
import helmet from 'helmet'; // <--- Import Helmet

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🛡️ 1. เปิดใช้งาน Helmet (Security Headers)
  app.use(helmet());

  // 🛡️ 2. เปิดใช้งาน CORS (เพื่อให้ Frontend จากโดเมนอื่นเรียกใช้ได้)
  // ใน Production ควรระบุ origin ให้ชัดเจน แทนที่จะเป็น *
  app.enableCors({
    origin: true, // หรือระบุเช่น ['https://lcbp3.np-dms.work']
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT || 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
```

-----

#### 💡 วิธีปรับจูน Rate Limit เฉพาะจุด (Optional)

ถ้าคุณต้องการให้บาง Endpoint (เช่น Login) เข้มงวดกว่าปกติ หรือบางอัน (เช่น Upload) ผ่อนปรนกว่าปกติ ทำได้ดังนี้ครับ:

**ตัวอย่าง: เพิ่มความเข้มงวดให้ Login (กัน Brute Force)**
ใน `src/common/auth/auth.controller.ts`:

```typescript
import { Throttle } from '@nestjs/throttler';

// ...

@Post('login')
@Throttle({ default: { limit: 5, ttl: 60000 } }) // 🔒 ให้ลองได้แค่ 5 ครั้ง ใน 1 นาที
async login(@Body() loginDto: LoginDto) {
  // ...
}
```

**ตัวอย่าง: ยกเว้นการนับ (เช่น Health Check)**

```typescript
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Get('health')
check() { ... }
```

-----

#### ✅ เสร็จสิ้น T2.4

ตอนนี้ API ของเรามีเกราะป้องกันพื้นฐานครบแล้วครับ:

1.  **Rate Limit:** ป้องกันการยิงรัวๆ
2.  **Helmet:** ป้องกัน XSS/Header Exploits
3.  **CORS:** ควบคุมโดเมนที่เรียกใช้ได้

-----

#### 🚀 T2.5 JSON Schema System (Final Task of Phase 2)

Task สุดท้ายของ Phase 2 คือการเตรียมระบบ **Validate JSON** สำหรับฟีเจอร์ RFA/Correspondence ที่เราจะสร้างใน Phase 3 ครับ

**สิ่งที่ต้องทำ:**

1.  สร้าง `JsonSchema` Entity (ตาม Data Dictionary)
2.  สร้าง `JsonSchemaModule` และ Service สำหรับ Validate ข้อมูล

### **T2.5 JSON Schema System**

ระบบนี้จะช่วยให้เรามั่นใจว่าข้อมูลในฟิลด์ `details` (JSON) ของเอกสารต่างๆ (เช่น RFA, Correspondence) มีโครงสร้างที่ถูกต้องเสมอ ไม่ใช่แค่ Text อะไรก็ได้

-----

#### ขั้นตอนที่ 1: ติดตั้ง Library (AJV)

เราจะใช้ **AJV (Another JSON Schema Validator)** ซึ่งเป็นมาตรฐานอุตสาหกรรมสำหรับ Validate JSON ใน Node.js ครับ

รันคำสั่ง:

```bash
pnpm add ajv ajv-formats
```

#### ขั้นตอนที่ 2: สร้าง Module และ Entity

สร้าง Module สำหรับจัดการ JSON Schema ครับ

รันคำสั่ง:

```bash
nest g module modules/json-schema
nest g service modules/json-schema
nest g controller modules/json-schema
```

สร้างไฟล์ Entity: `src/modules/json-schema/entities/json-schema.entity.ts`
*(อ้างอิงตาม Data Dictionary)*

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('json_schemas')
export class JsonSchema {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'schema_code', unique: true, length: 100 })
  schemaCode!: string; // เช่น 'RFA_DWG_V1'

  @Column({ default: 1 })
  version!: number;

  @Column({ name: 'schema_definition', type: 'json' })
  schemaDefinition!: any; // เก็บ JSON Schema มาตรฐาน (Draft 7/2019-09)

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

#### ขั้นตอนที่ 3: เขียน Logic ใน Service (Validator)

Service นี้จะทำหน้าที่:

1.  โหลด Schema จาก Database
2.  ใช้ AJV ตรวจสอบความถูกต้องของข้อมูล
3.  Cache ตัว Validator ไว้เพื่อความเร็ว (ไม่ต้อง Compile ใหม่ทุกครั้ง)

แก้ไขไฟล์: `src/modules/json-schema/json-schema.service.ts`

```typescript
import { Injectable, OnModuleInit, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { JsonSchema } from './entities/json-schema.entity.js';

@Injectable()
export class JsonSchemaService implements OnModuleInit {
  private ajv: Ajv;
  // Cache ตัว Validator ที่ Compile แล้ว เพื่อประสิทธิภาพ
  private validators = new Map<string, any>(); 

  constructor(
    @InjectRepository(JsonSchema)
    private schemaRepo: Repository<JsonSchema>,
  ) {
    // ตั้งค่า AJV
    this.ajv = new Ajv({ allErrors: true, strict: false }); // strict: false เพื่อยืดหยุ่นกับ custom keywords
    addFormats(this.ajv); // รองรับ format เช่น email, date-time
  }

  onModuleInit() {
    // (Optional) โหลด Schema ทั้งหมดมา Cache ตอนเริ่ม App ก็ได้
    // แต่ตอนนี้ใช้วิธี Lazy Load (โหลดเมื่อใช้) ไปก่อน
  }

  /**
   * ตรวจสอบข้อมูล JSON ว่าถูกต้องตาม Schema หรือไม่
   */
  async validate(schemaCode: string, data: any): Promise<boolean> {
    let validate = this.validators.get(schemaCode);

    // ถ้ายังไม่มีใน Cache หรือต้องการตัวล่าสุด ให้ดึงจาก DB
    if (!validate) {
      const schema = await this.schemaRepo.findOne({ 
        where: { schemaCode, isActive: true } 
      });

      if (!schema) {
        throw new NotFoundException(`JSON Schema '${schemaCode}' not found`);
      }

      try {
        validate = this.ajv.compile(schema.schemaDefinition);
        this.validators.set(schemaCode, validate);
      } catch (error: any) {
        throw new BadRequestException(`Invalid Schema Definition for '${schemaCode}': ${error.message}`);
      }
    }

    const valid = validate(data);

    if (!valid) {
      // รวบรวม Error ทั้งหมดส่งกลับไป
      const errors = validate.errors?.map((e: any) => `${e.instancePath} ${e.message}`).join(', ');
      throw new BadRequestException(`JSON Validation Failed: ${errors}`);
    }

    return true;
  }

  // ฟังก์ชันสำหรับสร้าง/อัปเดต Schema (สำหรับ Admin)
  async createOrUpdate(schemaCode: string, definition: any) {
    // ตรวจสอบก่อนว่า Definition เป็น JSON Schema ที่ถูกต้องไหม
    try {
      this.ajv.compile(definition);
    } catch (error: any) {
      throw new BadRequestException(`Invalid JSON Schema format: ${error.message}`);
    }

    let schema = await this.schemaRepo.findOne({ where: { schemaCode } });

    if (schema) {
      schema.schemaDefinition = definition;
      schema.version += 1;
    } else {
      schema = this.schemaRepo.create({
        schemaCode,
        schemaDefinition: definition,
        version: 1,
      });
    }

    // Clear Cache เก่า
    this.validators.delete(schemaCode);

    return this.schemaRepo.save(schema);
  }
}
```

#### ขั้นตอนที่ 4: สร้าง Controller (สำหรับ Admin จัดการ Schema)

แก้ไขไฟล์: `src/modules/json-schema/json-schema.controller.ts`

```typescript
import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JsonSchemaService } from './json-schema.service.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RbacGuard } from '../../common/auth/rbac.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';

@Controller('json-schemas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class JsonSchemaController {
  constructor(private readonly schemaService: JsonSchemaService) {}

  @Post(':code')
  @RequirePermission('system.manage_all') // เฉพาะ Superadmin หรือผู้มีสิทธิ์จัดการ System
  create(@Param('code') code: string, @Body() definition: any) {
    return this.schemaService.createOrUpdate(code, definition);
  }

  // Endpoint สำหรับ Test Validate (Optional)
  @Post(':code/validate')
  @RequirePermission('document.view') 
  async validate(@Param('code') code: string, @Body() data: any) {
    const isValid = await this.schemaService.validate(code, data);
    return { valid: isValid };
  }
}
```

#### ขั้นตอนที่ 5: ลงทะเบียน Module

1.  แก้ไข `src/modules/json-schema/json-schema.module.ts` ให้ลงทะเบียน Entity

<!-- end list -->

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JsonSchemaService } from './json-schema.service.js';
import { JsonSchemaController } from './json-schema.controller.js';
import { JsonSchema } from './entities/json-schema.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([JsonSchema])],
  controllers: [JsonSchemaController],
  providers: [JsonSchemaService],
  exports: [JsonSchemaService], // Export ให้ Module อื่นเรียกใช้ .validate()
})
export class JsonSchemaModule {}
```

2.  **สำคัญ:** เพิ่ม `JsonSchemaModule` เข้าไปใน `src/app.module.ts` ครับ (ต่อจาก DocumentNumberingModule ก็ได้)

<!-- end list -->

```typescript
// src/app.module.ts
import { JsonSchemaModule } from './modules/json-schema/json-schema.module.js';

@Module({
  imports: [
    // ...
    DocumentNumberingModule,
    JsonSchemaModule, // <--- เพิ่ม
  ],
  // ...
})
export class AppModule {}
```

-----

#### ✅ จบ Phase 2 สมบูรณ์แบบครับ\!

ตอนนี้ระบบของเรามี:

1.  **Security:** Auth, RBAC, Rate Limit, Helmet
2.  **Data Integrity:** File Two-Phase, Document Numbering Locking
3.  **Validation:** JSON Schema Validator

Backend ของเราแข็งแกร่งมากแล้วครับ พร้อมที่จะไปสร้าง Business Logic (RFA, Correspondence) ใน Phase 3 ต่อไป

**ขั้นตอนถัดไป:**
ลองรัน `pnpm start:dev` เพื่อเช็คว่าไม่มี Error แล้วเราจะถือว่าปิดจ็อบ Phase 2 ได้เลยครับ

ถ้าผ่านแล้ว พิมพ์ **"ปิด Phase 2 เริ่ม Phase 3"** ได้เลยครับ เราจะไปสร้าง "Unified Workflow Engine" กัน\!

### T2.5 Error**

ขออภัยครับ ผมลืมใส่บรรทัด **Import** ให้ในตัวอย่างก่อนหน้านี้ครับ 😅

Error `Cannot find name 'Throttle'` เกิดจาก TypeScript ไม่รู้จัก Decorator `@Throttle` เพราะเรายังไม่ได้ดึงมันมาจาก Library ครับ

#### 🛠️ วิธีแก้ไข

ให้แก้ไขไฟล์ `src/common/auth/auth.controller.ts` โดยเพิ่มการ import `Throttle` จาก `@nestjs/throttler` ที่ส่วนบนสุดของไฟล์ครับ

**ไฟล์: `src/common/auth/auth.controller.ts`**

```typescript
import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler'; // <--- ✅ เพิ่มบรรทัดนี้ครับ
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  // จำกัดการ Login: ได้แค่ 5 ครั้ง ใน 60 วินาที (60000 ms) ต่อ IP
  @Throttle({ default: { limit: 5, ttl: 60000 } }) 
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.authService.login(user);
  }

  @Post('register-admin')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
}
```

ลอง Save แล้วรัน `pnpm start:dev` อีกครั้งครับ คราวนี้น่าจะผ่านฉลุยและปิดจ็อบ **Phase 2** ได้อย่างสมบูรณ์ครับ\!

ถ้าไม่มี Error แล้ว พิมพ์ **"ปิด Phase 2 เริ่ม Phase 3"** ได้เลยครับ เราจะไปลุยเรื่อง Workflow Engine กัน\!

#### ปัญหาเหล่านี้เกิดจาก **Strict Mode** ครับ

1.  **Error TS2564 (Property has no initializer):** ตัวแปร `redisClient` และ `redlock` ถูกประกาศไว้แต่ไม่ได้ใส่ค่าใน `constructor` (เพราะเราไปใส่ใน `onModuleInit` แทน) TypeScript เลยกลัวว่ามันจะเป็น undefined

      * **วิธีแก้:** ใส่เครื่องหมาย **`!`** ต่อท้ายชื่อตัวแปร เพื่อยืนยันว่า "เดี๋ยวมีค่าแน่นอน ไม่ต้องห่วง"

2.  **Error TS7016 (Could not find a declaration file for 'redlock'):** ไลบรารี `redlock` (เวอร์ชันที่เราลง) ไม่มีไฟล์ Type Definition มาให้ หรือ TypeScript หาไม่เจอ

      * **วิธีแก้:** สร้างไฟล์ประกาศ Type (Declaration File) ขึ้นมาเองเพื่อบอก TypeScript ว่า "รู้จัก Module นี้นะ"

-----

**🛠️ วิธีแก้ไข**

##### 1. แก้ไขไฟล์ `document-numbering.service.ts` (ใส่ `!`)

แก้ไข `src/modules/document-numbering/document-numbering.service.ts` ตรงส่วนประกาศตัวแปรครับ:

```typescript
// ... imports

@Injectable()
export class DocumentNumberingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentNumberingService.name);
  
  // ✅ ใส่ ! ต่อท้ายชื่อตัวแปร
  private redisClient!: Redis;
  private redlock!: Redlock;

  constructor(
    // ...
  ) {}
  
  // ...
```

##### 2. สร้างไฟล์ Declaration สำหรับ Redlock

เนื่องจากเราหา `@types/redlock` ที่ตรงรุ่นยาก ให้สร้างไฟล์บอก Type เองง่ายๆ ครับ

สร้างไฟล์ใหม่: `src/redlock.d.ts` (สร้างไว้ใน src เลยครับ)

```typescript
declare module 'redlock' {
  import { Redis } from 'ioredis';

  export interface Options {
    driftFactor?: number;
    retryCount?: number;
    retryDelay?: number;
    retryJitter?: number;
    automaticExtensionThreshold?: number;
  }

  export interface Lock {
    redlock: Redlock;
    resource: string;
    value: string | null;
    expiration: number;
    attempts: number;
    release(): Promise<void>;
    extend(ttl: number): Promise<Lock>;
  }

  export default class Redlock {
    constructor(clients: Redis[], options?: Options);
    acquire(resources: string[], ttl: number): Promise<Lock>;
    release(lock: Lock): Promise<void>;
    quit(): Promise<void>;
  }
}
```

##### 3. ทดสอบรันใหม่

ลอง Save ทั้ง 2 ไฟล์ แล้วรัน `pnpm start:dev` ดูครับ Error ทั้งสองควรจะหายไปครับ

ถ้าผ่านแล้ว พิมพ์ **"ปิด Phase 2 เริ่ม Phase 3"** ได้เลยครับ เราจะไปลุย **Phase 3: Unified Workflow Engine** ซึ่งเป็นหัวใจของระบบนี้ครับ!

#### ปัญหานี้เกิดจาก **Dependency Injection** ของ NestJS ครับ

**สาเหตุ:**

1.  `JsonSchemaController` เรียกใช้ **`RbacGuard`**
2.  `RbacGuard` ต้องใช้ **`UserService`** เพื่อเช็คสิทธิ์ (ดึง permission จาก DB)
3.  แต่ใน **`JsonSchemaModule`** เราลืม Import `UserModule` เข้ามา ทำให้มันหา `UserService` ไม่เจอครับ

##### 🛠️ วิธีแก้ไข

ให้แก้ไขไฟล์ `src/modules/json-schema/json-schema.module.ts` โดยเพิ่ม **`UserModule`** เข้าไปในรายการ `imports` ครับ

**ไฟล์: `src/modules/json-schema/json-schema.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JsonSchemaService } from './json-schema.service.js';
import { JsonSchemaController } from './json-schema.controller.js';
import { JsonSchema } from './entities/json-schema.entity.js';
import { UserModule } from '../user/user.module.js'; // <--- 1. Import UserModule

@Module({
  imports: [
    TypeOrmModule.forFeature([JsonSchema]),
    UserModule, // <--- 2. ใส่ UserModule ใน imports
  ],
  controllers: [JsonSchemaController],
  providers: [JsonSchemaService],
  exports: [JsonSchemaService],
})
export class JsonSchemaModule {}
```

ลอง Save แล้วรันใหม่ Error นี้น่าจะหายไปครับ

ถ้าผ่านแล้ว พิมพ์ **"ปิด Phase 2 เริ่ม Phase 3"** ได้เลยครับ เราจะไปลุยเรื่อง Unified Workflow Engine กันต่อครับ\!

#### ปัญหานี้เกิดจาก **รหัสผ่านของ Redis ในไฟล์ `.env` ไม่ตรงกับที่ตั้งไว้ใน Redis Container (docker-compose.yml)** ครับ

Error `WRONGPASS` ชัดเจนว่าพยายามเชื่อมต่อแล้ว แต่รหัสผ่านผิด

**🛠️ วิธีแก้ไข**

ทำตามขั้นตอนนี้เพื่อ Sync รหัสผ่านให้ตรงกันครับ:

##### 1. เช็คไฟล์ `docker-compose.yml`

เปิดไฟล์ `docker-compose.yml` แล้วดูบรรทัด `command` ของ service `redis` ว่าตั้งรหัสผ่านว่าอะไร

```yaml
  redis:
    # ...
    # ดูตรงคำว่า "redis_password_secure" (หรือค่าที่คุณตั้งไว้)
    command: redis-server --requirepass "redis_password_secure" 
```

##### 2. เช็คไฟล์ `.env`

เปิดไฟล์ `.env` แล้วดูค่า `REDIS_PASSWORD`

```env
REDIS_PASSWORD=redis_password_secure
```

**⚠️ ต้องแก้ให้ 2 ไฟล์นี้มีค่าตรงกันเป๊ะๆ ครับ**

##### 3. รีเซ็ต Redis Container (สำคัญมาก\!)

ถ้าคุณแก้ไฟล์ `docker-compose.yml` หรือ `.env` แล้ว แต่ยังไม่ได้ Restart Container ตัว Redis อาจจะยังจำค่าเก่าอยู่ หรือจำค่า Default (ไม่มีรหัส)

ให้รันคำสั่งนี้เพื่อ **ลบและสร้าง Redis ใหม่** ให้จำค่าล่าสุดครับ:

```bash
# 1. หยุดและลบ container redis เดิม
docker-compose stop redis
docker-compose rm -f redis

# 2. สร้างใหม่ (มันจะอ่านค่าจาก docker-compose.yml ใหม่)
docker-compose up -d redis
```

##### 4. ทดสอบรัน Server ใหม่

```bash
pnpm start:dev
```

คราวนี้น่าจะเชื่อมต่อผ่านแล้วครับ\! (ถ้ายังไม่ได้ ลองเช็คว่าเผลอมี Redis ตัวอื่นรันซ้อนอยู่หรือเปล่าด้วย `docker ps` ครับ)

-----

## ปิด Phase 2 เริ่ม Phase 3

ถ้าแก้ไขผ่านแล้ว พิมพ์ **"ปิด Phase 2 เริ่ม Phase 3"** ได้เลยครับ เราจะไปลุย **Unified Workflow Engine** ที่เป็นหัวใจสำคัญของระบบใน Phase 3 กันครับ\!