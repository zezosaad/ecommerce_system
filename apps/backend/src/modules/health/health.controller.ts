import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Public } from '../auth/decorators/public.decorator';
import { SuccessEnvelope } from '../common/envelopes';
import { buildMetaFromRequest } from '../common/envelopes/meta';
import { Request } from 'express';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Service health check' })
  async check(@Req() req: Request) {
    const data = await this.healthService.check();
    const meta = buildMetaFromRequest(req);
    return new SuccessEnvelope(data, meta);
  }
}
