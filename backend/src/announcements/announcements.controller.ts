import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { SendAnnouncementDto } from './dto/send-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Controller('announcements')
@ApiTags('announcements')
@ApiBearerAuth('bearer')
@Roles('leadership')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a draft announcement in the caller’s local' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAnnouncementDto) {
    return this.announcements.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List announcements for the caller’s local (counters, no recipient rows)',
  })
  list() {
    return this.announcements.listForLeadership();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one announcement and counters; other locals 404',
  })
  getOne(@Param('id') id: string) {
    return this.announcements.getForLeadership(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit title/body/preview/needsAck while status is draft' })
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcements.updateDraft(id, dto);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Move a draft to approved (required before send)' })
  approve(@Param('id') id: string) {
    return this.announcements.approve(id);
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Queue recipients asynchronously; returns immediately. Idempotent if already sent.',
  })
  @ApiAcceptedResponse({
    description: 'Announcement marked sent; recipient rows queued (or no-op)',
  })
  send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendAnnouncementDto = {},
  ) {
    return this.announcements.send(user, id, dto);
  }
}
