import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { AnnouncementsService } from './announcements.service';

@Controller('me/announcements')
@ApiTags('me')
@ApiBearerAuth('bearer')
export class MeAnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @ApiOperation({
    summary: 'List announcements sent to the authenticated member',
  })
  list(@CurrentUser() user: AuthUser) {
    return this.announcements.listForMember(user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Read one inbox announcement; sets readAt once and increments readCount',
  })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.announcements.getForMember(user, id);
  }

  @Post(':id/acknowledge')
  @ApiOperation({
    summary:
      'Acknowledge once (idempotent); allowed even when needsAck is false',
  })
  acknowledge(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.announcements.acknowledge(user, id);
  }
}
