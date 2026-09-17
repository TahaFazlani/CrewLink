import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocalsService } from './locals.service';

@Controller('locals')
@ApiTags('locals')
@ApiBearerAuth('bearer')
export class LocalsController {
  constructor(private readonly locals: LocalsService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Get a local by id (caller’s local only; other locals 404)',
  })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.locals.get(id);
  }
}
