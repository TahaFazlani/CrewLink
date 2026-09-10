import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MockDeliveryAdapter {
  private readonly logger = new Logger(MockDeliveryAdapter.name);

  /**
   * Application-level send only. A crash after a real provider ACK and before
   * we commit could duplicate at that provider; out of scope for this slice.
   */
  async deliver(memberId: string, announcementId: string): Promise<void> {
    this.logger.log(
      `mock push announcementId=${announcementId} memberId=${memberId}`,
    );
  }
}
