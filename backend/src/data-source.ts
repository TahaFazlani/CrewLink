import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { AnnouncementRecipient } from './announcements/entities/announcement-recipient.entity';
import { Announcement } from './announcements/entities/announcement.entity';
import { User } from './auth/entities/user.entity';
import { Local } from './locals/entities/local.entity';
import { Member } from './members/entities/member.entity';
import { InitSchema1760000000000 } from './migrations/1760000000000-InitSchema';
import { AddDomainConstraints1760000001000 } from './migrations/1760000001000-AddDomainConstraints';

config({ override: true });

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Local, User, Member, Announcement, AnnouncementRecipient],
  migrations: [InitSchema1760000000000, AddDomainConstraints1760000001000],
  synchronize: false,
});
