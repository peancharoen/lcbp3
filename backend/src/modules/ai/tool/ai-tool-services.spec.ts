// File: src/modules/ai/tool/ai-tool-services.spec.ts
// Change Log
// - 2026-05-19: สร้าง Unit Test สำหรับ RfaToolService, DrawingToolService และ TransmittalToolService (ADR-025, ADR-016, ADR-019)

import { Test, TestingModule } from '@nestjs/testing';
import { RfaToolService } from './rfa-tool.service';
import { DrawingToolService } from './drawing-tool.service';
import { TransmittalToolService } from './transmittal-tool.service';
import { RfaService } from '../../rfa/rfa.service';
import { ShopDrawingService } from '../../drawing/shop-drawing.service';
import { TransmittalService } from '../../transmittal/transmittal.service';
import { AbilityFactory } from '../../../common/auth/casl/ability.factory';
import { UuidResolverService } from '../../../common/services/uuid-resolver.service';
import { ToolHandlerContext } from './types/tool-handler-context.type';
import { User } from '../../user/entities/user.entity';

describe('AI Tool Services (RFA, Drawing, Transmittal)', () => {
  let rfaToolService: RfaToolService;
  let drawingToolService: DrawingToolService;
  let transmittalToolService: TransmittalToolService;

  const mockUser = {
    user_id: 1,
    publicId: 'test-user-uuid',
  } as unknown as User;

  const mockContext: ToolHandlerContext = {
    requestUser: mockUser,
    projectPublicId: '0195a1b2-c3d4-7000-8000-abc123def456',
  };

  const mockAbility = {
    can: jest.fn().mockReturnValue(true),
  };

  const mockAbilityFactory = {
    createForUser: jest.fn().mockReturnValue(mockAbility),
  };

  const mockUuidResolver = {
    resolveProjectId: jest.fn().mockResolvedValue(42),
  };

  const mockRfaService = {
    findAll: jest.fn().mockResolvedValue({
      data: [
        {
          publicId: 'rfa-uuid-1',
          correspondence: {
            correspondenceNumber: 'RFA-001',
          },
          revisions: [
            {
              revisionLabel: 'A',
              issuedDate: new Date('2026-01-01T00:00:00Z'),
              rfaRevision: {
                statusCode: {
                  statusCode: 'APPROVED',
                },
                items: [{}, {}],
                approvedDate: new Date('2026-01-02T00:00:00Z'),
              },
            },
          ],
        },
      ],
    }),
  };

  const mockShopDrawingService = {
    findAll: jest.fn().mockResolvedValue({
      data: [
        {
          publicId: 'drawing-uuid-1',
          drawingNumber: 'DRW-001',
          title: 'Shop Drawing 1',
          status: 'APPROVED',
          currentRevision: {
            revisionLabel: 'B',
          },
        },
      ],
    }),
  };

  const mockTransmittalService = {
    findAll: jest.fn().mockResolvedValue({
      data: [
        {
          correspondence: {
            publicId: 'transmittal-uuid-1',
            correspondenceNumber: 'TRN-001',
            revisions: [
              {
                status: {
                  statusCode: 'ISSUED',
                },
                subject: 'Transmittal Subject 1',
                issuedDate: new Date('2026-02-01T00:00:00Z'),
              },
            ],
          },
        },
      ],
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RfaToolService,
        DrawingToolService,
        TransmittalToolService,
        { provide: AbilityFactory, useValue: mockAbilityFactory },
        { provide: UuidResolverService, useValue: mockUuidResolver },
        { provide: RfaService, useValue: mockRfaService },
        { provide: ShopDrawingService, useValue: mockShopDrawingService },
        { provide: TransmittalService, useValue: mockTransmittalService },
      ],
    }).compile();

    rfaToolService = module.get<RfaToolService>(RfaToolService);
    drawingToolService = module.get<DrawingToolService>(DrawingToolService);
    transmittalToolService = module.get<TransmittalToolService>(
      TransmittalToolService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('RfaToolService', () => {
    it('ควรดึงและแปลงข้อมูล RFA สำเร็จ (Happy Path)', async () => {
      mockAbility.can.mockReturnValue(true);
      const result = await rfaToolService.getRfa(mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          publicId: 'rfa-uuid-1',
          rfaNumber: 'RFA-001',
          revisionCode: 'A',
          statusCode: 'APPROVED',
          drawingCount: 2,
          submittedAt: '2026-01-01T00:00:00.000Z',
          respondedAt: '2026-01-02T00:00:00.000Z',
          contractPublicId: '',
        });
      }
    });

    it('ควรปฏิเสธการเข้าถึงเมื่อไม่มีสิทธิ์ (CASL FORBIDDEN)', async () => {
      mockAbility.can.mockReturnValue(false);
      const result = await rfaToolService.getRfa(mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('FORBIDDEN');
      }
    });

    it('ควรจัดการข้อผิดพลาดระบบได้อย่างสง่างาม (SERVICE_ERROR)', async () => {
      mockAbility.can.mockReturnValue(true);
      mockRfaService.findAll.mockRejectedValueOnce(
        new Error('Database Timeout')
      );
      const result = await rfaToolService.getRfa(mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('SERVICE_ERROR');
      }
    });
  });

  describe('DrawingToolService', () => {
    it('ควรดึงและแปลงข้อมูล Shop Drawing สำเร็จ (Happy Path)', async () => {
      mockAbility.can.mockReturnValue(true);
      const result = await drawingToolService.getDrawing(mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          publicId: 'drawing-uuid-1',
          drawingNumber: 'DRW-001',
          title: 'Shop Drawing 1',
          statusCode: 'APPROVED',
          drawingType: 'SHOP',
          latestRevision: 'B',
          contractPublicId: '',
        });
      }
    });

    it('ควรปฏิเสธการเข้าถึงเมื่อไม่มีสิทธิ์ (CASL FORBIDDEN)', async () => {
      mockAbility.can.mockReturnValue(false);
      const result = await drawingToolService.getDrawing(mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('FORBIDDEN');
      }
    });

    it('ควรจัดการข้อผิดพลาดระบบได้อย่างสง่างาม (SERVICE_ERROR)', async () => {
      mockAbility.can.mockReturnValue(true);
      mockShopDrawingService.findAll.mockRejectedValueOnce(
        new Error('DB Error')
      );
      const result = await drawingToolService.getDrawing(mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('SERVICE_ERROR');
      }
    });
  });

  describe('TransmittalToolService', () => {
    it('ควรดึงและแปลงข้อมูล Transmittal สำเร็จ (Happy Path)', async () => {
      mockAbility.can.mockReturnValue(true);
      const result = await transmittalToolService.getTransmittal(mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          publicId: 'transmittal-uuid-1',
          transmittalNumber: 'TRN-001',
          statusCode: 'ISSUED',
          subject: 'Transmittal Subject 1',
          issuedAt: '2026-02-01T00:00:00.000Z',
          projectPublicId: mockContext.projectPublicId,
        });
      }
    });

    it('ควรปฏิเสธการเข้าถึงเมื่อไม่มีสิทธิ์ (CASL FORBIDDEN)', async () => {
      mockAbility.can.mockReturnValue(false);
      const result = await transmittalToolService.getTransmittal(mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('FORBIDDEN');
      }
    });

    it('ควรจัดการข้อผิดพลาดระบบได้อย่างสง่างาม (SERVICE_ERROR)', async () => {
      mockAbility.can.mockReturnValue(true);
      mockTransmittalService.findAll.mockRejectedValueOnce(
        new Error('Elastic Error')
      );
      const result = await transmittalToolService.getTransmittal(mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('SERVICE_ERROR');
      }
    });
  });
});
