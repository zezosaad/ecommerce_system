import { Injectable } from '@nestjs/common';

export interface QueueRegistration {
  name: string;
  options?: Record<string, unknown>;
}

@Injectable()
export class QueueFactory {
  private queues: Map<string, unknown> = new Map();

  register(_registration: QueueRegistration): void {
    // No live queues in Phase 0. Implementation in later features.
  }

  getQueue(name: string): unknown {
    return this.queues.get(name);
  }
}
