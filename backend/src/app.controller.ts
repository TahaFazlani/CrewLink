import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';

@Controller()
@ApiTags('health')
export class AppController {
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness check' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  health(): { status: string } {
    return { status: 'ok' };
  }
}
