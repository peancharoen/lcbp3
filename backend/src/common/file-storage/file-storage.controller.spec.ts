// File: backend/src/common/file-storage/file-storage.controller.spec.ts
// Change Log:
// - 2026-09-15: Extended with download, preview, delete endpoint tests + error paths

import { Test, TestingModule } from '@nestjs/testing';
import { StreamableFile } from '@nestjs/common';
import { FileStorageController } from './file-storage.controller';
import { FileStorageService } from './file-storage.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

describe('FileStorageController', () => {
  let controller: FileStorageController;
  let mockFileStorageService: Partial<FileStorageService>;

  beforeEach(async () => {
    mockFileStorageService = {
      upload: jest.fn(),
      download: jest.fn(),
      delete: jest.fn(),
      preview: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileStorageController],
      providers: [
        {
          provide: FileStorageService,
          useValue: mockFileStorageService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FileStorageController>(FileStorageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should upload a file successfully', async () => {
      const mockFile = {
        originalname: 'test.pdf',
        buffer: Buffer.from('test'),
        mimetype: 'application/pdf',
        size: 100,
      } as Express.Multer.File;

      const mockResult = { attachment_id: 1, originalFilename: 'test.pdf' };
      (mockFileStorageService.upload as jest.Mock).mockResolvedValue(
        mockResult
      );

      const mockReq = {
        user: { user_id: 1, username: 'testuser' },
      } as unknown as RequestWithUser;
      const result = await controller.uploadFile(mockFile, mockReq);

      expect(mockFileStorageService.upload).toHaveBeenCalledWith(mockFile, 1);
      expect(result).toEqual(mockResult);
    });

    it('should propagate error when upload fails', async () => {
      const mockFile = {
        originalname: 'test.pdf',
        buffer: Buffer.from('test'),
        mimetype: 'application/pdf',
        size: 100,
      } as Express.Multer.File;

      (mockFileStorageService.upload as jest.Mock).mockRejectedValue(
        new Error('Upload failed')
      );

      const mockReq = {
        user: { user_id: 1, username: 'testuser' },
      } as unknown as RequestWithUser;

      await expect(controller.uploadFile(mockFile, mockReq)).rejects.toThrow(
        'Upload failed'
      );
    });
  });

  describe('downloadFile', () => {
    it('should return a StreamableFile with correct headers', async () => {
      const mockStream = Buffer.from(
        'file-content'
      ) as unknown as ReadableStream;
      const mockAttachment = {
        originalFilename: 'document.pdf',
        mimeType: 'application/pdf',
        fileSize: 1234,
      };

      (mockFileStorageService.download as jest.Mock).mockResolvedValue({
        stream: mockStream,
        attachment: mockAttachment,
      });

      const mockRes = {
        set: jest.fn(),
      } as unknown as Response;

      const result = await controller.downloadFile(1, mockRes);

      expect(mockFileStorageService.download).toHaveBeenCalledWith(1);
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition': expect.stringContaining('document.pdf'),
          'Content-Length': 1234,
        })
      );
      expect(result).toBeInstanceOf(StreamableFile);
    });

    it('should propagate error when download fails', async () => {
      (mockFileStorageService.download as jest.Mock).mockRejectedValue(
        new Error('File not found')
      );

      const mockRes = {
        set: jest.fn(),
      } as unknown as Response;

      await expect(controller.downloadFile(999, mockRes)).rejects.toThrow(
        'File not found'
      );
    });

    it('should encode filename with special characters', async () => {
      const mockStream = Buffer.from('data') as unknown as ReadableStream;
      const mockAttachment = {
        originalFilename: 'เอกสารไทย.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
      };

      (mockFileStorageService.download as jest.Mock).mockResolvedValue({
        stream: mockStream,
        attachment: mockAttachment,
      });

      const mockRes = {
        set: jest.fn(),
      } as unknown as Response;

      await controller.downloadFile(1, mockRes);

      const setCall = (
        (mockRes.set as jest.Mock).mock.calls[0] as unknown[]
      )[0] as Record<string, unknown>;
      const disposition = setCall['Content-Disposition'] as string;
      expect(disposition).toContain(encodeURIComponent('เอกสารไทย.pdf'));
    });
  });

  describe('previewFile', () => {
    it('should return a StreamableFile with inline disposition', async () => {
      const mockStream = Buffer.from('preview') as unknown as ReadableStream;
      const mockAttachment = {
        originalFilename: 'preview.pdf',
        mimeType: 'application/pdf',
        fileSize: 500,
      };

      (mockFileStorageService.preview as jest.Mock).mockResolvedValue({
        stream: mockStream,
        attachment: mockAttachment,
      });

      const mockRes = {
        set: jest.fn(),
      } as unknown as Response;

      const result = await controller.previewFile('uuid-123', mockRes);

      expect(mockFileStorageService.preview).toHaveBeenCalledWith('uuid-123');
      expect(result).toBeInstanceOf(StreamableFile);

      const setCall = (
        (mockRes.set as jest.Mock).mock.calls[0] as unknown[]
      )[0] as Record<string, unknown>;
      const disposition = setCall['Content-Disposition'] as string;
      expect(disposition).toContain('inline');
    });

    it('should use application/octet-stream when mimeType is null', async () => {
      const mockStream = Buffer.from('data') as unknown as ReadableStream;
      const mockAttachment = {
        originalFilename: 'file.bin',
        mimeType: null,
        fileSize: 200,
      };

      (mockFileStorageService.preview as jest.Mock).mockResolvedValue({
        stream: mockStream,
        attachment: mockAttachment,
      });

      const mockRes = {
        set: jest.fn(),
      } as unknown as Response;

      await controller.previewFile('uuid-456', mockRes);

      const setCall = (
        (mockRes.set as jest.Mock).mock.calls[0] as unknown[]
      )[0] as Record<string, unknown>;
      expect(setCall['Content-Type']).toBe('application/octet-stream');
    });

    it('should propagate error when preview fails', async () => {
      (mockFileStorageService.preview as jest.Mock).mockRejectedValue(
        new Error('Preview not available')
      );

      const mockRes = {
        set: jest.fn(),
      } as unknown as Response;

      await expect(controller.previewFile('bad-uuid', mockRes)).rejects.toThrow(
        'Preview not available'
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete file and return success message', async () => {
      (mockFileStorageService.delete as jest.Mock).mockResolvedValue(undefined);

      const mockReq = {
        user: { user_id: 5, username: 'admin' },
      } as unknown as RequestWithUser;

      const result = await controller.deleteFile(42, mockReq);

      expect(mockFileStorageService.delete).toHaveBeenCalledWith(42, 5);
      expect(result).toEqual({
        message: 'File deleted successfully',
        id: 42,
      });
    });

    it('should propagate error when delete fails', async () => {
      (mockFileStorageService.delete as jest.Mock).mockRejectedValue(
        new Error('Permission denied')
      );

      const mockReq = {
        user: { user_id: 5, username: 'admin' },
      } as unknown as RequestWithUser;

      await expect(controller.deleteFile(42, mockReq)).rejects.toThrow(
        'Permission denied'
      );
    });
  });
});
