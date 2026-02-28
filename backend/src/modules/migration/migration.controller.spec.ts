import { Test, TestingModule } from '@nestjs/testing';
import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';
import { ImportCorrespondenceDto } from './dto/import-correspondence.dto';

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
      document_number: 'DOC-001',
      title: 'Legacy Record',
      category: 'Correspondence',
      source_file_path: '/staging_ai/test.pdf',
      migrated_by: 'SYSTEM_IMPORT',
      batch_id: 'batch1',
    };

    const idempotencyKey = 'key123';
    const user = { userId: 5 };

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
