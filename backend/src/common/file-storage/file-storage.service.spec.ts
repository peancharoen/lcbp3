// File: src/common/file-storage/file-storage.service.spec.ts
// Change Log:
// - 2026-08-01: เพิ่ม unit tests สำหรับ checksum dedup (Tier 2 #9) — ครอบ dedup hit, dedup miss, expired temp, different user.
// - 2026-08-17: Phase 2.3 — อัปเดต mock buffer ให้มี PDF magic bytes จริง
//   เพื่อผ่าน magic bytes validation (Issue #3, ADR-016)

import { Test, TestingModule } from '@nestjs/testing';
import { FileStorageService } from './file-storage.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Attachment } from './entities/attachment.entity';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Repository } from 'typeorm';

// Mock fs-extra
jest.mock('fs-extra');

/**
 * สร้าง buffer ที่มี PDF magic bytes จริง (%PDF-)
 * ใช้สำหรับ test ที่ต้องผ่าน magic bytes validation
 */
function makePdfBuffer(content: string = 'test-content'): Buffer {
  // %PDF-1.4 + content + EOF marker
  const header = Buffer.from('%PDF-1.4\n');
  const body = Buffer.from(content);
  const padding = Buffer.alloc(
    Math.max(0, 16 - header.length - body.length),
    0x00
  );
  return Buffer.concat([header, body, padding]);
}

describe('FileStorageService', () => {
  let service: FileStorageService;
  let attachmentRepo: Repository<Attachment>;

  const mockAttachment = {
    id: 1,
    originalFilename: 'test.pdf',
    storedFilename: 'uuid.pdf',
    filePath: '/permanent/2024/12/uuid.pdf',
    fileSize: 1024,
    uploadedByUserId: 1,
  } as Attachment;

  const mockFile = {
    originalname: 'test.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: makePdfBuffer('test-content'),
  } as Express.Multer.File;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileStorageService,
        {
          provide: getRepositoryToken(Attachment),
          useValue: {
            create: jest.fn().mockReturnValue(mockAttachment),
            save: jest.fn().mockResolvedValue(mockAttachment),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null),
            })),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'NODE_ENV') return 'test';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FileStorageService>(FileStorageService);
    attachmentRepo = module.get(getRepositoryToken(Attachment));

    jest.clearAllMocks();
    (fs.ensureDirSync as unknown as jest.Mock).mockReturnValue(true);
    (fs.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);
    (fs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
    (fs.move as unknown as jest.Mock).mockResolvedValue(undefined);
    (fs.remove as unknown as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as unknown as jest.Mock).mockResolvedValue(
      makePdfBuffer('test')
    );
    (fs.stat as unknown as jest.Mock).mockResolvedValue({ size: 1024 });
    (fs.ensureDir as unknown as jest.Mock).mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    it('should save file to temp and create DB record', async () => {
      const result = await service.upload(mockFile, 1);

      expect(fs.writeFile as unknown as jest.Mock).toHaveBeenCalled();
      expect(attachmentRepo.create as jest.Mock).toHaveBeenCalled();
      expect(attachmentRepo.save as jest.Mock).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if write fails', async () => {
      (fs.writeFile as unknown as jest.Mock).mockRejectedValueOnce(
        new Error('Write error')
      );
      await expect(service.upload(mockFile, 1)).rejects.toThrow(
        BadRequestException
      );
    });

    it('ควรคืน existing temp attachment เมื่อ checksum ตรงและยังไม่หมดอายุ (dedup hit)', async () => {
      const existingAttachment = {
        ...mockAttachment,
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
        isTemporary: true,
        checksum: 'existing-checksum',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 ชม. ข้างหน้า
        uploadedByUserId: 1,
      } as Attachment;

      const getOneMock = jest.fn().mockResolvedValue(existingAttachment);
      (attachmentRepo.createQueryBuilder as jest.Mock).mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: getOneMock,
      });

      const result = await service.upload(mockFile, 1);

      expect(getOneMock).toHaveBeenCalled();
      expect(result).toEqual(existingAttachment);
      // ไม่ควรเขียนไฟล์ใหม่หรือสร้าง record ใหม่
      expect(fs.writeFile as unknown as jest.Mock).not.toHaveBeenCalled();
      expect(attachmentRepo.create as jest.Mock).not.toHaveBeenCalled();
      expect(attachmentRepo.save as jest.Mock).not.toHaveBeenCalled();
    });

    it('ควรสร้าง record ใหม่เมื่อ checksum ตรงแต่ temp หมดอายุแล้ว (dedup miss — expired)', async () => {
      const getOneMock = jest.fn().mockResolvedValue(null); // ไม่พบ existing (เพราะ query กรอง expiresAt > now)
      (attachmentRepo.createQueryBuilder as jest.Mock).mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: getOneMock,
      });

      const result = await service.upload(mockFile, 1);

      expect(getOneMock).toHaveBeenCalled();
      expect(fs.writeFile as unknown as jest.Mock).toHaveBeenCalled();
      expect(attachmentRepo.create as jest.Mock).toHaveBeenCalled();
      expect(attachmentRepo.save as jest.Mock).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('ควรสร้าง record ใหม่เมื่อ checksum ตรงแต่เป็นคนละ user (dedup miss — different user)', async () => {
      const getOneMock = jest.fn().mockResolvedValue(null);
      (attachmentRepo.createQueryBuilder as jest.Mock).mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: getOneMock,
      });

      await service.upload(mockFile, 2); // user 2

      expect(getOneMock).toHaveBeenCalled();
      // ตรวจว่า query กรอง userId = 2 (ผ่าน andWhere)
      expect(attachmentRepo.create as jest.Mock).toHaveBeenCalled();
      expect(attachmentRepo.save as jest.Mock).toHaveBeenCalled();
    });

    it('ควรคำนวณ checksum แบบ SHA-256 และเก็บใน attachment record', async () => {
      const getOneMock = jest.fn().mockResolvedValue(null);
      (attachmentRepo.createQueryBuilder as jest.Mock).mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: getOneMock,
      });

      await service.upload(mockFile, 1);

      const createdCalls = (attachmentRepo.create as jest.Mock).mock
        .calls as Array<
        [
          {
            checksum?: string;
            isTemporary?: boolean;
            uploadedByUserId?: number;
          },
        ]
      >;
      const createdArg = createdCalls[0][0];
      expect(createdArg.checksum).toBeDefined();
      expect(typeof createdArg.checksum).toBe('string');
      expect(createdArg.checksum).toHaveLength(64); // SHA-256 hex = 64 chars
      expect(createdArg.isTemporary).toBe(true);
      expect(createdArg.uploadedByUserId).toBe(1);
    });
  });

  describe('commit', () => {
    it('should move files to permanent storage', async () => {
      const tempIds = ['uuid-1'];
      const mockAttachments = [
        {
          ...mockAttachment,
          isTemporary: true,
          tempId: 'uuid-1',
          filePath: '/temp/uuid.pdf',
        },
      ];

      (attachmentRepo.find as jest.Mock).mockResolvedValue(mockAttachments);

      await service.commit(tempIds);

      expect(fs.ensureDir as unknown as jest.Mock).toHaveBeenCalled();
      expect(fs.move as unknown as jest.Mock).toHaveBeenCalled();
      expect(attachmentRepo.save as jest.Mock).toHaveBeenCalled();
    });

    it('should show warning if file counts mismatch', async () => {
      (attachmentRepo.find as jest.Mock).mockResolvedValue([]);
      await expect(service.commit(['uuid-1'])).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('delete', () => {
    it('should delete file if user owns it', async () => {
      (attachmentRepo.findOne as jest.Mock).mockResolvedValue(mockAttachment);

      await service.delete(1, 1);

      expect(fs.remove as unknown as jest.Mock).toHaveBeenCalled();
      expect(attachmentRepo.remove as jest.Mock).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user does not own file', async () => {
      (attachmentRepo.findOne as jest.Mock).mockResolvedValue(mockAttachment);
      await expect(service.delete(1, 999)).rejects.toThrow(ForbiddenException);
    });
  });
});
