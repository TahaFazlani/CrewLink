import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnnouncementRecipient } from './announcement-recipient.entity';
import { Announcement } from './announcement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Announcement, AnnouncementRecipient])],
  exports: [TypeOrmModule],
})
export class AnnouncementsModule {}
