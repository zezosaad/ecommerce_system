import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { validate } from './modules/config/env.schema';
import { AllExceptionsFilter } from './modules/common/filters/all-exceptions.filter';
import { ValidationPipe } from './modules/common/pipes/validation.pipe';
import { RequestLoggingInterceptor } from './modules/common/interceptors/request-logging.interceptor';
import { CorrelationIdInterceptor } from './modules/common/interceptors/correlation-id.interceptor';
import { CommonModule } from './modules/common/common.module';
import { RatelimitModule } from './modules/common/ratelimit/ratelimit.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';
import { PermissionsGuard } from './modules/auth/permissions.guard';
import { StoreScopeGuard } from './modules/auth/store-scope.guard';
import { AuditModule } from './modules/audit/audit.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { SettingsModule } from './modules/settings/settings.module';
import { CurrenciesModule } from './modules/currencies/currencies.module';
import { TaxModule } from './modules/tax/tax.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate,
    }),
    CommonModule,
    RatelimitModule,
    PrismaModule,
    AuthModule,
    AuditModule,
    LedgerModule,
    HealthModule,
    UsersModule,
    RolesModule,
    SettingsModule,
    CurrenciesModule,
    TaxModule,
    WebhooksModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useClass: ValidationPipe },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: StoreScopeGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
