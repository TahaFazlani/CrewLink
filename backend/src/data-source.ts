import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { AnnouncementRecipient } from './announcements/announcement-recipient.entity';
import { Announcement } from './announcements/announcement.entity';
import { User } from './auth/user.entity';
import { Local } from './locals/local.entity';
import { Member } from './members/member.entity';
import { InitSchema1760000000000 } from './migrations/1760000000000-InitSchema';

config({ override: true });

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Local, User, Member, Announcement, AnnouncementRecipient],
  migrations: [InitSchema1760000000000],
  synchronize: false,
});
