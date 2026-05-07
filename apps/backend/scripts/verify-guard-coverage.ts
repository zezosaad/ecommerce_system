/**
 * verify-guard-coverage.ts (T049)
 * Static check that loads every controller via NestJS metadata reflection
 * and fails if any non-@Public route lacks one of the auth guards
 */
import { INestApplicationContext, DiscoveryService } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IS_PUBLIC_KEY } from '../src/modules/auth/decorators/public.decorator';
import { ROLES_KEY } from '../src/modules/auth/decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../src/modules/auth/decorators/permissions.decorator';
import { STORE_SCOPE_KEY } from '../src/modules/auth/store-scope.guard';

interface GuardCheckResult {
  controller: string;
  method: string;
  path: string;
  isPublic: boolean;
  hasRoles: boolean;
  hasPermissions: boolean;
  hasStoreScope: boolean;
  issues: string[];
}

async function verifyGuardCoverage(): Promise<void> {
  const app: INestApplicationContext = await NestFactory.createApplicationContext(
    AppModule,
    { logger: false },
  );

  const discoveryService = app.get(DiscoveryService);
  const controllers = discoveryService.getControllers();

  const results: GuardCheckResult[] = [];
  let hasIssues = false;

  controllers.forEach((wrapper) => {
    const controllerClass = wrapper.metatype;
    if (!controllerClass) return;

    const controllerPath = Reflect.getMetadata('path', controllerClass) || '';
    const controllerMethods = Object.getOwnPropertyNames(
      controllerClass.prototype,
    ).filter(
      (name) =>
        name !== 'constructor' &&
        typeof controllerClass.prototype[name] === 'function',
    );

    controllerMethods.forEach((methodName) => {
      const method = controllerClass.prototype[methodName];
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, method) || false;
      const hasRoles = !!Reflect.getMetadata(ROLES_KEY, method);
      const hasPermissions = !!Reflect.getMetadata(PERMISSIONS_KEY, method);
      const hasStoreScope = !!Reflect.getMetadata(STORE_SCOPE_KEY, method);

      const issues: string[] = [];

      // A non-public route should have at least one guard decorator
      if (!isPublic && !hasRoles && !hasPermissions && !hasStoreScope) {
        issues.push('No auth guard decorator found on non-public route');
        hasIssues = true;
      }

      results.push({
        controller: controllerClass.name,
        method: methodName,
        path: `${controllerPath}/${methodName}`.replace(/\/\//g, '/'),
        isPublic,
        hasRoles,
        hasPermissions,
        hasStoreScope,
        issues,
      });
    });
  });

  // Output results
  console.log('\n=== Guard Coverage Report ===\n');

  const tableData = results.map((r) => ({
    Controller: r.controller,
    Method: r.method,
    Path: r.path,
    Public: r.isPublic ? '✓' : '',
    Roles: r.hasRoles ? '✓' : '',
    Permissions: r.hasPermissions ? '✓' : '',
    'StoreScope': r.hasStoreScope ? '✓' : '',
    Issues: r.issues.length > 0 ? r.issues.join(', ') : '',
  }));

  console.table(tableData);

  const totalRoutes = results.length;
  const publicRoutes = results.filter((r) => r.isPublic).length;
  const guardedRoutes = results.filter(
    (r) => !r.isPublic && (r.hasRoles || r.hasPermissions || r.hasStoreScope),
  ).length;
  const unguardedRoutes = results.filter(
    (r) => !r.isPublic && !r.hasRoles && !r.hasPermissions && !r.hasStoreScope,
  ).length;

  console.log('\n=== Summary ===');
  console.log(`Total routes: ${totalRoutes}`);
  console.log(`Public routes: ${publicRoutes}`);
  console.log(`Guarded routes: ${guardedRoutes}`);
  console.log(`Unguarded routes: ${unguardedRoutes}`);

  if (unguardedRoutes > 0) {
    console.log('\n❌ FAIL: Some routes lack auth guard decorators');
    console.log('Unguarded routes:');
    results
      .filter(
        (r) =>
          !r.isPublic &&
          !r.hasRoles &&
          !r.hasPermissions &&
          !r.hasStoreScope,
      )
      .forEach((r) => {
        console.log(`  - ${r.controller}.${r.method} (${r.path})`);
      });
  } else {
    console.log('\n✓ PASS: All non-public routes have at least one auth guard');
  }

  await app.close();

  if (hasIssues) {
    process.exit(1);
  }
}

verifyGuardCoverage().catch((err) => {
  console.error('Error running guard coverage check:', err);
  process.exit(1);
});
