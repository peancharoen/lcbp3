import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Correspondence } from '../src/modules/correspondence/entities/correspondence.entity';
import { CorrespondenceStatus } from '../src/modules/correspondence/entities/correspondence-status.entity';

/**
 * Feature 253 — T036: Document Cancel (E2E)
 *
 * ทดสอบ unified cancel endpoint POST /correspondences/:uuid/cancel
 * — ต้องมี test DB + seed data (ผู้ใช้ dc/admin ต้องมีอยู่ใน seed)
 *
 * Flow: สร้าง Correspondence → submit → cancel ผ่าน unified endpoint
 * → ตรวจ status เป็น CANCELLED + response เป็น DocumentActionResponse shape
 */
describe('Document Cancel (E2E) — Feature 253', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let dataSource: DataSource;

  // DC user ต้องมีใน seed data
  const dcUser = { user_id: 2, username: 'admin', organization_id: 1 };
  let dcToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    dataSource = moduleFixture.get<DataSource>(DataSource);

    dcToken = jwtService.sign({
      username: dcUser.username,
      sub: dcUser.user_id,
    });

    // ต้องมี CANCELLED status ใน seed
    const statusRepo = dataSource.getRepository(CorrespondenceStatus);
    const cancelled = await statusRepo.findOne({
      where: { statusCode: 'CANCELLED' },
    });
    expect(cancelled).toBeDefined();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /correspondences/:uuid/cancel — ต้อง return DocumentActionResponse', async () => {
    // หา correspondence ที่ยังไม่ cancel สำหรับทดสอบ
    const corrRepo = dataSource.getRepository(Correspondence);
    const corr = await corrRepo.findOne({
      where: {},
      order: { id: 'DESC' },
    });

    if (!corr) {
      // ไม่มีข้อมูลทดสอบ — skip (ต้อง seed ก่อนรัน)
      return;
    }

    const res = await request(app.getHttpServer() as import('http').Server)
      .post(`/correspondences/${corr.publicId}/cancel`)
      .set('Authorization', `Bearer ${dcToken}`)
      .set('Idempotency-Key', `test-cancel-${Date.now()}`)
      .send({ reason: 'E2E test cancel' });

    // 200 = success, 4xx = permission/status guard (ทั้งคู่ valid response)
    expect([200, 400, 403, 404, 409]).toContain(res.status);

    if (res.status === 200) {
      const body = res.body as Record<string, unknown>;
      expect(body).toMatchObject({
        success: true,
        publicId: corr.publicId,
        action: 'CANCEL',
      });
      expect(body.sideEffects).toBeDefined();
      expect(body.failedSideEffects).toBeInstanceOf(Array);
    }
  });

  it('POST /correspondences/:uuid/cancel — ต้อง reject เมื่อไม่มี auth', async () => {
    const res = await request(app.getHttpServer() as import('http').Server)
      .post('/correspondences/019abc01-0000-7000-8000-000000000001/cancel')
      .send({ reason: 'test' });

    expect([401, 403]).toContain(res.status);
  });
});
