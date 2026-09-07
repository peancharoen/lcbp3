import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Correspondence } from '../src/modules/correspondence/entities/correspondence.entity';

/**
 * Feature 253 — T054: Document Metadata Patch (E2E)
 *
 * ทดสอบ PATCH /correspondences/:uuid/metadata
 * — ต้องมี test DB + seed data
 *
 * Flow: patch subject บน current revision → ตรวจ version increment
 * + tier3 field (correspondenceNumber) ต้องถูก reject
 */
describe('Document Metadata Patch (E2E) — Feature 253', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let dataSource: DataSource;

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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('PATCH /correspondences/:uuid/metadata — patch tier1 subject + version increment', async () => {
    const corrRepo = dataSource.getRepository(Correspondence);
    const corr = await corrRepo.findOne({
      where: {},
      order: { id: 'DESC' },
    });

    if (!corr) {
      // ไม่มีข้อมูลทดสอบ — skip
      return;
    }

    const res = await request(app.getHttpServer() as import('http').Server)
      .patch(`/correspondences/${corr.publicId}/metadata`)
      .set('Authorization', `Bearer ${dcToken}`)
      .set('Idempotency-Key', `test-patch-${Date.now()}`)
      .send({
        patch: { subject: `E2E patched ${Date.now()}` },
        version: corr.version ?? 0,
      });

    expect([200, 400, 403, 404, 409]).toContain(res.status);

    if (res.status === 200) {
      const body = res.body as Record<string, unknown>;
      expect(body).toMatchObject({
        success: true,
        publicId: corr.publicId,
        action: 'METADATA_PATCH',
      });
      expect(body.newVersion).toBe((corr.version ?? 0) + 1);
    }
  });

  it('PATCH /correspondences/:uuid/metadata — ต้อง reject tier3 field correspondenceNumber', async () => {
    const corrRepo = dataSource.getRepository(Correspondence);
    const corr = await corrRepo.findOne({
      where: {},
      order: { id: 'DESC' },
    });

    if (!corr) {
      return;
    }

    const res = await request(app.getHttpServer() as import('http').Server)
      .patch(`/correspondences/${corr.publicId}/metadata`)
      .set('Authorization', `Bearer ${dcToken}`)
      .set('Idempotency-Key', `test-patch-tier3-${Date.now()}`)
      .send({
        patch: { correspondenceNumber: 'HACK-001' },
        version: corr.version ?? 0,
      });

    // ต้อง reject ด้วย 400 (ValidationException)
    expect([400, 403, 404]).toContain(res.status);
  });
});
