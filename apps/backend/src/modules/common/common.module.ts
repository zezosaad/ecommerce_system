import { Global, Module } from '@nestjs/common';
import { MetricsService } from './observability/metrics.service';
import { TracingService } from './observability/tracing.service';

@Global()
@Module({
  providers: [MetricsService, TracingService],
  exports: [MetricsService, TracingService],
})
export class CommonModule {}
