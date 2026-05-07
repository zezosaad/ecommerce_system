/**
 * Guards-matrix integration test (T043)
 * Tests every combination of guard decorators on the test controller
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TestGuardsController } from '../../src/modules/auth/__test-guards__/test-guards.controller';
import { AuthModule } from '../../src/modules/auth/auth.module';

describe('Guard Matrix Integration (T043)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestGuardsController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // TODO: Obtain a valid JWT for testing
    authToken = 'Bearer test-token';
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Public endpoints', () => {
    it('allows unauthenticated access to @Public endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/__test-guards__/public')
        .expect(200);

      expect(res.body.message).toBe('public');
    });
  });

  describe('Authenticated endpoints', () => {
    it('rejects unauthenticated requests to authenticated endpoints', async () => {
      await request(app.getHttpServer())
        .get('/__test-guards__/authenticated')
        .expect(401);
    });

    it('allows authenticated requests with valid JWT', async () => {
      // This test requires a valid JWT - placeholder for now
      const res = await request(app.getHttpServer())
        .get('/__test-guards__/authenticated')
        .set('Authorization', authToken)
        .expect(200);

      expect(res.body.message).toBe('authenticated');
    });
  });

  describe('Role-restricted endpoints', () => {
    it('rejects users without required role', async () => {
      await request(app.getHttpServer())
        .get('/__test-guards__/roles')
        .set('Authorization', authToken)
        .expect(403);
    });

    it('allows users with required role', async () => {
      // Requires a super_admin JWT
      const res = await request(app.getHttpServer())
        .get('/__test-guards__/roles')
        .set('Authorization', authToken)
        .expect(200);

      expect(res.body.message).toBe('roles');
    });
  });

  describe('Permission-restricted endpoints', () => {
    it('rejects users without required permission', async () => {
      await request(app.getHttpServer())
        .get('/__test-guards__/permissions')
        .set('Authorization', authToken)
        .expect(403);
    });

    it('allows users with required permission', async () => {
      const res = await request(app.getHttpServer())
        .get('/__test-guards__/permissions')
        .set('Authorization', authToken)
        .expect(200);

      expect(res.body.message).toBe('permissions');
    });
  });

  describe('OptionalAuth endpoints', () => {
    it('allows unauthenticated requests to @OptionalAuth endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/__test-guards__/optional')
        .expect(200);

      expect(res.body.message).toBe('optional');
    });

    it('allows authenticated requests to @OptionalAuth endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/__test-guards__/optional')
        .set('Authorization', authToken)
        .expect(200);

      expect(res.body.message).toBe('optional');
    });
  });

  describe('StoreScope endpoints', () => {
    it('rejects cross-merchant access', async () => {
      await request(app.getHttpServer())
        .get('/__test-guards__/store-scope')
        .query({ merchantId: 'different-merchant-id' })
        .set('Authorization', authToken)
        .expect(403);
    });

    it('allows access with matching merchant scope', async () => {
      const res = await request(app.getHttpServer())
        .get('/__test-guards__/store-scope')
        .query({ merchantId: 'matching-merchant-id' })
        .set('Authorization', authToken)
        .expect(200);

      expect(res.body.message).toBe('store-scope');
    });
  });

  describe('Combined guard endpoints', () => {
    it('enforces all guards in combination', async () => {
      // Requires merchant_admin role, merchant.stores.read permission, and store scope
      await request(app.getHttpServer())
        .post('/__test-guards__/combined')
        .send({ storeId: 'some-store-id' })
        .set('Authorization', authToken)
        .expect(403);
    });
  });
});
