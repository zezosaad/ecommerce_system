import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { PermissionsController } from './permissions.controller';

@Module({
  controllers: [RolesController, PermissionsController],
})
export class RolesModule {}
