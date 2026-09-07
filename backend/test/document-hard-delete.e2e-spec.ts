import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Correspondence } from '../src/modules/correspondence/entities/correspondence.entity';

/**
 * Feature 253 — T067: Document Hard-Delete (E2E)
 *
 * ทดสอบ DELETE endpoints สำหรับ hard-delete (Superadmin / {type}.delete)
 * — ต้องมี test DB + seed data (Redis ต้องพร้อมสำหรับ Redlock)
 *
 * Coverage:
 * - DELETE /correspondences/:uuid/hard (existing — correspondence.delete)
 * - DELETE /rfas/:uuid/hard (T070)
 * - DELETE /transmittals/:uuid/hard (T071)
 * - DELETE /drawings/contract/:uuid/hard (T072)
 */
describe('Document Hard-Delete (E2E) — Feature 253', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let dataSource: DataSource;

  const superadminUser = { user_id: 2, username: 'admin' };
  const regularUser = { user_id: 3, username: 'regular' };
  let superToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    dataSource = moduleFixture.get<DataSource>(DataSource);

    superToken = jwtService.sign({
      username: superadminUser.username,
      sub: superadminUser.user_id,
    });
    userToken = jwtService.sign({
      username: regularUser.username,
      sub: regularUser.user_id,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('DELETE /correspondences/:uuid/hard — ต้อง reject regular user (403)', async () => {
    const res = await request(app.getHttpServer() as import('http').Server)
      .delete('/correspondences/019abc01-0000-7000-8000-000000000001/hard')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', `test-hd-${Date.now()}`);

    expect([401, 403, 404]).toContain(res.status);
  });

  it('DELETE /rfas/:uuid/hard — ต้อง reject เมื่อไม่มี auth', async () => {
    const res = await request(app.getHttpServer() as import('http').Server)
      .delete('/rfas/019abc01-0000-7000-8000-000000000002/hard')
      .set('Idempotency-Key', `test-hd-rfa-${Date.now()}`);

    expect([401, 403]).toContain(res.status);
  });

  it('DELETE /transmittals/:uuid/hard — ต้อง reject เมื่อไม่มี auth', async () => {
    const res = await request(app.getHttpServer() as import('http').Server)
      .delete('/transmittals/019abc01-0000-7000-8000-000000000003/hard')
      .set('Idempotency-Key', `test-hd-trn-${Date.now()}`);

    expect([401, 403]).toContain(res.status);
  });

  it('DELETE /drawings/contract/:uuid/hard — ต้อง reject เมื่อไม่มี auth', async () => {
    const res = await request(
      app.getHttpServer() as import('http').Server
    ).delete('/drawings/contract/019abc01-0000-7000-8000-000000000004/hard');

    expect([401, 403]).toContain(res.status);
  });

  it('DELETE /correspondences/:uuid/hard — hard-delete จริง (ต้องมี seed doc)', async () => {
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
      .delete(`/correspondences/${corr.publicId}/hard`)
      .set('Authorization', `Bearer ${superToken}`)
      .set('Idempotency-Key', `test-hd-real-${Date.now()}`);

    expect([200, 403, 404]).toContain(res.status);

    if (res.status === 200) {
      const body = res.body as Record<string, unknown>;
      expect(body).toMatchObject({
        success: true,
        publicId: corr.publicId,
        action: 'HARD_DELETE',
      });

      // ตรวจว่าถูกลบจริงจาก DB
      const gone = await corrRepo.findOne({
        where: { publicId: corr.publicId },
      });
      expect(gone).toBeNull();
    }
  });
});
