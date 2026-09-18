import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AI_DRAFT_PORT, type AiDraftPort } from '../../ai/ai-draft.port';
import type { AuthUser } from '../../auth/models/auth-user';
import { TenantScope } from '../../tenant/tenant-scope';
import { CreateAnnouncementDto } from '../dto/create-announcement.dto';
import { UpdateAnnouncementDto } from '../dto/update-announcement.dto';
import { Announcement } from '../entities/announcement.entity';
import {
  toLeadershipAnnouncement,
  toLeadershipAnnouncementListItem,
} from '../mappers/announcement.views';

@Injectable()
export class LeadershipAnnouncementsService {
  constructor(
    private readonly tenant: TenantScope,
    @InjectRepository(Announcement)
    private readonly announcements: Repository<Announcement>,
    @Inject(AI_DRAFT_PORT) private readonly aiDrafts: AiDraftPort,
  ) {}

  async create(user: AuthUser, dto: CreateAnnouncementDto) {
    const saved = await this.announcements.save(
      this.announcements.create({
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
    return toLeadershipAnnouncement(
      await this.tenant.getByIdOrNotFound(Announcement, saved.id),
    );
  }

  async createFromNote(user: AuthUser, note: string) {
    const drafted = await this.aiDrafts.draftFromNote(note);
    return this.create(user, drafted);
  }

  async list() {
    const rows = await this.tenant
      .forEntity(Announcement, 'a')
      .orderBy('a.createdAt', 'DESC')
      .getMany();
    return rows.map(toLeadershipAnnouncementListItem);
  }

  async get(id: string) {
    return toLeadershipAnnouncement(
      await this.tenant.getByIdOrNotFound(Announcement, id),
    );
  }

  async updateDraft(id: string, dto: UpdateAnnouncementDto) {
    const row = await this.tenant.getByIdOrNotFound(Announcement, id);
    if (row.status !== 'draft') {
      throw new ConflictException('Only draft announcements can be edited');
    }
    this.announcements.merge(row, dto);
    await this.announcements.save(row);
    return this.get(id);
  }

  async approve(id: string) {
    const row = await this.tenant.getByIdOrNotFound(Announcement, id);
    if (row.status !== 'draft') {
      throw new ConflictException('Only draft announcements can be approved');
    }
    row.status = 'approved';
    await this.announcements.save(row);
    return this.get(id);
  }
}
