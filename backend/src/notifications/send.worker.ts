import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AnnouncementRecipient } from '../announcements/entities/announcement-recipient.entity';
import { Announcement } from '../announcements/entities/announcement.entity';
import {
  DELIVERY_ADAPTER,
  type DeliveryAdapter,
} from './delivery/delivery.port';

@Injectable()
export class SendWorker {
  private readonly logger = new Logger(SendWorker.name);

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(DELIVERY_ADAPTER) private readonly adapter: DeliveryAdapter,
  ) {}

  @Interval(2000)
  async tick(): Promise<void> {
    if (this.config.get('WORKER_ENABLED', 'true') === 'false') {
      return;
    }
    const batchSize = Number(this.config.get('WORKER_BATCH_SIZE', 100));
    const retryDelayMs = Number(this.config.get('WORKER_RETRY_DELAY_MS', 5000));
    const maxAttempts = Number(this.config.get('WORKER_MAX_ATTEMPTS', 3));

    const leaseUntil = new Date(Date.now() + retryDelayMs);
    const queued = await this.dataSource.transaction(async (manager) => {
      const claimed = await manager
        .createQueryBuilder(AnnouncementRecipient, 'r')
        .where('r.status = :status', { status: 'queued' })
        .andWhere('(r.nextAttemptAt IS NULL OR r.nextAttemptAt <= :now)', {
          now: new Date(),
        })
        .orderBy('r.id', 'ASC')
        .limit(batchSize)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      for (const recipient of claimed) {
        recipient.nextAttemptAt = leaseUntil;
      }
      await manager.save(claimed);
      return claimed;
    });

    for (const recipient of queued) {
      try {
        await this.adapter.deliver(
          recipient.memberId,
          recipient.announcementId,
        );
        await this.markSent(recipient.id, recipient.announcementId, leaseUntil);
      } catch (err) {
        await this.markFailedAttempt(
          recipient,
          leaseUntil,
          retryDelayMs,
          maxAttempts,
        );
        this.logger.warn(
          `delivery failed announcementId=${recipient.announcementId} memberId=${recipient.memberId} attempts=${recipient.attemptCount + 1} error=${String(err)}`,
        );
      }
    }
  }

  private async markSent(
    recipientId: string,
    announcementId: string,
    leaseUntil: Date,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(AnnouncementRecipient)
        .set({ status: 'sent', sentAt: new Date(), nextAttemptAt: null })
        .where('id = :recipientId', { recipientId })
        .andWhere('status = :status', { status: 'queued' })
        .andWhere('next_attempt_at = :leaseUntil', { leaseUntil })
        .execute();
      if ((result.affected ?? 0) === 1) {
        await manager
          .createQueryBuilder()
          .update(Announcement)
          .set({ sentCount: () => 'sent_count + 1' })
          .where('id = :announcementId', { announcementId })
          .execute();
      }
    });
  }

  private async markFailedAttempt(
    recipient: AnnouncementRecipient,
    leaseUntil: Date,
    retryDelayMs: number,
    maxAttempts: number,
  ): Promise<void> {
    const attempts = recipient.attemptCount + 1;
    await this.dataSource
      .createQueryBuilder()
      .update(AnnouncementRecipient)
      .set({
        attemptCount: attempts,
        status: attempts >= maxAttempts ? 'failed' : 'queued',
        nextAttemptAt:
          attempts >= maxAttempts ? null : new Date(Date.now() + retryDelayMs),
      })
      .where('id = :id', { id: recipient.id })
      .andWhere('status = :status', { status: 'queued' })
      .andWhere('next_attempt_at = :leaseUntil', { leaseUntil })
      .execute();
  }
}
