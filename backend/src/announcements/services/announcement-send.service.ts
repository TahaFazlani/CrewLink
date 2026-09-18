import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../../auth/models/auth-user';
import { TenantScope } from '../../tenant/tenant-scope';
import { SendAnnouncementDto } from '../dto/send-announcement.dto';
import { Announcement } from '../entities/announcement.entity';
import { toLeadershipAnnouncement } from '../mappers/announcement.views';

@Injectable()
export class AnnouncementSendService {
  constructor(
    private readonly tenant: TenantScope,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

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
        throw new ConflictException('Only approved announcements can be sent');
      }

      await manager.query(
        `INSERT INTO announcement_recipients
          (announcement_id, member_id, status, attempt_count)
         SELECT $1, m.id, 'queued', 0
         FROM members m
         WHERE m.local_id = $2
           AND m.role = 'member'
           AND m.status = 'active'
           AND ($3::text IS NULL OR m.classification = $3)
         ON CONFLICT (announcement_id, member_id) DO NOTHING`,
        [locked.id, user.localId, dto.classification ?? null],
      );

      locked.status = 'sent';
      locked.sentAt = new Date();
      return manager.save(locked);
    });

    return toLeadershipAnnouncement(sent);
  }
}
