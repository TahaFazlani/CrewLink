import { Injectable, Logger } from '@nestjs/common';
import type { DeliveryAdapter } from './delivery.port';

@Injectable()
export class MockDeliveryAdapter implements DeliveryAdapter {
  private readonly logger = new Logger(MockDeliveryAdapter.name);

  deliver(memberId: string, announcementId: string): Promise<void> {
    this.logger.log(
      `mock push announcementId=${announcementId} memberId=${memberId}`,
    );
    return Promise.resolve();
  }
}
