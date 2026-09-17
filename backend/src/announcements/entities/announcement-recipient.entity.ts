import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { AttendanceResponse, RecipientStatus } from '../../common/enums';
import { Member } from '../../members/entities/member.entity';
import { Announcement } from './announcement.entity';

@Entity('announcement_recipients')
@Unique('UQ_announcement_recipients_announcement_member', [
  'announcementId',
  'memberId',
])
@Index('IDX_announcement_recipients_status_next_attempt_at', [
  'status',
  'nextAttemptAt',
])
export class AnnouncementRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'announcement_id', type: 'uuid' })
  announcementId: string;

  @ManyToOne(() => Announcement, (announcement) => announcement.recipients, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'announcement_id' })
  announcement: Announcement;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @ManyToOne(() => Member, (member) => member.announcementRecipients, {
    nullable: false,
  })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({ type: 'text' })
  status: RecipientStatus;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ name: 'attendance_response', type: 'text', nullable: true })
  attendanceResponse: AttendanceResponse | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number;

  @Column({ name: 'next_attempt_at', type: 'timestamptz', nullable: true })
  nextAttemptAt: Date | null;
}
