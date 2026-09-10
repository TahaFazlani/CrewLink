import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from './auth-user';
import { CurrentUser } from './current-user.decorator';
import { Roles } from './roles.decorator';

@Controller('leadership')
@ApiTags('leadership')
@ApiBearerAuth('bearer')
export class LeadershipController {
  @Get('check')
  @Roles('leadership')
  @ApiOperation({
    summary: 'Leadership-only ping (members receive 403)',
  })
  check(@CurrentUser() user: AuthUser) {
    return {
      ok: true,
      memberId: user.memberId,
      localId: user.localId,
      role: user.role,
    };
  }
}
