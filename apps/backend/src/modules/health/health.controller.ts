import { Controller, Get, HttpStatus, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Public } from '../auth/decorators/public.decorator';
import { SuccessEnvelope } from '../common/envelopes';
import { buildMetaFromRequest } from '../common/envelopes/meta';
import { Request, Response } from 'express';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Service health check' })
  async check(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const data = await this.healthService.check();
    if (data.status === 'unhealthy') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    const meta = buildMetaFromRequest(req);
    return new SuccessEnvelope(data, meta);
  }
}
