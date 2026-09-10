import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AnnouncementRecipient } from '../announcements/announcement-recipient.entity';
import { Announcement } from '../announcements/announcement.entity';
import { MockDeliveryAdapter } from './mock-delivery.adapter';

@Injectable()
export class SendWorker {
  private readonly logger = new Logger(SendWorker.name);

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly adapter: MockDeliveryAdapter,
  ) {}

  @Cron(process.env.WORKER_CRON ?? '*/2 * * * * *')
  async tick(): Promise<void> {
    if (this.config.get('WORKER_ENABLED', 'true') === 'false') {
      return;
    }
    const batchSize = Number(this.config.get('WORKER_BATCH_SIZE', 100));
    const retryDelayMs = Number(this.config.get('WORKER_RETRY_DELAY_MS', 5000));
    const maxAttempts = Number(this.config.get('WORKER_MAX_ATTEMPTS', 3));

    await this.dataSource.transaction(async (manager) => {
      const queued = await manager
        .createQueryBuilder(AnnouncementRecipient, 'r')
        .where('r.status = :status', { status: 'queued' })
        .andWhere(
          '(r.nextAttemptAt IS NULL OR r.nextAttemptAt <= :now)',
          { now: new Date() },
        )
        .orderBy('r.id', 'ASC')
        .limit(batchSize)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      for (const recipient of queued) {
        try {
          await this.adapter.deliver(
            recipient.memberId,
            recipient.announcementId,
          );
          recipient.status = 'sent';
          recipient.sentAt = new Date();
          await manager.save(recipient);
          await manager
            .createQueryBuilder()
            .update(Announcement)
            .set({ sentCount: () => 'sent_count + 1' })
            .where('id = :id', { id: recipient.announcementId })
            .execute();
        } catch (err) {
          const attempts = recipient.attemptCount + 1;
          recipient.attemptCount = attempts;
          if (attempts >= maxAttempts) {
            recipient.status = 'failed';
            recipient.nextAttemptAt = null;
          } else {
            recipient.nextAttemptAt = new Date(Date.now() + retryDelayMs);
          }
          await manager.save(recipient);
          this.logger.warn(
            `mock push failed announcementId=${recipient.announcementId} memberId=${recipient.memberId} attempts=${attempts}`,
          );
          this.logger.warn(String(err));
        }
      }
    });
  }
}
