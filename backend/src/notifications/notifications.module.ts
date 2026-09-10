import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnnouncementRecipient } from '../announcements/announcement-recipient.entity';
import { Announcement } from '../announcements/announcement.entity';
import { MockDeliveryAdapter } from './mock-delivery.adapter';
import { SendWorker } from './send.worker';

@Module({
  imports: [TypeOrmModule.forFeature([Announcement, AnnouncementRecipient])],
  providers: [MockDeliveryAdapter, SendWorker],
})
export class NotificationsModule {}
