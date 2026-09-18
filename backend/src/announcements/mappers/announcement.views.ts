import { AnnouncementRecipient } from '../entities/announcement-recipient.entity';
import { Announcement } from '../entities/announcement.entity';

export function toLeadershipAnnouncement(row: Announcement) {
  return {
    id: row.id,
    localId: row.localId,
    title: row.title,
    body: row.body,
    notificationPreview: row.notificationPreview,
    needsAck: row.needsAck,
    status: row.status,
    createdById: row.createdById,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
    sentCount: row.sentCount,
    readCount: row.readCount,
    acknowledgedCount: row.acknowledgedCount,
  };
}

export function toLeadershipAnnouncementListItem(row: Announcement) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    sentCount: row.sentCount,
    readCount: row.readCount,
    acknowledgedCount: row.acknowledgedCount,
    sentAt: row.sentAt,
  };
}

export function toMemberAnnouncement(recipient: AnnouncementRecipient) {
  const announcement = recipient.announcement;
  return {
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    needsAck: announcement.needsAck,
    notificationPreview: announcement.notificationPreview,
    recipientStatus: recipient.status,
    readAt: recipient.readAt,
    acknowledgedAt: recipient.acknowledgedAt,
  };
}
