import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../../auth/models/auth-user';
import { TenantScope } from '../../tenant/tenant-scope';
import { AnnouncementRecipient } from '../entities/announcement-recipient.entity';
import { Announcement } from '../entities/announcement.entity';
import { toMemberAnnouncement } from '../mappers/announcement.views';

@Injectable()
export class MemberInboxService {
  constructor(
    private readonly tenant: TenantScope,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async list(user: AuthUser) {
    const rows = await this.tenant
      .forEntity(AnnouncementRecipient, 'r')
      .andWhere('r.memberId = :memberId', { memberId: user.memberId })
      .orderBy('r_announcement.createdAt', 'DESC')
      .getMany();
    return rows.map(toMemberAnnouncement);
  }

  async get(user: AuthUser, announcementId: string) {
    await this.requireRecipient(user, announcementId);
    await this.markReadOnce(user, announcementId);
    return toMemberAnnouncement(
      await this.requireRecipient(user, announcementId),
    );
  }

  async acknowledge(user: AuthUser, announcementId: string) {
    await this.requireRecipient(user, announcementId);
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
    return toMemberAnnouncement(
      await this.requireRecipient(user, announcementId),
    );
  }

  private async requireRecipient(
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
