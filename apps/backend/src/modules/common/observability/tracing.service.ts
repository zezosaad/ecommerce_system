import { Injectable } from '@nestjs/common';

@Injectable()
export class TracingService {
  startSpan(_name: string, _attributes?: Record<string, unknown>): string {
    return '';
  }

  endSpan(_spanId: string): void {}

  addEvent(_spanId: string, _name: string, _attributes?: Record<string, unknown>): void {}

  setAttribute(_spanId: string, _key: string, _value: unknown): void {}
}
