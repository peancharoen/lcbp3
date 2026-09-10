// File: backend/test/rag-attachment-schema.e2e-spec.ts
// Change Log:
// - 2026-09-09: T022 — เพิ่ม RED integration test สำหรับ rag_attachment_pages/chunks schema และ FK behavior (Feature 254)

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Attachment } from '../src/common/file-storage/entities/attachment.entity';
import { RagAttachmentGeneration } from '../src/modules/ai/entities/rag-attachment-generation.entity';
import { RagAttachmentPage } from '../src/modules/ai/entities/rag-attachment-page.entity';
import { RagAttachmentChunk } from '../src/modules/ai/entities/rag-attachment-chunk.entity';

/**
 * รูปแบบ UUIDv7 ตาม ADR-019 — version nibble = 7, variant nibble = 8/9/a/b
 */
const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Feature 254 — T022: RAG Attachment Schema (E2E / RED)
 *
 * Integration test สำหรับ validate schema และ FK behavior ของ
 * rag_attachment_pages และ rag_attachment_chunks (ADR-044).
 *
 * ต้องการ test DB (MariaDB) ที่ apply delta 2026-09-09-rag-attachment-chunks.sql แล้ว
 * — หาก test env ไม่มี DB ที่พร้อมใช้งาน beforeAll จะ throw ทำให้ suite เป็น RED
 *   จนกว่า persistence services จะถูก wire ใน Wave 3/4 และ DB พร้อมใช้งาน
 *
 * Coverage:
 * 1. RagAttachmentPage persist ได้พร้อม FK ไป RagAttachmentGeneration
 * 2. RagAttachmentChunk persist ได้พร้อม FK ไป RagAttachmentGeneration
 * 3. chunk_public_id เป็น UUIDv7 format (ADR-019)
 * 4. ลบ generation แล้ว page/chunk ถูก cascade-delete ตาม schema (ON DELETE CASCADE)
 * 5. start_offset / end_offset ถูก persist กลับมาถูกต้อง
 */
describe('RAG Attachment Schema (E2E) — Feature 254 T022', () => {
  let moduleFixture: TestingModule;
  let dataSource: DataSource;
  let attachmentRepo: Repository<Attachment>;
  let generationRepo: Repository<RagAttachmentGeneration>;
  let pageRepo: Repository<RagAttachmentPage>;
  let chunkRepo: Repository<RagAttachmentChunk>;

  /** UUID ของ attachment seed ที่ใช้ทั้ง suite — ลบใน afterAll */
  let seedAttachmentUuid: string;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            type: 'mariadb',
            host: configService.get<string>('DB_HOST', 'localhost'),
            port: configService.get<number>('DB_PORT', 3306),
            username: configService.get<string>('DB_USERNAME', 'admin'),
            password: configService.get<string>('DB_PASSWORD', 'Center2025'),
            database: configService.get<string>('DB_DATABASE', 'lcbp3_dev'),
            charset: 'utf8mb4',
            autoLoadEntities: true,
            synchronize: false,
            connectTimeout: 30000,
            acquireTimeout: 30000,
            extra: { connectionLimit: 5 },
          }),
        }),
        TypeOrmModule.forFeature([
          Attachment,
          RagAttachmentGeneration,
          RagAttachmentPage,
          RagAttachmentChunk,
        ]),
      ],
    }).compile();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    attachmentRepo = dataSource.getRepository(Attachment);
    generationRepo = dataSource.getRepository(RagAttachmentGeneration);
    pageRepo = dataSource.getRepository(RagAttachmentPage);
    chunkRepo = dataSource.getRepository(RagAttachmentChunk);

    // seed attachment ต้นทางสำหรับ FK chain (attachments.uuid <- generation.attachment_uuid)
    const seed = attachmentRepo.create({
      originalFilename: 'rag-schema-e2e-seed.pdf',
      storedFilename: 'rag-schema-e2e-seed.pdf',
      filePath: '/tmp/rag-schema-e2e-seed.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      isTemporary: false,
      checksum: 'a'.repeat(64),
      aiProcessingStatus: 'DONE',
      classification: 'INTERNAL',
      uploadedByUserId: 1,
    });
    const saved = await attachmentRepo.save(seed);
    seedAttachmentUuid = saved.publicId;
  });

  afterAll(async () => {
    // best-effort cleanup — swallow error ถ้า DB/transaction ไม่พร้อม
    if (dataSource && dataSource.isInitialized) {
      try {
        await chunkRepo.delete({});
        await pageRepo.delete({});
        await generationRepo.delete({});
        if (seedAttachmentUuid) {
          await attachmentRepo.delete({ publicId: seedAttachmentUuid });
        }
      } catch {
        // ไม่ log ตามกฎ no-console; cleanup failure ไม่กระทบ verdict
      }
    }
    if (moduleFixture) {
      await moduleFixture.close();
    }
  });

  it('1. RagAttachmentPage persist ได้พร้อม FK ไป RagAttachmentGeneration', async () => {
    const generationUuid = uuidv7();
    const pageUuid = uuidv7();

    await generationRepo.save(
      generationRepo.create({
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        attachmentChecksumSnapshot: 'b'.repeat(64),
        status: 'BUILDING',
        embeddingModel: 'bge-m3',
      })
    );

    const page = await pageRepo.save(
      pageRepo.create({
        pageUuid,
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        segmentType: 'PAGE',
        segmentNumber: 1,
        segmentLabel: 'Page 1',
        normalizedText: 'สาระสำคัญของหน้า 1',
        normalizedStartOffset: '0',
        normalizedEndOffset: '100',
      })
    );

    expect(page).toBeDefined();
    expect(page.pageUuid).toBe(pageUuid);
    expect(page.generationUuid).toBe(generationUuid);

    const reloaded = await pageRepo.findOne({
      where: { pageUuid },
    });
    expect(reloaded).not.toBeNull();
    expect(reloaded?.generationUuid).toBe(generationUuid);
  });

  it('2. RagAttachmentChunk persist ได้พร้อม FK ไป RagAttachmentGeneration', async () => {
    const generationUuid = uuidv7();
    const pageUuid = uuidv7();
    const chunkPublicId = uuidv7();

    await generationRepo.save(
      generationRepo.create({
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        attachmentChecksumSnapshot: 'c'.repeat(64),
        status: 'BUILDING',
        embeddingModel: 'bge-m3',
      })
    );

    await pageRepo.save(
      pageRepo.create({
        pageUuid,
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        segmentType: 'PAGE',
        segmentNumber: 1,
        normalizedText: 'เนื้อหาต้นฉบับ',
        normalizedStartOffset: '0',
        normalizedEndOffset: '50',
      })
    );

    const chunk = await chunkRepo.save(
      chunkRepo.create({
        chunkPublicId,
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        chunkIndex: 0,
        content: 'chunk ตัวอย่างสำหรับ retrieval',
        sourcePageUuid: pageUuid,
        segmentType: 'PAGE',
        segmentNumber: 1,
        startOffset: '0',
        endOffset: '50',
        ownerType: 'CORRESPONDENCE',
        ownerPublicId: uuidv7(),
        projectPublicId: uuidv7(),
        classification: 'INTERNAL',
      })
    );

    expect(chunk).toBeDefined();
    expect(chunk.chunkPublicId).toBe(chunkPublicId);
    expect(chunk.generationUuid).toBe(generationUuid);

    const reloaded = await chunkRepo.findOne({
      where: { chunkPublicId },
    });
    expect(reloaded).not.toBeNull();
    expect(reloaded?.generationUuid).toBe(generationUuid);
  });

  it('3. chunk_public_id เป็น UUIDv7 format (ADR-019)', async () => {
    const generationUuid = uuidv7();
    const pageUuid = uuidv7();
    const chunkPublicId = uuidv7();

    await generationRepo.save(
      generationRepo.create({
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        attachmentChecksumSnapshot: 'd'.repeat(64),
        status: 'BUILDING',
        embeddingModel: 'bge-m3',
      })
    );

    await pageRepo.save(
      pageRepo.create({
        pageUuid,
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        segmentType: 'PAGE',
        segmentNumber: 1,
        normalizedText: 'เนื้อหาสำหรับ UUIDv7 check',
        normalizedStartOffset: '0',
        normalizedEndOffset: '10',
      })
    );

    await chunkRepo.save(
      chunkRepo.create({
        chunkPublicId,
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        chunkIndex: 0,
        content: 'chunk UUIDv7',
        sourcePageUuid: pageUuid,
        segmentType: 'PAGE',
        startOffset: '0',
        endOffset: '10',
        ownerType: 'CORRESPONDENCE',
        ownerPublicId: uuidv7(),
        projectPublicId: uuidv7(),
        classification: 'INTERNAL',
      })
    );

    // ตรวจว่าค่าที่ persist กลับมาเป็น UUIDv7 ตาม ADR-019
    expect(chunkPublicId).toMatch(UUID_V7_REGEX);

    const reloaded = await chunkRepo.findOne({
      where: { chunkPublicId },
    });
    expect(reloaded).not.toBeNull();
    expect(reloaded?.chunkPublicId).toMatch(UUID_V7_REGEX);
  });

  it('4. ลบ generation แล้ว page/chunk ถูก cascade-delete ตาม schema (ON DELETE CASCADE)', async () => {
    const generationUuid = uuidv7();
    const pageUuid = uuidv7();
    const chunkPublicId = uuidv7();

    await generationRepo.save(
      generationRepo.create({
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        attachmentChecksumSnapshot: 'e'.repeat(64),
        status: 'BUILDING',
        embeddingModel: 'bge-m3',
      })
    );

    await pageRepo.save(
      pageRepo.create({
        pageUuid,
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        segmentType: 'PAGE',
        segmentNumber: 1,
        normalizedText: 'เนื้อหาสำหรับ cascade test',
        normalizedStartOffset: '0',
        normalizedEndOffset: '20',
      })
    );

    await chunkRepo.save(
      chunkRepo.create({
        chunkPublicId,
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        chunkIndex: 0,
        content: 'chunk cascade',
        sourcePageUuid: pageUuid,
        segmentType: 'PAGE',
        startOffset: '0',
        endOffset: '20',
        ownerType: 'CORRESPONDENCE',
        ownerPublicId: uuidv7(),
        projectPublicId: uuidv7(),
        classification: 'INTERNAL',
      })
    );

    // ยืนยันว่ามีข้อมูลก่อนลบ
    const pageBefore = await pageRepo.findOne({ where: { pageUuid } });
    const chunkBefore = await chunkRepo.findOne({ where: { chunkPublicId } });
    expect(pageBefore).not.toBeNull();
    expect(chunkBefore).not.toBeNull();

    // ลบ generation — schema กำหนด ON DELETE CASCADE สำหรับ page และ chunk
    await generationRepo.delete({ generationUuid });

    const pageAfter = await pageRepo.findOne({ where: { pageUuid } });
    const chunkAfter = await chunkRepo.findOne({ where: { chunkPublicId } });
    expect(pageAfter).toBeNull();
    expect(chunkAfter).toBeNull();
  });

  it('5. start_offset / end_offset ถูก persist กลับมาถูกต้อง', async () => {
    const generationUuid = uuidv7();
    const pageUuid = uuidv7();
    const chunkPublicId = uuidv7();

    await generationRepo.save(
      generationRepo.create({
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        attachmentChecksumSnapshot: 'f'.repeat(64),
        status: 'BUILDING',
        embeddingModel: 'bge-m3',
      })
    );

    await pageRepo.save(
      pageRepo.create({
        pageUuid,
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        segmentType: 'PAGE',
        segmentNumber: 1,
        normalizedText: 'เนื้อหาสำหรับ offset test',
        normalizedStartOffset: '0',
        normalizedEndOffset: '200',
      })
    );

    const startOffset = '1234567890';
    const endOffset = '1234567999';

    await chunkRepo.save(
      chunkRepo.create({
        chunkPublicId,
        generationUuid,
        attachmentUuid: seedAttachmentUuid,
        chunkIndex: 0,
        content: 'chunk offset round-trip',
        sourcePageUuid: pageUuid,
        segmentType: 'PAGE',
        startOffset,
        endOffset,
        ownerType: 'CORRESPONDENCE',
        ownerPublicId: uuidv7(),
        projectPublicId: uuidv7(),
        classification: 'INTERNAL',
      })
    );

    const reloaded = await chunkRepo.findOne({
      where: { chunkPublicId },
    });
    expect(reloaded).not.toBeNull();
    // bigint กลับมาเป็น string — เปรียบเทียบค่าตรงๆ
    expect(reloaded?.startOffset).toBe(startOffset);
    expect(reloaded?.endOffset).toBe(endOffset);
  });
});
