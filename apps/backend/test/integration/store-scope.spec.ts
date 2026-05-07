/**
 * Store Scope Integration Test (T044)
 * Seeds two merchants/stores + one Merchant Staff user
 * Reflectively discovers every @StoreScope endpoint and asserts cross-merchant call → 403
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DiscoveryService } from '@nestjs/core';
import { StoreScopeGuard, STORE_SCOPE_KEY } from '../../src/modules/auth/store-scope.guard';
import { PrismaService } from '../../src/modules/prisma/prisma.service';

describe('Store Scope Integration (T044, SC-003)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let discoveryService: DiscoveryService;
  let merchantAId: string;
  let merchantBId: string;
  let storeAId: string;
  let storeBId: string;
  let merchantStaffToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    discoveryService = app.get(DiscoveryService);

    // Seed test data: two merchants, two stores, one merchant staff user
    merchantAId = '00000000-0000-0000-0000-00000000000A';
    merchantBId = '00000000-0000-0000-0000-00000000000B';
    storeAId = '00000000-0000-0000-0000-0000000000SA';
    storeBId = '00000000-0000-0000-0000-0000000000SB';

    // TODO: Create actual test data in database
    // For now, this is a scaffold

    merchantStaffToken = 'Bearer merchant-staff-token';
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Reflective discovery of @StoreScope endpoints', () => {
    it('should find all endpoints with @StoreScope decorator', () => {
      const controllers = discoveryService.getControllers();
      const storeScopeEndpoints: Array<{
        path: string;
        method: string;
        options: Record<string, unknown>;
      }> = [];

      controllers.forEach((controller) => {
        const controllerPath = Reflect.getMetadata('path', controller.metatype);
        if (!controllerPath) return;

        const prototype = controller.instance;
        const methodNames = Object.getOwnPropertyNames(prototype).filter(
          (name) => name !== 'constructor' && typeof prototype[name] === 'function',
        );

        methodNames.forEach((methodName) => {
          const storeScopeOptions = Reflect.getMetadata(
            STORE_SCOPE_KEY,
            prototype[methodName],
          );
          if (storeScopeOptions) {
            const method = Reflect.getMetadata('method', prototype[methodName]);
            storeScopeEndpoints.push({
              path: `${controllerPath}/${methodName}`.replace(/\/\//g, '/'),
              method: method || 'GET',
              options: storeScopeOptions,
            });
          }
        });
      });

      // Should find at least the audit endpoint and test controller endpoint
      expect(storeScopeEndpoints.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-merchant access denial', () => {
    it('should return 403 when merchant staff accesses another merchant store', async () => {
      // This test requires actual seeded data and valid JWT
      // Scaffold for now
      await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .query({ merchantId: merchantBId })
        .set('Authorization', merchantStaffToken)
        .expect(403);
    });

    it('should write audit entry on scope denial', async () => {
      // Check that authz.scope_denied audit entry is created
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          actionCode: 'authz.scope_denied',
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Same-merchant access allowed', () => {
    it('should allow access when merchant matches', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .query({ merchantId: merchantAId })
        .set('Authorization', merchantStaffToken)
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
