import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AnnouncementStatus } from '../common/enums';
import { Local } from '../locals/local.entity';
import { Member } from '../members/member.entity';
import { AnnouncementRecipient } from './announcement-recipient.entity';

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'local_id', type: 'uuid' })
  localId: string;

  @ManyToOne(() => Local, (local) => local.announcements, { nullable: false })
  @JoinColumn({ name: 'local_id' })
  local: Local;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'needs_ack', type: 'boolean', default: false })
  needsAck: boolean;

  @Column({
    name: 'requires_attendance',
    type: 'boolean',
    default: false,
  })
  requiresAttendance: boolean;

  @Column({ type: 'text' })
  status: AnnouncementStatus;

  @Column({ name: 'created_by', type: 'uuid' })
  createdById: string;

  @ManyToOne(() => Member, (member) => member.createdAnnouncements, {
    nullable: false,
  })
  @JoinColumn({ name: 'created_by' })
  createdBy: Member;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;

  @Column({ name: 'sent_count', type: 'int', default: 0 })
  sentCount: number;

  @Column({ name: 'read_count', type: 'int', default: 0 })
  readCount: number;

  @Column({ name: 'acknowledged_count', type: 'int', default: 0 })
  acknowledgedCount: number;

  @Column({ name: 'notification_preview', type: 'text', nullable: true })
  notificationPreview: string | null;

  @OneToMany(() => AnnouncementRecipient, (recipient) => recipient.announcement)
  recipients: AnnouncementRecipient[];
}
