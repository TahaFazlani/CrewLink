import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../auth/auth-user';
import { TenantScope } from '../auth/tenant-scope';
import { isUniqueViolation } from '../common/pg-errors';
import { Member } from '../members/member.entity';
import { AnnouncementRecipient } from './announcement-recipient.entity';
import { Announcement } from './announcement.entity';
import {
  toLeadershipAnnouncement,
  toLeadershipAnnouncementListItem,
  toMemberAnnouncement,
} from './announcement.views';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { SendAnnouncementDto } from './dto/send-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly tenant: TenantScope,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(user: AuthUser, dto: CreateAnnouncementDto) {
    const saved = await this.dataSource.getRepository(Announcement).save(
      this.dataSource.getRepository(Announcement).create({
        localId: user.localId,
        createdById: user.memberId,
        title: dto.title,
        body: dto.body,
        notificationPreview: dto.notificationPreview ?? null,
        needsAck: dto.needsAck ?? false,
        requiresAttendance: false,
        status: 'draft',
        sentAt: null,
        sentCount: 0,
        readCount: 0,
        acknowledgedCount: 0,
      }),
    );
    const row = await this.tenant.getByIdOrNotFound(Announcement, saved.id);
    return toLeadershipAnnouncement(row as Announcement);
  }

  async listForLeadership() {
    const rows = await this.tenant
      .forEntity(Announcement, 'a')
      .orderBy('a.createdAt', 'DESC')
      .getMany();
    return rows.map((row) => toLeadershipAnnouncementListItem(row));
  }

  async getForLeadership(id: string) {
    const row = (await this.tenant.getByIdOrNotFound(
      Announcement,
      id,
    )) as Announcement;
    return toLeadershipAnnouncement(row);
  }

  async updateDraft(id: string, dto: UpdateAnnouncementDto) {
    const row = (await this.tenant.getByIdOrNotFound(
      Announcement,
      id,
    )) as Announcement;
    if (row.status !== 'draft') {
      throw new ConflictException('Only draft announcements can be edited');
    }
    if (dto.title !== undefined) {
      row.title = dto.title;
    }
    if (dto.body !== undefined) {
      row.body = dto.body;
    }
    if (dto.notificationPreview !== undefined) {
      row.notificationPreview = dto.notificationPreview;
    }
    if (dto.needsAck !== undefined) {
      row.needsAck = dto.needsAck;
    }
    await this.dataSource.getRepository(Announcement).save(row);
    const updated = (await this.tenant.getByIdOrNotFound(
      Announcement,
      id,
    )) as Announcement;
    return toLeadershipAnnouncement(updated);
  }

  async approve(id: string) {
    const row = (await this.tenant.getByIdOrNotFound(
      Announcement,
      id,
    )) as Announcement;
    if (row.status !== 'draft') {
      throw new ConflictException('Only draft announcements can be approved');
    }
    row.status = 'approved';
    await this.dataSource.getRepository(Announcement).save(row);
    const updated = (await this.tenant.getByIdOrNotFound(
      Announcement,
      id,
    )) as Announcement;
    return toLeadershipAnnouncement(updated);
  }

  async send(user: AuthUser, id: string, dto: SendAnnouncementDto = {}) {
    await this.tenant.getByIdOrNotFound(Announcement, id);

    const sent = await this.dataSource.transaction(async (manager) => {
      const locked = await manager
        .createQueryBuilder(Announcement, 'a')
        .setLock('pessimistic_write')
        .where('a.id = :id', { id })
        .andWhere('a.localId = :localId', { localId: user.localId })
        .getOne();
      if (!locked) {
        throw new NotFoundException();
      }
      if (locked.status === 'sent') {
        return locked;
      }
      if (locked.status !== 'approved') {
        throw new ConflictException(
          'Only approved announcements can be sent',
        );
      }

      const audienceQb = manager
        .createQueryBuilder(Member, 'm')
        .where('m.localId = :localId', { localId: user.localId })
        .andWhere('m.role = :role', { role: 'member' })
        .andWhere('m.status = :status', { status: 'active' });
      if (dto?.classification) {
        audienceQb.andWhere('m.classification = :classification', {
          classification: dto.classification,
        });
      }
      const audience = await audienceQb.getMany();

      if (audience.length > 0) {
        const rows = audience.map((member) => ({
          announcementId: locked.id,
          memberId: member.id,
          status: 'queued' as const,
          attemptCount: 0,
          readAt: null,
          acknowledgedAt: null,
          attendanceResponse: null,
          sentAt: null,
          nextAttemptAt: null,
        }));
        try {
          await manager
            .createQueryBuilder()
            .insert()
            .into(AnnouncementRecipient)
            .values(rows)
            .execute();
        } catch (err) {
          if (!isUniqueViolation(err)) {
            throw err;
          }
        }
      }

      locked.status = 'sent';
      locked.sentAt = new Date();
      await manager.save(locked);
      return locked;
    });

    return toLeadershipAnnouncement(sent);
  }

  async listForMember(user: AuthUser) {
    const rows = await this.tenant
      .forEntity(AnnouncementRecipient, 'r')
      .andWhere('r.memberId = :memberId', { memberId: user.memberId })
      .orderBy('r_announcement.createdAt', 'DESC')
      .getMany();
    return rows.map((row) => toMemberAnnouncement(row));
  }

  async getForMember(user: AuthUser, announcementId: string) {
    await this.requireMemberRecipient(user, announcementId);
    await this.markReadOnce(user, announcementId);
    const recipient = await this.requireMemberRecipient(user, announcementId);
    return toMemberAnnouncement(recipient);
  }

  async acknowledge(user: AuthUser, announcementId: string) {
    await this.requireMemberRecipient(user, announcementId);
    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(AnnouncementRecipient)
        .set({ acknowledgedAt: () => 'now()' })
        .where('announcement_id = :announcementId', { announcementId })
        .andWhere('member_id = :memberId', { memberId: user.memberId })
        .andWhere('acknowledged_at IS NULL')
        .execute();
      if ((result.affected ?? 0) === 1) {
        await manager
          .createQueryBuilder()
          .update(Announcement)
          .set({ acknowledgedCount: () => 'acknowledged_count + 1' })
          .where('id = :announcementId', { announcementId })
          .andWhere('local_id = :localId', { localId: user.localId })
          .execute();
      }
    });
    const recipient = await this.requireMemberRecipient(user, announcementId);
    return toMemberAnnouncement(recipient);
  }

  private async requireMemberRecipient(
    user: AuthUser,
    announcementId: string,
  ): Promise<AnnouncementRecipient> {
    const recipient = await this.tenant
      .forEntity(AnnouncementRecipient, 'r')
      .andWhere('r.announcementId = :announcementId', { announcementId })
      .andWhere('r.memberId = :memberId', { memberId: user.memberId })
      .getOne();
    if (recipient) {
      return recipient;
    }
    await this.tenant.getByIdOrNotFound(Announcement, announcementId);
    throw new NotFoundException();
  }

  private async markReadOnce(user: AuthUser, announcementId: string) {
    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(AnnouncementRecipient)
        .set({ readAt: () => 'now()' })
        .where('announcement_id = :announcementId', { announcementId })
        .andWhere('member_id = :memberId', { memberId: user.memberId })
        .andWhere('read_at IS NULL')
        .execute();
      if ((result.affected ?? 0) === 1) {
        await manager
          .createQueryBuilder()
          .update(Announcement)
          .set({ readCount: () => 'read_count + 1' })
          .where('id = :announcementId', { announcementId })
          .andWhere('local_id = :localId', { localId: user.localId })
          .execute();
      }
    });
  }
}
