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
    buffer: Buffer.from('test-content'),
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
    (fs.ensureDirSync as jest.Mock).mockReturnValue(true);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.pathExists as jest.Mock).mockResolvedValue(true);
    (fs.move as jest.Mock).mockResolvedValue(undefined);
    (fs.remove as jest.Mock).mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    it('should save file to temp and create DB record', async () => {
      const result = await service.upload(mockFile, 1);

      expect(fs.writeFile).toHaveBeenCalled();
      expect(attachmentRepo.create).toHaveBeenCalled();
      expect(attachmentRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if write fails', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValueOnce(
        new Error('Write error')
      );
      await expect(service.upload(mockFile, 1)).rejects.toThrow(
        BadRequestException
      );
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

      expect(fs.ensureDir).toHaveBeenCalled();
      expect(fs.move).toHaveBeenCalled();
      expect(attachmentRepo.save).toHaveBeenCalled();
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

      expect(fs.remove).toHaveBeenCalled();
      expect(attachmentRepo.remove).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user does not own file', async () => {
      (attachmentRepo.findOne as jest.Mock).mockResolvedValue(mockAttachment);
      await expect(service.delete(1, 999)).rejects.toThrow(ForbiddenException);
    });
  });
});
