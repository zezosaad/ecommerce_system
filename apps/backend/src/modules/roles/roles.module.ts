import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { PermissionsController } from './permissions.controller';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [RolesController, PermissionsController],
  providers: [RolesService, PermissionsService],
  exports: [RolesService, PermissionsService],
})
export class RolesModule {}
