import { Test, TestingModule } from '@nestjs/testing';
import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';
import { ImportCorrespondenceDto } from './dto/import-correspondence.dto';
import { User } from '../user/entities/user.entity';

describe('MigrationController', () => {
  let controller: MigrationController;
  let service: MigrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MigrationController],
      providers: [
        {
          provide: MigrationService,
          useValue: {
            importCorrespondence: jest
              .fn()
              .mockResolvedValue({ message: 'Success' }),
          },
        },
      ],
    }).compile();

    controller = module.get<MigrationController>(MigrationController);
    service = module.get<MigrationService>(MigrationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call importCorrespondence on service', async () => {
    const dto: ImportCorrespondenceDto = {
      documentNumber: 'DOC-001',
      subject: 'Legacy Record',
      category: 'Correspondence',
      sourceFilePath: '/staging_ai/test.pdf',
      migratedBy: 'SYSTEM_IMPORT',
      batchId: 'batch1',
      projectId: 1,
    };

    const idempotencyKey = 'key123';
    const user: User = {
      user_id: 5,
      username: 'testuser',
      password: 'hashedpassword',
      email: 'test@example.com',
      publicId: '019505a1-7c3e-7000-8000-abc123def456',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      failedAttempts: 0,
      primaryOrganizationPublicId: undefined,
      generatePublicId: jest.fn(),
    };

    const result = await controller.importCorrespondence(
      dto,
      idempotencyKey,
      user
    );
    expect(result).toEqual({ message: 'Success' });
    expect(service.importCorrespondence).toHaveBeenCalledWith(
      dto,
      idempotencyKey,
      5
    );
  });
});
