import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiGatewayTimeoutResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/models/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AiDraftDto } from './dto/ai-draft.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { SendAnnouncementDto } from './dto/send-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { AnnouncementSendService } from './services/announcement-send.service';
import { LeadershipAnnouncementsService } from './services/leadership-announcements.service';
import { MemberInboxService } from './services/member-inbox.service';

@Controller()
@ApiTags('announcements')
@ApiBearerAuth('bearer')
export class AnnouncementsController {
  constructor(
    private readonly leadership: LeadershipAnnouncementsService,
    private readonly sender: AnnouncementSendService,
    private readonly inbox: MemberInboxService,
  ) {}

  @Post('announcements')
  @Roles('leadership')
  @ApiOperation({
    summary: 'Create a draft announcement in the caller’s local',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAnnouncementDto) {
    return this.leadership.create(user, dto);
  }

  @Post('announcements/ai-draft')
  @Roles('leadership')
  @ApiOperation({
    summary:
      'Turn an informal note into a draft via AI. Isolated from send; failures never create a row.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Provider missing, down, or returned an unusable draft',
  })
  @ApiGatewayTimeoutResponse({ description: 'AI provider timed out' })
  createFromNote(@CurrentUser() user: AuthUser, @Body() dto: AiDraftDto) {
    return this.leadership.createFromNote(user, dto.note);
  }

  @Get('announcements')
  @Roles('leadership')
  @ApiOperation({
    summary:
      'List announcements for the caller’s local (counters, no recipient rows)',
  })
  list() {
    return this.leadership.list();
  }

  @Get('announcements/:id')
  @Roles('leadership')
  @ApiOperation({
    summary: 'Get one announcement and counters; other locals 404',
  })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadership.get(id);
  }

  @Patch('announcements/:id')
  @Roles('leadership')
  @ApiOperation({
    summary: 'Edit title/body/preview/needsAck while status is draft',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.leadership.updateDraft(id, dto);
  }

  @Post('announcements/:id/approve')
  @Roles('leadership')
  @ApiOperation({ summary: 'Move a draft to approved (required before send)' })
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadership.approve(id);
  }

  @Post('announcements/:id/send')
  @Roles('leadership')
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendAnnouncementDto = {},
  ) {
    return this.sender.send(user, id, dto);
  }

  @Get('me/announcements')
  @Roles('member')
  @ApiOperation({
    summary: 'List announcements sent to the authenticated member',
  })
  listMine(@CurrentUser() user: AuthUser) {
    return this.inbox.list(user);
  }

  @Get('me/announcements/:id')
  @Roles('member')
  @ApiOperation({
    summary: 'Read one inbox announcement; marks it read once',
  })
  getMine(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inbox.get(user, id);
  }

  @Post('me/announcements/:id/acknowledge')
  @Roles('member')
  @ApiOperation({ summary: 'Acknowledge an inbox announcement once' })
  acknowledge(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inbox.acknowledge(user, id);
  }
}
