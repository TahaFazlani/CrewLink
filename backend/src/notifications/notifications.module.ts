import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnnouncementRecipient } from '../announcements/entities/announcement-recipient.entity';
import { Announcement } from '../announcements/entities/announcement.entity';
import { DELIVERY_ADAPTER } from './delivery/delivery.port';
import { MockDeliveryAdapter } from './delivery/mock-delivery.adapter';
import { SendWorker } from './send.worker';

@Module({
  imports: [TypeOrmModule.forFeature([Announcement, AnnouncementRecipient])],
  providers: [
    MockDeliveryAdapter,
    { provide: DELIVERY_ADAPTER, useExisting: MockDeliveryAdapter },
    SendWorker,
  ],
})
export class NotificationsModule {}
