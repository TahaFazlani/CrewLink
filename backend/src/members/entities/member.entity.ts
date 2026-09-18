import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Announcement } from '../../announcements/entities/announcement.entity';
import { AnnouncementRecipient } from '../../announcements/entities/announcement-recipient.entity';
import { User } from '../../auth/entities/user.entity';
import type { MemberRole, MemberStatus } from '../../common/enums';
import { Local } from '../../locals/entities/local.entity';

@Entity('members')
@Index('IDX_members_local_id_status', ['localId', 'status'])
@Index('IDX_members_local_id_classification_status', [
  'localId',
  'classification',
  'status',
])
export class Member {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'local_id', type: 'uuid' })
  localId: string;

  @ManyToOne(() => Local, (local) => local.members, { nullable: false })
  @JoinColumn({ name: 'local_id' })
  local: Local;

  @Column({ name: 'full_name', type: 'text' })
  fullName: string;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text' })
  classification: string;

  @Column({ type: 'text' })
  status: MemberStatus;

  @Column({ type: 'text' })
  role: MemberRole;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.member, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Announcement, (announcement) => announcement.createdBy)
  createdAnnouncements: Announcement[];

  @OneToMany(() => AnnouncementRecipient, (recipient) => recipient.member)
  announcementRecipients: AnnouncementRecipient[];
}
