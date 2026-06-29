import { Test, TestingModule } from '@nestjs/testing';
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
      const _result = await controller.uploadFile(mockFile, mockReq);

      expect(mockFileStorageService.upload).toHaveBeenCalledWith(mockFile, 1);
    });
  });
});
