import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AnnouncementRecipient } from './announcement-recipient.entity';
import { Announcement } from './announcement.entity';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { MeAnnouncementsController } from './me-announcements.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Announcement, AnnouncementRecipient]),
    AuthModule,
  ],
  controllers: [AnnouncementsController, MeAnnouncementsController],
  providers: [AnnouncementsService],
  exports: [TypeOrmModule],
})
export class AnnouncementsModule {}
