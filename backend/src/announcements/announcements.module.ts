import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementRecipient } from './entities/announcement-recipient.entity';
import { Announcement } from './entities/announcement.entity';
import { AnnouncementSendService } from './services/announcement-send.service';
import { LeadershipAnnouncementsService } from './services/leadership-announcements.service';
import { MemberInboxService } from './services/member-inbox.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Announcement, AnnouncementRecipient]),
    AiModule,
  ],
  controllers: [AnnouncementsController],
  providers: [
    LeadershipAnnouncementsService,
    AnnouncementSendService,
    MemberInboxService,
  ],
  exports: [TypeOrmModule],
})
export class AnnouncementsModule {}
