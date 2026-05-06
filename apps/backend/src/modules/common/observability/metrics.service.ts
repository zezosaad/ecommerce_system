import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  incrementCounter(_name: string, _labels?: Record<string, string>): void {}

  observeHistogram(
    _name: string,
    _value: number,
    _labels?: Record<string, string>,
  ): void {}

  setGauge(_name: string, _value: number, _labels?: Record<string, string>): void {}

  timing(_name: string, _durationMs: number, _labels?: Record<string, string>): void {}
}
