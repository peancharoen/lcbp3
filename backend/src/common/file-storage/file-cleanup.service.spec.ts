// File: backend/src/common/file-storage/file-cleanup.service.spec.ts
// Change Log:
// - 2026-08-26: สร้าง unit test สำหรับ FileCleanupService ครอบคลุม handleCleanup ทุก branch

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs-extra';
import { FileCleanupService } from './file-cleanup.service';
import { Attachment } from './entities/attachment.entity';

jest.mock('fs-extra');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('FileCleanupService', () => {
  let service: FileCleanupService;
  const mockAttachmentRepository = {
    find: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileCleanupService,
        {
          provide: getRepositoryToken(Attachment),
          useValue: mockAttachmentRepository,
        },
      ],
    }).compile();
    service = module.get<FileCleanupService>(FileCleanupService);
  });

  it('ควรสร้าง instance ได้', () => {
    expect(service).toBeDefined();
  });

  describe('handleCleanup()', () => {
    it('ควร log และ return ทันทีเมื่อไม่มีไฟล์ที่หมดอายุ', async () => {
      mockAttachmentRepository.find.mockResolvedValueOnce([]);
      await service.handleCleanup();
      expect(mockAttachmentRepository.find).toHaveBeenCalled();
      expect(mockAttachmentRepository.remove).not.toHaveBeenCalled();
    });

    it('ควรลบไฟล์และ record เมื่อพบไฟล์ที่หมดอายุ', async () => {
      const attachments = [
        { id: 1, filePath: '/tmp/file1.pdf' },
        { id: 2, filePath: '/tmp/file2.pdf' },
      ];
      mockAttachmentRepository.find.mockResolvedValueOnce(attachments);
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.remove.mockResolvedValue(undefined);
      mockAttachmentRepository.remove.mockResolvedValue(undefined);

      await service.handleCleanup();

      expect(mockedFs.pathExists).toHaveBeenCalledTimes(2);
      expect(mockedFs.remove).toHaveBeenCalledTimes(2);
      expect(mockAttachmentRepository.remove).toHaveBeenCalledTimes(2);
    });

    it('ควรข้ามการลบไฟล์เมื่อ pathExists คืน false แต่ยังลบ record', async () => {
      const attachments = [{ id: 1, filePath: '/tmp/gone.pdf' }];
      mockAttachmentRepository.find.mockResolvedValueOnce(attachments);
      mockedFs.pathExists.mockResolvedValueOnce(false);
      mockAttachmentRepository.remove.mockResolvedValueOnce(undefined);

      await service.handleCleanup();

      expect(mockedFs.pathExists).toHaveBeenCalledWith('/tmp/gone.pdf');
      expect(mockedFs.remove).not.toHaveBeenCalled();
      expect(mockAttachmentRepository.remove).toHaveBeenCalledWith(
        attachments[0]
      );
    });

    it('ควรจัดการ error และ push ไป errors array โดยไม่ throw', async () => {
      const attachments = [{ id: 1, filePath: '/tmp/error.pdf' }];
      mockAttachmentRepository.find.mockResolvedValueOnce(attachments);
      mockedFs.pathExists.mockRejectedValueOnce(new Error('disk error'));

      await service.handleCleanup();

      // ไม่ควร throw — error ถูก catch และ log
      expect(mockAttachmentRepository.remove).not.toHaveBeenCalled();
    });

    it('ควรจัดการ error จาก fs.remove โดยไม่ throw', async () => {
      const attachments = [{ id: 1, filePath: '/tmp/file.pdf' }];
      mockAttachmentRepository.find.mockResolvedValueOnce(attachments);
      mockedFs.pathExists.mockResolvedValueOnce(true);
      mockedFs.remove.mockRejectedValueOnce(new Error('permission denied'));

      await service.handleCleanup();

      expect(mockAttachmentRepository.remove).not.toHaveBeenCalled();
    });
  });
});
